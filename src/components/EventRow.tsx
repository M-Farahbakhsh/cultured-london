import Link from 'next/link'
import EventCard from './EventCard'
import type { Event } from '@/lib/types'

interface Props {
  title: string
  subtitle?: string
  events: Event[]
  seeAllHref?: string
}

export default function EventRow({ title, subtitle, events, seeAllHref }: Props) {
  if (!events.length) return null
  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-sm text-accent hover:underline font-medium shrink-0 ml-4">
            See all →
          </Link>
        )}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {events.map(event => (
          <div key={event.id} className="w-[270px] shrink-0">
            <EventCard event={event} initialSaved={!!event.saved} />
          </div>
        ))}
      </div>
    </section>
  )
}
