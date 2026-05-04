'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCircle, Edit2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import InterestPicker from '@/components/InterestPicker'
import type { Interest, Profile, InterestType } from '@/lib/types'

const INTEREST_SECTIONS: Array<{ type: InterestType; label: string; placeholder: string }> = [
  { type: 'artist', label: 'Music & Artists', placeholder: 'Add artist or musician...' },
  { type: 'author', label: 'Authors & Writers', placeholder: 'Add author or writer...' },
  { type: 'person', label: 'People & Thinkers', placeholder: 'Add person...' },
  { type: 'topic', label: 'Topics & Ideas', placeholder: 'Add topic or idea...' },
  { type: 'venue', label: 'Favourite Venues', placeholder: 'Add venue...' },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [interests, setInterests] = useState<Interest[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [attendedCount, setAttendedCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [{ data: p }, { data: i }, { count: sc }, { count: ac }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('interests').select('*').eq('user_id', user.id).order('type'),
        supabase.from('saved_events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('attended_events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      setProfile(p)
      setInterests(i ?? [])
      setSavedCount(sc ?? 0)
      setAttendedCount(ac ?? 0)
      setEditName(p?.full_name ?? '')
      setEditBio(p?.bio ?? '')
    }
    load()
  }, [])

  const saveProfile = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('profiles')
      .update({ full_name: editName, bio: editBio })
      .eq('id', profile.id)
      .select()
      .single()
    if (data) setProfile(data)
    setEditing(false)
  }

  const addInterest = async (name: string, type: InterestType, metadata?: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('interests')
      .insert({ user_id: user.id, type, name, metadata: metadata ?? {} })
      .select().single()
    if (!error && data) setInterests(prev => [...prev, data])
  }

  const removeInterest = async (id: string) => {
    await supabase.from('interests').delete().eq('id', id)
    setInterests(prev => prev.filter(i => i.id !== id))
  }

  if (!profile) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="animate-pulse text-muted">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8 max-w-2xl">
          {/* Profile header */}
          <div className="card p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center border border-border">
                  <UserCircle size={36} className="text-muted" />
                </div>
                <div>
                  {editing ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="input text-lg font-bold mb-1"
                    />
                  ) : (
                    <h1 className="text-xl font-bold text-ink">{profile.full_name || profile.username}</h1>
                  )}
                  <p className="text-sm text-muted">@{profile.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button onClick={saveProfile} className="btn-primary py-1.5 px-3 flex items-center gap-1.5">
                      <Check size={14} /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary py-1.5 px-3">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5">
                    <Edit2 size={14} /> Edit
                  </button>
                )}
              </div>
            </div>

            {editing ? (
              <textarea
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="A short bio..."
                rows={2}
                className="input mt-4"
              />
            ) : profile.bio ? (
              <p className="text-sm text-muted mt-3">{profile.bio}</p>
            ) : null}

            {/* Stats */}
            <div className="flex gap-6 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xl font-bold text-ink">{savedCount}</p>
                <p className="text-xs text-muted">Saved</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-ink">{attendedCount}</p>
                <p className="text-xs text-muted">Been to</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-ink">{interests.length}</p>
                <p className="text-xs text-muted">Interests</p>
              </div>
            </div>
          </div>

          {/* Interests */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-ink mb-5">Your taste profile</h2>
            <div className="space-y-6">
              {INTEREST_SECTIONS.map(({ type, label, placeholder }) => (
                <InterestPicker
                  key={type}
                  type={type}
                  label={label}
                  placeholder={placeholder}
                  interests={interests.filter(i => i.type === type)}
                  onAdd={(name, meta) => addInterest(name, type, meta)}
                  onRemove={removeInterest}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
