'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { Heart, X, ArrowRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, formatPrice, CATEGORY_META, decodeHtmlEntities } from '@/lib/utils'
import type { Event, Category } from '@/lib/types'

const SWIPE_THRESHOLD = 120

function SwipeCard({
  event,
  onSwipe,
}: {
  event: Event
  onSwipe: (dir: 1 | -1) => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-18, 18])
  const likeOpacity = useTransform(x, [40, SWIPE_THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, -40], [1, 0])

  const category = (event.categories?.[0] ?? 'other') as Category
  const meta = CATEGORY_META[category]

  return (
    <motion.div
      className="absolute inset-0 rounded-3xl overflow-hidden shadow-card-hover cursor-grab active:cursor-grabbing select-none bg-ink"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_THRESHOLD) onSwipe(1)
        else if (info.offset.x < -SWIPE_THRESHOLD) onSwipe(-1)
      }}
      // Exit direction comes from AnimatePresence's `custom` prop — reading a
      // state prop here would capture the previous render's value, sending the
      // card off the wrong side when the buttons are used.
      variants={{
        enter: { scale: 0.96, y: 12, opacity: 0.8 },
        center: { scale: 1, y: 0, opacity: 1 },
        exit: (dir: number) => ({
          x: (dir || 1) * 640,
          rotate: (dir || 1) * 24,
          opacity: 0,
          transition: { duration: 0.32, ease: 'easeIn' },
        }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {event.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt={decodeHtmlEntities(event.title)}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-600 to-stone-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20 pointer-events-none" />

      {/* Swipe verdict stamps */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-6 rotate-[-14deg] border-[3px] border-pop text-pop rounded-xl px-4 py-1.5 font-black text-2xl tracking-widest pointer-events-none"
      >
        INTO IT
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-8 right-6 rotate-[14deg] border-[3px] border-rose-400 text-rose-300 rounded-xl px-4 py-1.5 font-black text-2xl tracking-widest pointer-events-none"
      >
        NAH
      </motion.div>

      {/* Event info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
        <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3 ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
        <h3 className="font-serif text-2xl sm:text-3xl text-white tracking-tight leading-tight line-clamp-3 drop-shadow">
          {decodeHtmlEntities(event.title)}
        </h3>
        <p className="text-white/75 text-sm mt-2.5">
          {formatDate(event.start_datetime)} · {formatTime(event.start_datetime)}
          {event.venue_name ? ` · ${event.venue_name}` : ''}
        </p>
        <p className="text-white/60 text-sm mt-0.5 font-medium">
          {formatPrice(event.price_min, event.price_max, event.is_free)}
        </p>
      </div>
    </motion.div>
  )
}

export default function TasteDeck({ events, userId }: { events: Event[]; userId: string }) {
  const [index, setIndex] = useState(0)
  const [likedCount, setLikedCount] = useState(0)
  const [exitDir, setExitDir] = useState<1 | -1>(1)
  const supabase = createClient()

  const current = events[index]
  const upNext = events[index + 1]
  const done = index >= events.length

  const swipe = (dir: 1 | -1) => {
    if (!current) return
    setExitDir(dir)
    // NB: the supabase builder only executes when awaited/.then'd — a bare
    // `void` discards it without ever sending the request.
    if (dir === 1) {
      setLikedCount(c => c + 1)
      // A right swipe is a save, which the recommender reads directly.
      supabase
        .from('saved_events')
        .insert({ user_id: userId, event_id: current.id })
        .then(({ error }) => {
          if (error) console.error('Failed to save liked event:', error.message)
        })
    } else {
      // A left swipe used to vanish with no record at all — meaning a "nah"
      // could resurface as a recommendation later. Now it's remembered so
      // this exact event is excluded going forward and its category/tags
      // get pushed down in future ranking.
      supabase
        .from('disliked_events')
        .upsert({ user_id: userId, event_id: current.id }, { onConflict: 'user_id,event_id', ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) console.error('Failed to record disliked event:', error.message)
        })
    }
    setIndex(i => i + 1)
  }

  if (done) {
    return (
      <div className="text-center py-16 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-6">
          <Sparkles size={26} className="text-accent" />
        </div>
        <h2 className="font-serif text-3xl text-ink tracking-tight">
          {likedCount > 0 ? 'your feed gets you now' : 'picky. respect.'}
        </h2>
        <p className="text-muted mt-3 leading-relaxed">
          {likedCount > 0
            ? `${likedCount} ${likedCount === 1 ? 'like' : 'likes'} locked in — saved, learned from, and everything you see now is ranked off them.`
            : 'nothing hit this round — run it back or go dig through explore yourself.'}
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          {/* Plain anchor forces a full server render — a fresh deck, minus what you just saved */}
          <a href="/taste" className="btn-secondary">run it back</a>
          <Link href="/home" className="btn-primary inline-flex items-center gap-2">
            show me my feed <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">
          {index + 1} of {events.length}
        </p>
        <p className="text-xs text-accent font-semibold">{likedCount} {likedCount === 1 ? 'like' : 'likes'} ✦</p>
      </div>

      {/* The deck */}
      <div className="relative h-[480px] sm:h-[540px]">
        {/* Peek of the next card */}
        {upNext && (
          <div className="absolute inset-0 rounded-3xl overflow-hidden scale-[0.96] translate-y-3 opacity-60 bg-ink">
            {upNext.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={upNext.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/40" />
          </div>
        )}

        <AnimatePresence mode="popLayout" custom={exitDir}>
          {current && (
            <SwipeCard key={current.id} event={current} onSwipe={swipe} />
          )}
        </AnimatePresence>
      </div>

      {/* Buttons — judges demo on laptops, so clicking must feel as good as swiping */}
      <div className="flex items-center justify-center gap-8 mt-6">
        <button
          onClick={() => swipe(-1)}
          className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center
                     text-muted hover:text-rose-500 hover:border-rose-300 hover:scale-110 active:scale-95
                     transition-all duration-150 shadow-card"
          title="Not for me"
        >
          <X size={26} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => swipe(1)}
          className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white
                     hover:bg-accent-dark hover:scale-110 active:scale-95 transition-all duration-150 shadow-card-hover"
          title="Into it"
        >
          <Heart size={26} strokeWidth={2.5} fill="currentColor" />
        </button>
      </div>
      <p className="text-center text-xs text-muted mt-4">drag it or tap it — dealer&apos;s choice</p>
    </div>
  )
}
