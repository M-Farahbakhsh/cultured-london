'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InterestPicker from '@/components/InterestPicker'
import type { Interest } from '@/lib/types'

// One screen, zero required typing. Tapping tiles IS building your feed —
// the Pinterest onboarding pattern. Genre tiles map straight onto event
// categories; scene tiles become topic interests for tag/people matching.
const TASTE_TILES: { emoji: string; label: string; type: 'genre' | 'topic'; name: string; gradient: string }[] = [
  { emoji: '🎸', label: 'Live music',        type: 'genre', name: 'music',       gradient: 'from-purple-500 to-purple-700' },
  { emoji: '🤖', label: 'Tech & AI',         type: 'genre', name: 'tech',        gradient: 'from-orange-500 to-orange-700' },
  { emoji: '🎨', label: 'Art & exhibitions', type: 'genre', name: 'art',         gradient: 'from-rose-500 to-rose-700' },
  { emoji: '😂', label: 'Comedy',            type: 'genre', name: 'comedy',      gradient: 'from-amber-500 to-amber-600' },
  { emoji: '🎤', label: 'Talks & ideas',     type: 'genre', name: 'talk',        gradient: 'from-blue-500 to-blue-700' },
  { emoji: '🎬', label: 'Film',              type: 'genre', name: 'film',        gradient: 'from-teal-500 to-teal-700' },
  { emoji: '🎭', label: 'Theatre',           type: 'genre', name: 'theatre',     gradient: 'from-pink-500 to-pink-700' },
  { emoji: '📚', label: 'Books & writing',   type: 'genre', name: 'literature',  gradient: 'from-green-600 to-green-800' },
  { emoji: '🏆', label: 'Sports',            type: 'genre', name: 'sports',      gradient: 'from-sky-500 to-sky-700' },
  { emoji: '🎷', label: 'Jazz nights',       type: 'topic', name: 'jazz',        gradient: 'from-indigo-500 to-indigo-700' },
  { emoji: '🪩', label: 'Club nights',       type: 'topic', name: 'club',        gradient: 'from-fuchsia-500 to-fuchsia-700' },
  { emoji: '🚀', label: 'Startups',          type: 'topic', name: 'startup',     gradient: 'from-slate-600 to-slate-800' },
  { emoji: '🧠', label: 'AI & science',      type: 'topic', name: 'ai',          gradient: 'from-cyan-600 to-cyan-800' },
  { emoji: '🍜', label: 'Food & markets',    type: 'topic', name: 'food',        gradient: 'from-red-500 to-red-700' },
  { emoji: '📷', label: 'Photography',       type: 'topic', name: 'photography', gradient: 'from-stone-500 to-stone-700' },
  { emoji: '✒️', label: 'Poetry & spoken word', type: 'topic', name: 'poetry',   gradient: 'from-violet-500 to-violet-700' },
  { emoji: '🎻', label: 'Classical',         type: 'topic', name: 'classical',   gradient: 'from-yellow-600 to-yellow-800' },
  { emoji: '💃', label: 'Dance',             type: 'topic', name: 'dance',       gradient: 'from-orange-400 to-rose-500' },
  { emoji: '🌱', label: 'Wellness & outdoors', type: 'topic', name: 'wellness',  gradient: 'from-emerald-500 to-emerald-700' },
  { emoji: '🏛️', label: 'History & heritage', type: 'topic', name: 'history',   gradient: 'from-amber-700 to-amber-900' },
  { emoji: '🎮', label: 'Gaming',            type: 'topic', name: 'gaming',      gradient: 'from-blue-600 to-indigo-800' },
]

const MIN_PICKS = 3

export default function OnboardingPage() {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [specific, setSpecific] = useState<Interest[]>([])
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const toggle = (name: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const addSpecific = async (name: string, metadata?: Record<string, unknown>) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('interests')
      .insert({ user_id: userId, type: 'artist', name, metadata: metadata ?? {} })
      .select()
      .single()
    if (!error && data) setSpecific(prev => [...prev, data])
  }

  const removeSpecific = async (id: string) => {
    await supabase.from('interests').delete().eq('id', id)
    setSpecific(prev => prev.filter(i => i.id !== id))
  }

  const finish = async () => {
    if (!userId || picked.size < MIN_PICKS) return
    setSaving(true)
    const rows = TASTE_TILES
      .filter(t => picked.has(t.name))
      .map(t => ({ user_id: userId, type: t.type, name: t.name, metadata: {} }))
    await supabase.from('interests').upsert(rows, { onConflict: 'user_id,type,name' })
    router.push('/home?justOnboarded=1')
    router.refresh()
  }

  const count = picked.size
  const ready = count >= MIN_PICKS

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-40">

        {/* Masthead */}
        <div className="mb-10 text-center">
          <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em]">Cultured LDN</p>
          <h1 className="font-serif text-4xl sm:text-5xl text-ink tracking-tight mt-3">
            What gets you<br className="sm:hidden" /> out of the house?
          </h1>
          <p className="text-muted mt-3 max-w-md mx-auto">
            Tap anything that sounds like a good night. Every tap sharpens your feed.
          </p>
        </div>

        {/* The taste wall */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {TASTE_TILES.map((tile, i) => {
            const selected = picked.has(tile.name)
            return (
              <button
                key={tile.name}
                onClick={() => toggle(tile.name)}
                style={{ animationDelay: `${i * 35}ms` }}
                className={`tile-in relative rounded-2xl p-4 h-28 sm:h-32 text-left overflow-hidden
                            bg-gradient-to-br ${tile.gradient} transition-all duration-200 ease-out
                            ${selected
                              ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-bg scale-[0.97]'
                              : 'hover:scale-[1.03] hover:shadow-card-hover opacity-90 hover:opacity-100'}`}
              >
                <span className="text-2xl sm:text-3xl block">{tile.emoji}</span>
                <span className="absolute bottom-3 left-4 right-3 text-white font-semibold text-sm leading-tight drop-shadow">
                  {tile.label}
                </span>
                {selected && (
                  <span className="absolute top-2.5 right-2.5 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                    <Check size={14} className="text-accent" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Optional: someone specific */}
        <div className="mt-12">
          <p className="font-serif text-xl text-ink tracking-tight mb-1">Anyone specific?</p>
          <p className="text-sm text-muted mb-4">
            Optional — name an artist, author or thinker you&apos;d cross town for.
          </p>
          <InterestPicker
            type="artist"
            label=""
            placeholder="Radiohead, Zadie Smith, Brian Eno..."
            interests={specific}
            onAdd={addSpecific}
            onRemove={removeSpecific}
          />
        </div>
      </div>

      {/* Sticky action bar — progress you can feel */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MIN_PICKS }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${i < count ? 'bg-accent' : 'bg-border'}`}
                />
              ))}
              {count > MIN_PICKS && (
                <span className="text-xs text-accent font-semibold ml-1">+{count - MIN_PICKS}</span>
              )}
            </div>
            <p className="text-xs text-muted mt-1.5">
              {ready
                ? `${count} picked — your feed is ready`
                : `Pick ${MIN_PICKS - count} more to build your feed`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => router.push('/home')} className="btn-ghost text-sm">
              Skip
            </button>
            <button
              onClick={finish}
              disabled={!ready || saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? 'Building...' : 'Build my feed'} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
