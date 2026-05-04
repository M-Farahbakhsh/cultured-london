import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import EventCard from '@/components/EventCard'
import { Bookmark } from 'lucide-react'
import Link from 'next/link'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: savedRows = [] } = await supabase
    .from('saved_events')
    .select('*, event:events(*)')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })

  const now = new Date()
  const upcoming = (savedRows ?? []).filter(r => r.event && new Date(r.event.start_datetime) >= now)
  const past = (savedRows ?? []).filter(r => r.event && new Date(r.event.start_datetime) < now)

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Saved Events</h1>
          <p className="text-muted text-sm mb-8">Your personal event directory</p>

          {savedRows?.length === 0 ? (
            <div className="text-center py-20">
              <Bookmark size={40} className="text-border mx-auto mb-4" />
              <p className="text-muted text-lg">Nothing saved yet</p>
              <p className="text-muted text-sm mt-1 mb-6">Browse events and tap the bookmark to save them here</p>
              <Link href="/explore" className="btn-primary inline-block">Explore events</Link>
            </div>
          ) : (
            <div className="space-y-10">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
                    Upcoming ({upcoming.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcoming.map(r => r.event && (
                      <EventCard key={r.event.id} event={r.event} initialSaved />
                    ))}
                  </div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
                    Past ({past.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                    {past.map(r => r.event && (
                      <EventCard key={r.event.id} event={r.event} initialSaved />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
