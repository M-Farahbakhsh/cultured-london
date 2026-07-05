import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Clock, ExternalLink, Users, BookmarkCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import CategoryChip from '@/components/CategoryChip'
import EventCard from '@/components/EventCard'
import type { Category, Event } from '@/lib/types'
import { formatDate, formatTime, formatPrice, decodeHtmlEntities } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

export default async function EventPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()
  if (!event) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  let saved = false
  let saveCount = 0
  let friendsSaved: string[] = []

  if (user) {
    const [{ data: mySave }, { count }, { data: friends }] = await Promise.all([
      supabase.from('saved_events').select('id').match({ user_id: user.id, event_id: id }).maybeSingle(),
      supabase.from('saved_events').select('*', { count: 'exact', head: true }).eq('event_id', id),
      supabase.from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted'),
    ])
    saved = !!mySave
    saveCount = count ?? 0

    // Check which friends saved this event
    if (friends && friends.length > 0) {
      const friendIds = friends.map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      )
      const { data: friendSaves } = await supabase
        .from('saved_events')
        .select('user_id, profiles!inner(username)')
        .eq('event_id', id)
        .in('user_id', friendIds)
      friendsSaved = (friendSaves ?? []).map((s: { profiles: { username: string }[] | { username: string } }) =>
        Array.isArray(s.profiles) ? s.profiles[0]?.username : (s.profiles as { username: string }).username
      ).filter(Boolean) as string[]
    }
  }

  // Related events (same category, upcoming)
  const { data: related = [] } = await supabase
    .from('events')
    .select('*')
    .overlaps('categories', event.categories ?? [])
    .neq('id', id)
    .gte('start_datetime', new Date().toISOString())
    .limit(3)

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8 max-w-4xl">
          <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6">
            <ArrowLeft size={15} /> Back to Explore
          </Link>

          {/* Header */}
          <div className="card overflow-hidden mb-6">
            <div className="h-56 bg-gradient-to-br from-purple-400 to-blue-600 relative">
              {event.image_url && (
                <img src={event.image_url} alt={decodeHtmlEntities(event.title)} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            <div className="p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                {(event.categories ?? []).map((cat: Category) => (
                  <CategoryChip key={cat} category={cat} />
                ))}
              </div>

              <h1 className="text-2xl font-bold text-ink mb-4">{decodeHtmlEntities(event.title)}</h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="flex items-start gap-2.5 text-sm">
                  <Calendar size={16} className="text-muted mt-0.5 shrink-0" />
                  <span>{formatDate(event.start_datetime)}</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <Clock size={16} className="text-muted mt-0.5 shrink-0" />
                  <span>{formatTime(event.start_datetime)}{event.end_datetime ? ` – ${formatTime(event.end_datetime)}` : ''}</span>
                </div>
                {event.venue_name && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin size={16} className="text-muted mt-0.5 shrink-0" />
                    <span>{event.venue_name}{event.venue_address ? `, ${event.venue_address}` : ''}</span>
                  </div>
                )}
                <div className="flex items-start gap-2.5 text-sm font-medium">
                  <span className="text-muted mt-0.5">£</span>
                  <span>{formatPrice(event.price_min, event.price_max, event.is_free)}</span>
                </div>
              </div>

              {/* Friends + save info */}
              {(saveCount > 0 || friendsSaved.length > 0) && (
                <div className="flex items-center gap-2 text-sm text-muted mb-5 pb-5 border-b border-border">
                  <Users size={15} />
                  <span>
                    {friendsSaved.length > 0
                      ? `${friendsSaved.slice(0, 2).join(', ')}${friendsSaved.length > 2 ? ` +${friendsSaved.length - 2}` : ''} saved this`
                      : `${saveCount} ${saveCount === 1 ? 'person' : 'people'} saved this`}
                  </span>
                  {saved && <span className="ml-2 flex items-center gap-1 text-accent"><BookmarkCheck size={14} /> Saved by you</span>}
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="prose prose-sm max-w-none text-ink/80 mb-5">
                  <p className="whitespace-pre-wrap">{decodeHtmlEntities(event.description)}</p>
                </div>
              )}

              {/* People */}
              {event.people?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">People</p>
                  <div className="flex flex-wrap gap-2">
                    {event.people.map((p: string) => (
                      <span key={p} className="text-sm bg-bg border border-border px-3 py-1 rounded-full">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {event.tags?.length > 0 && (
                <div className="mb-5">
                  <div className="flex flex-wrap gap-1.5">
                    {event.tags.map((t: string) => (
                      <span key={t} className="text-xs text-muted bg-bg border border-border px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {event.event_url && (
                <a href={event.event_url} target="_blank" rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2">
                  View event <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Related events */}
          {related && related.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-ink mb-4">You might also like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((ev: Event) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
