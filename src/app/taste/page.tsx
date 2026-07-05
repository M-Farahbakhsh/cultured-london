import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import TasteDeck from '@/components/TasteDeck'
import type { Event } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DECK_SIZE = 12

export default async function TastePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const now = new Date().toISOString()
  const [{ data: eventsRaw }, { data: savedRaw }, { data: dislikedRaw }] = await Promise.all([
    supabase.rpc('get_unique_events', {
      p_from_time: now,
      p_to_time: '2099-01-01T00:00:00Z',
      p_limit: 120, p_offset: 0,
    }),
    supabase.from('saved_events').select('event_id').eq('user_id', user.id),
    supabase.from('disliked_events').select('event_id').eq('user_id', user.id),
  ])

  const savedIds = new Set((savedRaw ?? []).map((s: { event_id: string }) => s.event_id))
  const dislikedIds = new Set((dislikedRaw ?? []).map((d: { event_id: string }) => d.event_id))

  // Deck wants photogenic variety: images only, nothing already saved or
  // already swiped "nah", and interleaved across categories so ten club
  // nights in a row can't happen.
  const candidates = ((eventsRaw ?? []) as Event[])
    .filter(ev => ev.image_url && !savedIds.has(ev.id) && !dislikedIds.has(ev.id))

  const byCategory = new Map<string, Event[]>()
  for (const ev of candidates) {
    const cat = ev.categories?.[0] ?? 'other'
    const bucket = byCategory.get(cat) ?? []
    bucket.push(ev)
    byCategory.set(cat, bucket)
  }
  const deck: Event[] = []
  const buckets = Array.from(byCategory.values())
  for (let round = 0; deck.length < DECK_SIZE; round++) {
    let added = false
    for (const bucket of buckets) {
      if (deck.length >= DECK_SIZE) break
      const ev = bucket[round]
      if (ev) { deck.push(ev); added = true }
    }
    if (!added) break
  }

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-24 md:pb-8">
        <div className="page-container py-8">
          <div className="text-center mb-8">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em]">taste check</p>
            <h1 className="font-serif text-4xl text-ink tracking-tight mt-2">
              into it, or nah<span className="text-accent">?</span>
            </h1>
            <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
              right = yes obviously. left = not your scene. the feed learns fast.
            </p>
          </div>

          {deck.length > 0 ? (
            <TasteDeck events={deck} userId={user.id} />
          ) : (
            <p className="text-center text-muted py-16">
              No fresh events to swipe right now — check back soon.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
