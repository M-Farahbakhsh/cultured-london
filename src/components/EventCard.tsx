'use client'
import Link from 'next/link'

import { Bookmark, BookmarkCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Event, Category } from '@/lib/types'
import { CATEGORY_GRADIENTS, formatDate, formatTime, formatPrice } from '@/lib/utils'
import CategoryChip from './CategoryChip'
import { createClient } from '@/lib/supabase/client'

interface Props {
  event: Event
  initialSaved?: boolean
}

export default function EventCard({ event, initialSaved = false }: Props) {
  const [saved, setSaved] = useState(initialSaved || event.saved || false)
  const [saving, setSaving] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const supabase = createClient()

  const primaryCategory = (event.categories?.[0] ?? 'other') as Category
  const gradient = CATEGORY_GRADIENTS[primaryCategory]

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (saved) {
      await supabase.from('saved_events').delete()
        .match({ user_id: user.id, event_id: event.id })
      setSaved(false)
    } else {
      await supabase.from('saved_events').insert({ user_id: user.id, event_id: event.id })
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <Link href={`/events/${event.id}`} className="card group block">
      {/* Image / gradient header */}
      <div className="relative h-40 overflow-hidden">
        {event.image_url && !imgFailed ? (
          <img
            src={event.image_url}
            alt={event.title}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-90`} />
        )}

        {/* Save button */}
        <button
          onClick={toggleSave}
          disabled={saving}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full
                     flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          title={saved ? 'Remove from saved' : 'Save event'}
        >
          {saved
            ? <BookmarkCheck size={15} className="text-accent" />
            : <Bookmark size={15} className="text-ink" />}
        </button>

        {/* Category chips */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
          {event.categories?.slice(0, 2).map(cat => (
            <CategoryChip key={cat} category={cat as Category} small />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-2 mb-2">
          {event.title}
        </h3>

        <div className="space-y-1 text-xs text-muted">
          <p>{formatDate(event.start_datetime)} · {formatTime(event.start_datetime)}</p>
          {event.venue_name && (
            <p className="truncate">{event.venue_name}{event.area ? ` · ${event.area}` : ''}</p>
          )}
          <p className="font-medium text-ink/70">
            {formatPrice(event.price_min, event.price_max, event.is_free)}
          </p>
        </div>

        {/* Match reason */}
        {event.match_reason && (
          <div className="mt-3 flex items-start gap-1.5 text-xs text-accent bg-accent/5 rounded-lg px-2.5 py-2">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            <span>{event.match_reason}</span>
          </div>
        )}

        {/* Hover preview — slides in on desktop hover */}
        {(event.description || (event.people && event.people.length > 0) || (event.tags && event.tags.length > 0)) && (
          <div className="overflow-hidden max-h-0 group-hover:max-h-32 transition-all duration-200 ease-out">
            <div className="pt-2.5 mt-2.5 border-t border-border">
              {event.description ? (
                <p className="text-xs text-muted line-clamp-3 leading-relaxed">{event.description}</p>
              ) : (
                <div className="space-y-1">
                  {event.people && event.people.length > 0 && (
                    <p className="text-xs text-muted">With {event.people.slice(0, 3).join(', ')}</p>
                  )}
                  {event.tags && event.tags.length > 0 && (
                    <p className="text-xs text-muted/60">{event.tags.slice(0, 5).map(t => `#${t}`).join(' ')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
