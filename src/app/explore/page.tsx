import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import EventCard from '@/components/EventCard'
import FilterBar from '@/components/FilterBar'
import type { Event, Category, DateFilter } from '@/lib/types'
import { getDateRange } from '@/lib/utils'

const PAGE_SIZE = 60

interface PageProps {
  searchParams: Promise<{ category?: string; date?: string; free?: string; search?: string; page?: string }>
}

function buildUrl(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...params, ...overrides }
  const qs = Object.entries(merged)
    .filter(([, v]) => v && v !== 'all' && v !== '1')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&')
  return `/explore${qs ? `?${qs}` : ''}`
}

async function EventGrid({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date().toISOString()
  const farFuture = '2099-01-01T00:00:00Z'

  let fromTime = now
  let toTime = farFuture
  if (params.date && params.date !== 'all') {
    const range = getDateRange(params.date as DateFilter)
    fromTime = range.from.toISOString()
    toTime = range.to.toISOString()
  }

  const rpcParams = {
    p_from_time: fromTime,
    p_to_time:   toTime,
    p_category:  (params.category && params.category !== 'all') ? params.category : null,
    p_is_free:   params.free === 'true' ? true : null,
    p_search:    params.search || null,
    p_limit:     PAGE_SIZE,
    p_offset:    offset,
  }

  const [{ data: events }, { data: countData }] = await Promise.all([
    supabase.rpc('get_unique_events', rpcParams),
    supabase.rpc('count_unique_events', {
      p_from_time: rpcParams.p_from_time,
      p_to_time:   rpcParams.p_to_time,
      p_category:  rpcParams.p_category,
      p_is_free:   rpcParams.p_is_free,
      p_search:    rpcParams.p_search,
    }),
  ])

  const count = (countData as number) ?? 0
  const totalPages = Math.ceil(count / PAGE_SIZE)

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

  const enriched: Event[] = ((events ?? []) as Event[]).map(ev => {
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

  const urlParams = {
    category: params.category,
    date: params.date,
    free: params.free,
    search: params.search,
  }

  return (
    <>
      <p className="text-muted text-sm mb-4">
        {count?.toLocaleString()} events · page {page} of {totalPages}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {enriched.map(event => (
          <EventCard key={event.id} event={event} initialSaved={event.saved} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {page > 1 ? (
            <Link
              href={buildUrl(urlParams, { page: String(page - 1) })}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors"
            >
              ← Previous
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg border border-border text-sm text-muted opacity-40">← Previous</span>
          )}

          <span className="text-sm text-muted">{page} / {totalPages}</span>

          {page < totalPages ? (
            <Link
              href={buildUrl(urlParams, { page: String(page + 1) })}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors"
            >
              Next →
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg border border-border text-sm text-muted opacity-40">Next →</span>
          )}
        </div>
      )}
    </>
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
