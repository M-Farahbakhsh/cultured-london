'use client'
import { useEffect, useState, useRef } from 'react'
import { Clock, Search, ThumbsUp, ThumbsDown, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import type { AttendedEvent, Event } from '@/lib/types'
import { formatDate, decodeHtmlEntities } from '@/lib/utils'

export default function PastEventsPage() {
  const [attended, setAttended] = useState<AttendedEvent[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Event[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualForm, setManualForm] = useState({ title: '', venue: '', date: '' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('attended_events')
      .select('*, event:events(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAttended(data ?? [])
  }

  const searchEvents = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('events')
      .select('*')
      .ilike('title', `%${q}%`)
      .limit(8)
    setSearchResults(data ?? [])
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchEvents(val), 300)
  }

  const addAttended = async (event: Event) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('attended_events')
      .insert({ user_id: user.id, event_id: event.id })
      .select('*, event:events(*)')
      .single()
    if (data) setAttended(prev => [data, ...prev])
    setSearch('')
    setSearchResults([])
    setShowSearch(false)
  }

  const addManual = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !manualForm.title) return
    const { data } = await supabase
      .from('attended_events')
      .insert({
        user_id: user.id,
        manual_title: manualForm.title,
        manual_venue: manualForm.venue,
        manual_date: manualForm.date || null,
      })
      .select()
      .single()
    if (data) setAttended(prev => [data, ...prev])
    setManualForm({ title: '', venue: '', date: '' })
    setManualMode(false)
  }

  const setEnjoyed = async (id: string, enjoyed: boolean) => {
    await supabase.from('attended_events').update({ enjoyed }).eq('id', id)
    setAttended(prev => prev.map(a => a.id === id ? { ...a, enjoyed } : a))
  }

  const remove = async (id: string) => {
    await supabase.from('attended_events').delete().eq('id', id)
    setAttended(prev => prev.filter(a => a.id !== id))
  }

  const getTitle = (a: AttendedEvent) => decodeHtmlEntities(a.event?.title ?? a.manual_title ?? 'Unnamed event')
  const getVenue = (a: AttendedEvent) => a.event?.venue_name ?? a.manual_venue
  const getDate = (a: AttendedEvent) => a.event?.start_datetime
    ? formatDate(a.event.start_datetime)
    : a.manual_date ?? ''

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8 max-w-2xl">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-ink">Been to</h1>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSearch(true); setManualMode(false) }}
                className="btn-primary text-sm flex items-center gap-1.5 py-2"
              >
                <Search size={14} /> Find event
              </button>
              <button
                onClick={() => { setManualMode(true); setShowSearch(false) }}
                className="btn-secondary text-sm flex items-center gap-1.5 py-2"
              >
                <Plus size={14} /> Add manually
              </button>
            </div>
          </div>
          <p className="text-muted text-sm mb-6">Events you've attended — helps us recommend better</p>

          {/* Event search */}
          {showSearch && (
            <div className="card p-4 mb-4 relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-ink">Search for an event</p>
                <button onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]) }}>
                  <X size={16} className="text-muted" />
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={handleSearchInput}
                  placeholder="Search events you attended..."
                  className="input pl-9"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 border border-border rounded-xl overflow-hidden">
                  {searchResults.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => addAttended(ev)}
                      className="w-full text-left px-4 py-3 hover:bg-bg transition-colors border-b border-border last:border-0"
                    >
                      <p className="text-sm font-medium text-ink">{decodeHtmlEntities(ev.title)}</p>
                      <p className="text-xs text-muted mt-0.5">{ev.venue_name} · {formatDate(ev.start_datetime)}</p>
                    </button>
                  ))}
                </div>
              )}
              {search.length >= 2 && searchResults.length === 0 && (
                <div className="mt-3 text-sm text-muted text-center py-2">
                  Not in our database —{' '}
                  <button onClick={() => { setManualMode(true); setShowSearch(false) }} className="text-accent underline">
                    add it manually
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual add */}
          {manualMode && (
            <div className="card p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-ink">Add event manually</p>
                <button onClick={() => setManualMode(false)}><X size={16} className="text-muted" /></button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Event name *"
                  value={manualForm.title}
                  onChange={e => setManualForm(p => ({ ...p, title: e.target.value }))}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Venue"
                  value={manualForm.venue}
                  onChange={e => setManualForm(p => ({ ...p, venue: e.target.value }))}
                  className="input"
                />
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}
                  className="input"
                />
                <button onClick={addManual} disabled={!manualForm.title} className="btn-primary w-full">
                  Add event
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {attended.length === 0 && !showSearch && !manualMode ? (
            <div className="text-center py-20">
              <Clock size={40} className="text-border mx-auto mb-4" />
              <p className="text-muted text-lg">No events logged yet</p>
              <p className="text-muted text-sm mt-1">Add events you've been to — they help improve your recommendations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attended.map(a => (
                <div key={a.id} className="card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{getTitle(a)}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {[getVenue(a), getDate(a)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEnjoyed(a.id, true)}
                      className={`p-1.5 rounded-lg transition-colors ${a.enjoyed === true ? 'bg-green-100 text-green-700' : 'text-muted hover:text-green-600'}`}
                      title="Enjoyed it"
                    >
                      <ThumbsUp size={15} />
                    </button>
                    <button
                      onClick={() => setEnjoyed(a.id, false)}
                      className={`p-1.5 rounded-lg transition-colors ${a.enjoyed === false ? 'bg-red-100 text-red-700' : 'text-muted hover:text-red-600'}`}
                      title="Didn't enjoy it"
                    >
                      <ThumbsDown size={15} />
                    </button>
                    <button onClick={() => remove(a.id)} className="p-1.5 text-muted hover:text-ink">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
