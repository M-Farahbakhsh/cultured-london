'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, Sparkles } from 'lucide-react'

type Mode = 'signin' | 'signup'

export default function AuthForm() {
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
      router.push('/home')
    }
    router.refresh()
  }

  return (
    <div className="card w-full max-w-sm p-7 sm:p-8">
      <h2 className="font-serif text-2xl text-ink tracking-tight mb-1">
        {mode === 'signin' ? 'welcome back' : 'get your city, curated'}
      </h2>
      <p className="text-muted text-sm mb-7 leading-relaxed">
        {mode === 'signin'
          ? 'your picks are waiting. no black box.'
          : '30 seconds of taste-setting, then it just gets you.'}
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
          {loading ? 'one sec...' : (
            <>
              <Sparkles size={15} />
              {mode === 'signin' ? "let's go" : "get started — it's free"}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        {mode === 'signin' ? 'new here? ' : 'already in the know? '}
        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="text-accent font-medium hover:underline"
        >
          {mode === 'signin' ? 'create an account' : 'sign in'}
        </button>
      </p>
    </div>
  )
}
