'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Music, BookOpen, Lightbulb, Calendar, ArrowRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InterestPicker from '@/components/InterestPicker'
import type { Interest, InterestType } from '@/lib/types'

const EVENT_TYPES = [
  { value: 'music', label: 'Live Music & Gigs' },
  { value: 'art', label: 'Art & Exhibitions' },
  { value: 'talk', label: 'Talks & Lectures' },
  { value: 'film', label: 'Film Screenings' },
  { value: 'tech', label: 'Tech & AI Events' },
  { value: 'literature', label: 'Books & Literature' },
  { value: 'theatre', label: 'Theatre & Performance' },
  { value: 'comedy', label: 'Comedy' },
]

const STEPS = [
  { id: 1, title: 'Music', subtitle: 'Which artists and genres do you love?', icon: Music },
  { id: 2, title: 'Books & Authors', subtitle: 'Who do you read?', icon: BookOpen },
  { id: 3, title: 'Ideas & People', subtitle: 'Thinkers, topics, and subjects you follow', icon: Lightbulb },
  { id: 4, title: 'Event types', subtitle: 'What kinds of events do you want to discover?', icon: Calendar },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [interests, setInterests] = useState<Interest[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const forStep: Record<number, InterestType> = { 1: 'artist', 2: 'author', 3: 'topic' }
  const stepInterests = interests.filter(i => i.type === forStep[step])

  const addInterest = async (name: string, metadata?: Record<string, unknown>) => {
    if (!userId) return
    const type = forStep[step]
    if (!type) return
    const { data, error } = await supabase
      .from('interests')
      .insert({ user_id: userId, type, name, metadata: metadata ?? {} })
      .select()
      .single()
    if (!error && data) setInterests(prev => [...prev, data])
  }

  const removeInterest = async (id: string) => {
    await supabase.from('interests').delete().eq('id', id)
    setInterests(prev => prev.filter(i => i.id !== id))
  }

  const toggleType = (val: string) => {
    setSelectedTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val])
  }

  const finish = async () => {
    if (!userId) return
    // Save event type preferences as genre interests
    for (const t of selectedTypes) {
      await supabase.from('interests')
        .upsert({ user_id: userId, type: 'genre', name: t, metadata: {} }, { onConflict: 'user_id,type,name' })
    }
    router.push('/explore')
  }

  const StepIcon = STEPS[step - 1].icon
  const progress = ((step - 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Step {step} of {STEPS.length}</span>
            <span className="text-xs text-muted">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="card p-8">
          {/* Step header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <StepIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">{STEPS[step - 1].title}</h2>
              <p className="text-sm text-muted">{STEPS[step - 1].subtitle}</p>
            </div>
          </div>

          <div className="mt-6 min-h-[200px]">
            {step === 1 && (
              <InterestPicker
                type="artist"
                label="Artists & musicians"
                placeholder="Search: Radiohead, Brian Eno, Floating Points..."
                interests={stepInterests}
                onAdd={addInterest}
                onRemove={removeInterest}
              />
            )}
            {step === 2 && (
              <InterestPicker
                type="author"
                label="Authors & writers"
                placeholder="Search: Zadie Smith, Ted Chiang, Robin Wall Kimmerer..."
                interests={stepInterests}
                onAdd={addInterest}
                onRemove={removeInterest}
              />
            )}
            {step === 3 && (
              <InterestPicker
                type="topic"
                label="Topics, thinkers & ideas"
                placeholder="Type anything: AI safety, consciousness, dark matter..."
                interests={stepInterests}
                onAdd={addInterest}
                onRemove={removeInterest}
              />
            )}
            {step === 4 && (
              <div>
                <p className="text-sm text-muted mb-4">Select all that interest you</p>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map(({ value, label }) => {
                    const selected = selectedTypes.includes(value)
                    return (
                      <button
                        key={value}
                        onClick={() => toggleType(value)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left
                          ${selected
                            ? 'border-accent bg-accent/5 text-accent'
                            : 'border-border text-muted hover:border-ink/30 hover:text-ink'}`}
                      >
                        {selected && <Check size={14} className="shrink-0" />}
                        {!selected && <span className="w-3.5 h-3.5 border border-border rounded shrink-0" />}
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="btn-ghost">Back</button>
            ) : (
              <button onClick={() => router.push('/explore')} className="btn-ghost text-muted">
                Skip all
              </button>
            )}

            {step < STEPS.length ? (
              <button onClick={() => setStep(s => s + 1)} className="btn-primary flex items-center gap-2">
                Next <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={finish} className="btn-primary flex items-center gap-2">
                Start exploring <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
