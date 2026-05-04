import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import EventCard from '@/components/EventCard'
import FilterBar from '@/components/FilterBar'
import type { Event, Category, DateFilter } from '@/lib/types'
import { getDateRange } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ category?: string; date?: string; free?: string; search?: string }>
}

async function EventGrid({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Build query
  let query = supabase
    .from('events')
    .select('*')
    .gte('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(60)

  if (params.category && params.category !== 'all') {
    query = query.contains('categories', [params.category])
  }

  if (params.free === 'true') {
    query = query.eq('is_free', true)
  }

  if (params.search) {
    query = query.ilike('title', `%${params.search}%`)
  }

  if (params.date && params.date !== 'all') {
    const { from, to } = getDateRange(params.date as DateFilter)
    query = query.gte('start_datetime', from.toISOString()).lt('start_datetime', to.toISOString())
  }

  const { data: events = [] } = await query

  // Get user's saved event IDs and interests
  let savedIds = new Set<string>()
  let userInterests: string[] = []

  if (user) {
    const [{ data: saved }, { data: interests }] = await Promise.all([
      supabase.from('saved_events').select('event_id').eq('user_id', user.id),
      supabase.from('interests').select('name').eq('user_id', user.id),
    ])
    savedIds = new Set((saved ?? []).map(s => s.event_id))
    userInterests = (interests ?? []).map(i => i.name.toLowerCase())
  }

  // Compute basic match reasons
  const enriched: Event[] = (events ?? []).map(ev => {
    const peopleMatch = ev.people?.filter((p: string) =>
      userInterests.some(i => p.toLowerCase().includes(i) || i.includes(p.toLowerCase()))
    )
    const tagMatch = ev.tags?.filter((t: string) =>
      userInterests.some(i => t.toLowerCase().includes(i) || i.includes(t.toLowerCase()))
    )

    let match_reason: string | undefined
    if (peopleMatch?.length > 0) {
      match_reason = `Matches your interest in ${peopleMatch.slice(0, 2).join(' & ')}`
    } else if (tagMatch?.length > 0) {
      match_reason = `Relevant to your interest in ${tagMatch.slice(0, 2).join(' & ')}`
    }

    return { ...ev, saved: savedIds.has(ev.id), match_reason }
  })

  // Sort: matched events first
  enriched.sort((a, b) => {
    if (a.match_reason && !b.match_reason) return -1
    if (!a.match_reason && b.match_reason) return 1
    return 0
  })

  if (enriched.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-lg">No events found</p>
        <p className="text-muted text-sm mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {enriched.map(event => (
        <EventCard key={event.id} event={event} initialSaved={event.saved} />
      ))}
    </div>
  )
}

export default async function ExplorePage(props: PageProps) {
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-ink">Explore London</h1>
            <p className="text-muted text-sm mt-1">Events matched to your taste</p>
          </div>

          <div className="mb-6">
            <Suspense fallback={null}>
              <FilterBar />
            </Suspense>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="card h-64 animate-pulse bg-border" />
                ))}
              </div>
            }
          >
            <EventGrid searchParams={props.searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
