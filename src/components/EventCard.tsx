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
    // A <button> can't validly nest inside the <a> that Link renders — browsers
    // repair that invalid HTML during parsing, which no longer matches what React
    // hydrates against. The full-card Link now sits as an absolutely-positioned
    // sibling instead, with everything else pointer-events-none so clicks fall
    // through to it, except the save button which stays independently clickable.
    <div className="card group relative">
      <Link href={`/events/${event.id}`} className="absolute inset-0 z-0" aria-label={event.title} />

      {/* Image / gradient header */}
      <div className="relative h-44 overflow-hidden pointer-events-none">
        {event.image_url && !imgFailed ? (
          <img
            src={event.image_url}
            alt={event.title}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-90 group-hover:scale-[1.04] transition-transform duration-500 ease-out`} />
        )}

        {/* Soft bottom gradient so chips always read against photos */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />

        {/* Category chips */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
          {event.categories?.slice(0, 2).map(cat => (
            <CategoryChip key={cat} category={cat as Category} small />
          ))}
        </div>
      </div>

      {/* Save button — sibling of the Link, not nested inside it */}
      <button
        onClick={toggleSave}
        disabled={saving}
        className="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur rounded-full
                   flex items-center justify-center shadow-sm hover:bg-white hover:scale-105
                   active:scale-95 transition-all duration-150"
        title={saved ? 'Remove from saved' : 'Save event'}
      >
        {saved
          ? <BookmarkCheck size={16} className="text-accent" />
          : <Bookmark size={16} className="text-ink" />}
      </button>

      {/* Content */}
      <div className="p-4 pointer-events-none">
        <h3 className="font-serif text-[17px] text-ink leading-snug line-clamp-2 mb-2.5 group-hover:text-accent transition-colors duration-150">
          {event.title}
        </h3>

        <div className="space-y-1 text-xs text-muted">
          <p className="font-medium text-ink/80 uppercase tracking-wide text-[11px]">
            {formatDate(event.start_datetime)} · {formatTime(event.start_datetime)}
          </p>
          {event.venue_name && (
            <p className="truncate">{event.venue_name}{event.area ? ` · ${event.area}` : ''}</p>
          )}
          <p className="font-semibold text-ink/70">
            {formatPrice(event.price_min, event.price_max, event.is_free)}
          </p>
        </div>

        {/* Match reason — the personalization signal, styled as a quiet endorsement */}
        {event.match_reason && (
          <div className="mt-3 flex items-start gap-1.5 text-xs text-accent bg-accent-soft rounded-lg px-2.5 py-2">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            <span className="font-medium">{event.match_reason}</span>
          </div>
        )}

        {/* Hover preview — slides in on desktop hover */}
        {(event.description || (event.people && event.people.length > 0) || (event.tags && event.tags.length > 0)) && (
          <div className="overflow-hidden max-h-0 group-hover:max-h-32 transition-all duration-300 ease-out">
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
    </div>
  )
}
