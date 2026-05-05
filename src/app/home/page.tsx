import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import EventRow from '@/components/EventRow'
import type { Event } from '@/lib/types'
import { getDateRange, formatDate } from '@/lib/utils'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const now = new Date().toISOString()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const farFuture = '2099-01-01T00:00:00Z'
  const weekendRange = getDateRange('this_weekend')
  const weekEnd = new Date(today.getTime() + 7 * 86400000)
  const soonEnd = new Date(today.getTime() + 3 * 86400000)

  const [
    { data: profile },
    { data: interests },
    { data: savedRaw },
    { data: weekendRaw },
    { data: freeRaw },
    { data: soonRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('interests').select('name, type').eq('user_id', user.id).limit(10),
    supabase.from('saved_events').select('event_id').eq('user_id', user.id),
    supabase.rpc('get_unique_events', {
      p_from_time: weekendRange.from.toISOString(),
      p_to_time:   weekendRange.to.toISOString(),
      p_limit: 10, p_offset: 0,
    }),
    supabase.rpc('get_unique_events', {
      p_from_time: now,
      p_to_time:   weekEnd.toISOString(),
      p_is_free:   true,
      p_limit: 10, p_offset: 0,
    }),
    supabase.rpc('get_unique_events', {
      p_from_time: now,
      p_to_time:   soonEnd.toISOString(),
      p_limit: 10, p_offset: 0,
    }),
  ])

  // For You — sequential because it needs interests
  let forYouRaw: Event[] = []
  const interestNames = (interests ?? []).map(i => i.name)
  if (interestNames.length > 0) {
    const { data } = await supabase.rpc('get_unique_events', {
      p_from_time: now,
      p_to_time:   farFuture,
      p_search:    interestNames[0],
      p_limit: 10, p_offset: 0,
    })
    forYouRaw = (data ?? []) as Event[]
  }

  const savedIds = new Set((savedRaw ?? []).map((s: { event_id: string }) => s.event_id))
  const enrich = (evs: unknown[]) => (evs as Event[]).map(ev => ({ ...ev, saved: savedIds.has(ev.id) }))

  const weekendEvents = enrich(weekendRaw ?? [])
  const freeEvents    = enrich(freeRaw ?? [])
  const soonEvents    = enrich(soonRaw ?? [])
  const forYouEvents  = enrich(forYouRaw)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const topInterest = interestNames[0]

  const QUICK_LINKS = [
    { label: 'All events',       href: '/explore' },
    { label: 'This weekend',     href: '/explore?date=this_weekend' },
    { label: 'Free events',      href: '/explore?free=true' },
    { label: 'Music',            href: '/explore?category=music' },
    { label: 'Art & exhibitions',href: '/explore?category=art' },
    { label: 'Talks & ideas',    href: '/explore?category=talk' },
    { label: 'Tech',             href: '/explore?category=tech' },
    { label: 'Film',             href: '/explore?category=film' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-24 md:pb-8">
        <div className="page-container py-8">

          {/* Greeting */}
          <div className="mb-8">
            <p className="text-muted text-sm">{formatDate(new Date().toISOString())} · London</p>
            <h1 className="text-3xl font-bold text-ink mt-1">{greeting}, {firstName}</h1>
            <p className="text-muted mt-1 text-sm">Here's what's on in London for you</p>
          </div>

          {/* Quick filter links */}
          <div className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
            {QUICK_LINKS.map(({ label, href }) => (
              <Link key={href} href={href}
                className="text-sm px-3.5 py-1.5 rounded-full border border-border bg-surface text-ink hover:border-accent hover:text-accent transition-colors whitespace-nowrap shrink-0">
                {label}
              </Link>
            ))}
          </div>

          {/* This Weekend */}
          <EventRow
            title="This Weekend"
            subtitle="Events happening Saturday & Sunday"
            events={weekendEvents}
            seeAllHref="/explore?date=this_weekend"
          />

          {/* For You */}
          {forYouEvents.length > 0 ? (
            <EventRow
              title="For You"
              subtitle={topInterest ? `Based on your interest in ${topInterest}` : 'Matched to your taste'}
              events={forYouEvents}
              seeAllHref={topInterest ? `/explore?search=${encodeURIComponent(topInterest)}` : '/explore'}
            />
          ) : interestNames.length === 0 ? (
            <div className="mb-10 p-6 rounded-xl border border-dashed border-border bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Set up your taste profile</p>
                <p className="text-xs text-muted mt-1 max-w-sm">
                  Tell us who you love — artists, authors, ideas — and we'll find events matched to you.
                </p>
              </div>
              <Link href="/profile" className="btn-primary text-sm py-2 px-4 shrink-0">
                Add interests →
              </Link>
            </div>
          ) : null}

          {/* Free This Week */}
          <EventRow
            title="Free This Week"
            subtitle="Great events, no ticket needed"
            events={freeEvents}
            seeAllHref="/explore?free=true&date=this_week"
          />

          {/* Happening Soon */}
          <EventRow
            title="Happening Soon"
            subtitle="Starting in the next few days"
            events={soonEvents}
            seeAllHref="/explore"
          />

          {/* Explore CTA */}
          <div className="mt-6 pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">Want to see everything?</p>
              <p className="text-xs text-muted mt-0.5">Browse all events with full search and filters</p>
            </div>
            <Link href="/explore" className="btn-primary flex items-center gap-2 text-sm py-2 px-4 shrink-0">
              <Compass size={15} />
              Explore all events
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
