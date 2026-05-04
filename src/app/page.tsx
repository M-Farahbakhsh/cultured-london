'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, Sparkles } from 'lucide-react'

type Mode = 'signin' | 'signup'

const PREVIEW_EVENTS = [
  { title: 'Brian Eno: Ambient Music & AI', venue: 'Barbican', category: 'Music', color: 'from-purple-500 to-purple-700' },
  { title: 'Zadie Smith in Conversation', venue: 'British Library', category: 'Talk', color: 'from-blue-500 to-blue-700' },
  { title: 'Tarkovsky Retrospective: Stalker', venue: 'BFI', category: 'Film', color: 'from-teal-500 to-teal-700' },
  { title: 'Ted Chiang: Stories of Your Life', venue: 'Foyles', category: 'Literature', color: 'from-green-500 to-green-700' },
  { title: 'Digital Wilderness Exhibition', venue: 'Serpentine', category: 'Art', color: 'from-rose-500 to-rose-700' },
  { title: 'London AI Safety Meetup', venue: 'Shoreditch', category: 'Tech', color: 'from-orange-500 to-orange-700' },
]

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } },
      })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/onboarding')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/explore')
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left: preview */}
      <div className="hidden lg:flex flex-1 flex-col p-12 bg-ink text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-16">
            <span className="text-2xl font-bold">Cultured</span>
            <span className="text-xs bg-white text-ink px-2 py-0.5 rounded font-semibold">LDN</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            London's events.<br />Finally, for you.
          </h1>
          <p className="text-white/60 text-lg mb-12 max-w-md">
            AI talks, book launches, concerts, art shows — discovered through your taste in
            music, books, film, and ideas.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {PREVIEW_EVENTS.map(ev => (
              <div key={ev.title} className="rounded-xl overflow-hidden">
                <div className={`bg-gradient-to-br ${ev.color} p-4 h-24 flex flex-col justify-end`}>
                  <span className="text-white/70 text-xs mb-1">{ev.category} · {ev.venue}</span>
                  <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{ev.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent pointer-events-none" />
      </div>

      {/* Right: auth */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <span className="text-xl font-bold text-ink">Cultured</span>
            <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded font-medium">LDN</span>
          </div>

          <h2 className="text-2xl font-bold text-ink mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-muted text-sm mb-8">
            {mode === 'signin'
              ? 'Sign in to see your personalised London events.'
              : 'Set up your taste profile and start discovering.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="input pl-10"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input pl-10"
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="input pl-10"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? 'Please wait...' : (
                <>
                  <Sparkles size={15} />
                  {mode === 'signin' ? 'Sign in' : 'Get started'}
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-accent font-medium hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
