import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Moon, CalendarDays, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import EventCard from '@/components/EventCard'
import OnboardingNudge from '@/components/OnboardingNudge'
import type { Event } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { buildPreferenceProfile, rankEventsByPreference } from '@/lib/recommendations'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ justOnboarded?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const now = new Date().toISOString()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const farFuture = '2099-01-01T00:00:00Z'
  const soonEnd = new Date(today.getTime() + 3 * 86400000)

  const [
    { data: profile },
    { data: savedRaw },
    { data: soonRaw },
    { data: liveCount },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('saved_events').select('event_id').eq('user_id', user.id),
    supabase.rpc('get_unique_events', {
      p_from_time: now,
      p_to_time:   soonEnd.toISOString(),
      p_limit: 12, p_offset: 0,
    }),
    supabase.rpc('count_unique_events', {
      p_from_time: now,
      p_to_time:   farFuture,
      p_category:  null,
      p_is_free:   null,
      p_search:    null,
    }),
  ])

  // Picked for you — preference profile from interests + saved/attended history,
  // ranked against a pool of upcoming events. Falls back to soonest events until
  // the user has given us any signal.
  const prefProfile = await buildPreferenceProfile(supabase, user.id)
  // "Nah" in the taste deck is final — keep it out of every list on this page,
  // not just the scored/ranked one.
  const soonFiltered = ((soonRaw ?? []) as Event[]).filter(ev => !prefProfile.dislikedEventIds.has(ev.id))

  let pickedRaw: Event[] = []
  if (prefProfile.hasSignal) {
    const { data } = await supabase.rpc('get_unique_events', {
      p_from_time: now,
      p_to_time:   farFuture,
      p_limit: 200, p_offset: 0,
    })
    pickedRaw = rankEventsByPreference((data ?? []) as Event[], prefProfile)
      .filter(ev => (ev.match_score ?? 0) > 0)
      .slice(0, 9)
  }
  const personalized = pickedRaw.length > 0

  // Always fill the grid to 9 — back-fill personalized picks with soonest events
  const GRID_SIZE = 9
  if (pickedRaw.length > 0 && pickedRaw.length < GRID_SIZE) {
    const seen = new Set(pickedRaw.map(ev => ev.id))
    for (const ev of soonFiltered) {
      if (pickedRaw.length >= GRID_SIZE) break
      if (!seen.has(ev.id)) { pickedRaw.push(ev); seen.add(ev.id) }
    }
  }

  const savedIds = new Set((savedRaw ?? []).map((s: { event_id: string }) => s.event_id))

  // get_unique_events() matches on date-range overlap (start..end), so a months-long
  // running listing is correctly included while active — but its start_datetime is the
  // original, months-old date, which reads as stale on a card. Show today's date
  // (keeping the original time of day) for anything already underway.
  const nowDate = new Date(now)
  const displayAsOngoing = (evs: unknown[]) => (evs as Event[]).map(ev => {
    const start = new Date(ev.start_datetime)
    if (start >= nowDate) return ev
    const shifted = new Date()
    shifted.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0)
    return { ...ev, start_datetime: shifted.toISOString() }
  })
  const enrich = (evs: unknown[]) => displayAsOngoing(evs).map(ev => ({ ...ev, saved: savedIds.has(ev.id) }))

  const picked = enrich(personalized ? pickedRaw : soonFiltered.slice(0, 9))

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'

  const tickerItems = [
    `${(liveCount as number ?? 0).toLocaleString()} events on. zero excuses`,
    formatDate(new Date().toISOString()).toLowerCase(),
    'swipe right on your next obsession',
    'gigs · raves · galleries · comedy · everything',
    personalized ? 'your feed knows you now' : 'your feed is a blank canvas — swipe',
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="relative md:pl-56 pb-24 md:pb-8">
        <div className="page-container py-8">

          {params.justOnboarded && <OnboardingNudge />}

          {/* Masthead */}
          <div className="mb-6">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em]">
              {formatDate(new Date().toISOString())} · London
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-ink mt-2 tracking-tight">
              what&apos;s the move, <em>{firstName}</em><span className="text-accent">?</span>
            </h1>
          </div>

          {/* Live ticker — the city's pulse, straight from the database.
              The 88 to Dalston runs along the top: drives, stops, drives. */}
          <div className="relative mt-10 mb-12">
            <svg
              width="58" height="34" viewBox="0 0 58 34" aria-hidden
              className="bus-route absolute -top-[30px]"
            >
              {/* body */}
              <rect x="1" y="1" width="52" height="26" rx="4" fill="#E32017"/>
              {/* upper deck windows */}
              <rect x="5" y="4.5" width="7" height="6" rx="1.5" fill="#FFE8ED"/>
              <rect x="14.5" y="4.5" width="7" height="6" rx="1.5" fill="#FFE8ED"/>
              <rect x="24" y="4.5" width="7" height="6" rx="1.5" fill="#FFE8ED"/>
              {/* route blind */}
              <rect x="35" y="4.5" width="14" height="6" rx="1.5" fill="#1A1817"/>
              <text x="42" y="9.6" textAnchor="middle" fill="#FFFFFF" fontSize="5.5" fontWeight="700" fontFamily="Inter, sans-serif">88</text>
              {/* lower deck windows + door */}
              <rect x="5" y="14" width="7" height="6.5" rx="1.5" fill="#FFE8ED"/>
              <rect x="14.5" y="14" width="7" height="6.5" rx="1.5" fill="#FFE8ED"/>
              <rect x="24" y="14" width="7" height="6.5" rx="1.5" fill="#FFE8ED"/>
              <rect x="42" y="13" width="8" height="14" rx="1.5" fill="#FFE8ED"/>
              {/* wheels */}
              <circle cx="13" cy="28.5" r="4.5" fill="#1A1817"/>
              <circle cx="13" cy="28.5" r="1.8" fill="#FFFFFF"/>
              <circle cx="42" cy="28.5" r="4.5" fill="#1A1817"/>
              <circle cx="42" cy="28.5" r="1.8" fill="#FFFFFF"/>
            </svg>

            <div className="ticker rounded-full bg-ink text-white overflow-hidden -rotate-[0.5deg] shadow-[5px_5px_0_0_#E32017]">
            <div className="ticker-track inline-flex whitespace-nowrap items-center py-1.5">
              {[0, 1].map(copy => (
                <span key={copy} className="inline-flex items-center">
                  {tickerItems.map((item, i) => (
                    <span key={i} className="inline-flex items-center">
                      <span className="mx-5 text-accent text-[13px]">✦</span>
                      {i % 2 === 1 ? (
                        <span className="font-serif italic text-accent text-[17px] tracking-normal">{item}</span>
                      ) : (
                        <span className="text-[12px] font-semibold lowercase tracking-[0.12em]">{item}</span>
                      )}
                    </span>
                  ))}
                </span>
              ))}
            </div>
            </div>
          </div>

          {/* The one question: when are you free? */}
          <div className="grid sm:grid-cols-3 gap-4 mb-14">
            <Link
              href="/explore?date=today"
              className="group rounded-2xl bg-ink text-white p-6 sm:p-7 flex flex-col justify-between min-h-[150px] transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <Moon size={22} className="text-accent" />
              <div className="mt-6">
                <p className="font-serif text-2xl tracking-tight">tonight</p>
                <p className="text-sm text-white/55 mt-1 flex items-center gap-1.5">
                  no plans? fix that
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </p>
              </div>
            </Link>

            <Link
              href="/explore?date=this_weekend"
              className="group rounded-2xl bg-accent text-white p-6 sm:p-7 flex flex-col justify-between min-h-[150px] transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <CalendarDays size={22} className="text-white/70" />
              <div className="mt-6">
                <p className="font-serif text-2xl tracking-tight">this weekend</p>
                <p className="text-sm text-white/70 mt-1 flex items-center gap-1.5">
                  main character hours
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </p>
              </div>
            </Link>

            <Link
              href="/explore?free=true"
              className="group rounded-2xl bg-surface border border-border p-6 sm:p-7 flex flex-col justify-between min-h-[150px] transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <Ticket size={22} className="text-accent" />
              <div className="mt-6">
                <p className="font-serif text-2xl tracking-tight text-ink">free</p>
                <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                  £0. still a vibe
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </p>
              </div>
            </Link>
          </div>

          {/* Taste prompt — only until we have any signal to learn from */}
          {!prefProfile.hasSignal && (
            <div className="mb-14 p-6 sm:p-8 rounded-2xl bg-ink text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <p className="font-serif text-xl tracking-tight">
                  your feed is a blank canvas <span className="text-accent">✦</span>
                </p>
                <p className="text-sm text-white/60 mt-1.5 max-w-md leading-relaxed">
                  30 seconds of swiping and it just <em>gets</em> you. every pick comes
                  with a receipt — no black-box algorithm.
                </p>
              </div>
              <Link href="/taste" className="btn-primary shrink-0">
                start swiping →
              </Link>
            </div>
          )}

          {/* One feed. Vertical. No sideways scrolling. */}
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="section-title">
                {personalized ? 'your picks just dropped' : 'happening soon'}
                <span className="text-accent">.</span>
              </h2>
              <p className="text-sm text-muted mt-1">
                {personalized
                  ? 'trained on your swipes — every card shows its receipts. no black box'
                  : 'fresh from the city — swipe a few and watch this page glow up'}
              </p>
            </div>
            <Link
              href={personalized ? '/explore?picked=true' : '/explore'}
              className="text-sm text-accent hover:underline font-medium shrink-0 ml-4"
            >
              {personalized ? 'the full drop →' : 'explore all →'}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {picked.map((event, i) => (
              <div key={event.id} className="tile-in" style={{ animationDelay: `${i * 60}ms` }}>
                <EventCard event={event} initialSaved={!!event.saved} />
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  )
}
