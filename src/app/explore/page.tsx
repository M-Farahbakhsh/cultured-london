import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import EventCard from '@/components/EventCard'
import FilterBar from '@/components/FilterBar'
import MapView from '@/components/MapView'
import type { Event, DateFilter } from '@/lib/types'
import { getDateRange } from '@/lib/utils'
import { buildPreferenceProfile, scoreEvent, type PreferenceProfile } from '@/lib/recommendations'

const PAGE_SIZE = 60

interface PageProps {
  searchParams: Promise<{
    category?: string
    date?: string
    free?: string
    search?: string
    page?: string
    view?: string
    from?: string
    time_from?: string
    time_to?: string
    picked?: string
  }>
}

type ResolvedParams = Awaited<PageProps['searchParams']>

function buildUrl(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...params, ...overrides }
  const qs = Object.entries(merged)
    .filter(([, v]) => v && v !== 'all' && v !== '1')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&')
  return `/explore${qs ? `?${qs}` : ''}`
}

function buildRpcBase(params: ResolvedParams) {
  const now = new Date().toISOString()
  const farFuture = '2099-01-01T00:00:00Z'
  let fromTime = now
  let toTime = farFuture

  if (params.date && params.date !== 'all') {
    if (params.date === 'custom' && params.from) {
      const day = new Date(params.from)
      fromTime = day.toISOString()
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)
      toTime = nextDay.toISOString()
    } else if (params.date !== 'custom') {
      const range = getDateRange(params.date as DateFilter)
      fromTime = range.from.toISOString()
      toTime = range.to.toISOString()
    }
  }

  return {
    p_from_time: fromTime,
    p_to_time: toTime,
    p_category: (params.category && params.category !== 'all') ? params.category : null,
    p_is_free: params.free === 'true' ? true : null,
    p_search: params.search || null,
  }
}

// get_unique_events() matches on date-range overlap (start..end), so a months-long running
// listing (e.g. an Eventbrite series from May to December) is correctly included as long as
// it's still active — that's what we want ("running now" = featured). But its start_datetime
// is still the original, months-old date, which reads as stale on a card. For any event that
// already started, show today's date (keeping the original time of day) instead.
function displayAsOngoing(events: Event[]): Event[] {
  const now = new Date()
  return events.map(ev => {
    const start = new Date(ev.start_datetime)
    if (start >= now) return ev
    const today = new Date()
    today.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0)
    return { ...ev, start_datetime: today.toISOString() }
  })
}

function filterByTimeOfDay(events: Event[], timeFrom: string | undefined, timeTo: string | undefined): Event[] {
  if (!timeFrom && !timeTo) return events

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const fromMin = timeFrom ? toMinutes(timeFrom) : 0
  const toMin = timeTo ? toMinutes(timeTo) : 23 * 60 + 59

  return events.filter(event => {
    const dt = new Date(event.start_datetime)
    const londonTime = dt.toLocaleString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
    })
    const [h, m] = londonTime.split(':').map(Number)
    const eventMin = h * 60 + m
    return eventMin >= fromMin && eventMin <= toMin
  })
}

