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
          <div className="mb-8">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em]">saved</p>
            <h1 className="font-serif text-4xl sm:text-5xl text-ink tracking-tight mt-2">
              the yes pile<span className="text-accent">.</span>
            </h1>
            <p className="text-muted text-sm mt-2">everything you swiped right on or bookmarked — your taste, on record</p>
          </div>

          {savedRows?.length === 0 ? (
            <div className="text-center py-20">
              <Bookmark size={40} className="text-border mx-auto mb-4" />
              <p className="font-serif text-3xl text-ink tracking-tight">the yes pile is empty</p>
              <p className="text-muted text-sm mt-2 mb-6">go swipe, or smash a bookmark on anything that looks good</p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/taste" className="btn-primary inline-block">start swiping →</Link>
                <Link href="/explore" className="btn-secondary inline-block">browse everything</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
                    coming up ({upcoming.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {upcoming.map((r, i) => r.event && (
                      <div key={r.event.id} className="tile-in" style={{ animationDelay: `${Math.min(i, 11) * 50}ms` }}>
                        <EventCard event={r.event} initialSaved />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
                    missed it ({past.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 opacity-60">
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