async function EventGrid({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const hasTimeFilter = !!(params.time_from || params.time_to)
  const wantsPicked = params.picked === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rpcBase = buildRpcBase(params)

  let savedIds = new Set<string>()
  let profile: PreferenceProfile = { categoryScore: {}, termScore: new Map(), interestTerms: [], hasSignal: false, dislikedEventIds: new Set() }

  if (user) {
    const [{ data: saved }, builtProfile] = await Promise.all([
      supabase.from('saved_events').select('event_id').eq('user_id', user.id),
      buildPreferenceProfile(supabase, user.id),
    ])
    savedIds = new Set((saved ?? []).map(s => s.event_id))
    profile = builtProfile
  }

  // "Picked for you" with nothing to learn from yet — point at the swipe deck.
  if (wantsPicked && !profile.hasSignal) {
    return (
      <div className="text-center py-24 max-w-sm mx-auto">
        <p className="font-serif text-3xl text-ink tracking-tight">we literally don&apos;t know you yet</p>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          swipe a few events so this filter has something to work with. takes 30 seconds.
        </p>
        <Link href="/taste" className="btn-primary inline-block mt-6">start swiping →</Link>
      </div>
    )
  }

  const score = (evs: Event[]): Event[] =>
    evs.map(ev => {
      const { score: matchScore, reason } = scoreEvent(ev, profile)
      return { ...ev, saved: savedIds.has(ev.id), match_score: matchScore, match_reason: reason ?? undefined }
    })

  let enriched: Event[]
  let count: number

  if (hasTimeFilter || wantsPicked) {
    // JS-side filters need the full pool before paginating
    const { data } = await supabase.rpc('get_unique_events', {
      ...rpcBase,
      p_limit: 1000,
      p_offset: 0,
    })
    let pool = score(displayAsOngoing((data ?? []) as Event[]))
    pool = filterByTimeOfDay(pool, params.time_from, params.time_to)
    if (wantsPicked) pool = pool.filter(ev => (ev.match_score ?? 0) > 0)
    pool.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    count = pool.length
    const offset = (page - 1) * PAGE_SIZE
    enriched = pool.slice(offset, offset + PAGE_SIZE)
  } else {
    const offset = (page - 1) * PAGE_SIZE
    const [{ data }, { data: countData }] = await Promise.all([
      supabase.rpc('get_unique_events', { ...rpcBase, p_limit: PAGE_SIZE, p_offset: offset }),
      supabase.rpc('count_unique_events', {
        p_from_time: rpcBase.p_from_time,
        p_to_time:   rpcBase.p_to_time,
        p_category:  rpcBase.p_category,
        p_is_free:   rpcBase.p_is_free,
        p_search:    rpcBase.p_search,
      }),
    ])
    enriched = score(displayAsOngoing((data ?? []) as Event[]))
    enriched.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    count = (countData as number) ?? 0
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)

  if (enriched.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="font-serif text-3xl text-ink tracking-tight">it&apos;s giving... nothing</p>
        <p className="text-muted text-sm mt-2">loosen a filter — london&apos;s got more than this, promise</p>
      </div>
    )
  }

  const urlParams = {
    category: params.category,
    date: params.date,
    free: params.free,
    search: params.search,
    view: params.view,
    from: params.from,
    time_from: params.time_from,
    time_to: params.time_to,
    picked: params.picked,
  }

  return (
    <>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-5">
        {count?.toLocaleString()} events · page {page} of {totalPages}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {enriched.map((event, i) => (
          <div key={event.id} className="tile-in" style={{ animationDelay: `${Math.min(i, 11) * 50}ms` }}>
            <EventCard event={event} initialSaved={event.saved} />
          </div>
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

async function EventMapWrapper({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const rpcBase = buildRpcBase(params)
  const wantsPicked = params.picked === 'true'

  const { data: events } = await supabase.rpc('get_unique_events', {
    ...rpcBase,
    p_limit: 500,
    p_offset: 0,
  })

  const displayed = displayAsOngoing((events ?? []) as Event[])
  let filtered = filterByTimeOfDay(displayed, params.time_from, params.time_to)

  if (wantsPicked) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const profile = await buildPreferenceProfile(supabase, user.id)
      if (profile.hasSignal) {
        filtered = filtered.filter(ev => scoreEvent(ev, profile).score > 0)
      }
    }
  }

  return <MapView events={filtered} totalCount={filtered.length} />
}

export default async function ExplorePage(props: PageProps) {
  const params = await props.searchParams
  const isMapView = params.view === 'map'

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8">
          <div className="mb-8">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em]">explore london</p>
            <h1 className="font-serif text-4xl sm:text-5xl text-ink tracking-tight mt-2">
              pick your poison<span className="text-accent">.</span>
            </h1>
            <p className="text-muted text-sm mt-2">search it, map it, filter it — sorted by what you actually like</p>
          </div>

          <div className="mb-6">
            <Suspense fallback={null}>
              <FilterBar />
            </Suspense>
          </div>

          <Suspense
            fallback={
              isMapView ? (
                <div className="skeleton w-full" style={{ height: '600px' }} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="skeleton h-72" />
                  ))}
                </div>
              )
            }
          >
            {isMapView
              ? <EventMapWrapper searchParams={props.searchParams} />
              : <EventGrid searchParams={props.searchParams} />
            }
          </Suspense>
        </div>
      </main>
    </div>
  )
}
