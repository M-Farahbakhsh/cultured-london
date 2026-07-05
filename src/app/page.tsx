import AuthForm from '@/components/AuthForm'
import Roundel from '@/components/Roundel'
import LiveTicker from '@/components/LiveTicker'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data: liveCount } = await supabase.rpc('count_unique_events', {
    p_from_time: now,
    p_to_time:   '2099-01-01T00:00:00Z',
    p_category:  null,
    p_is_free:   null,
    p_search:    null,
  })

  const tickerItems = [
    `${(liveCount as number ?? 0).toLocaleString()} events on. zero excuses`,
    formatDate(new Date().toISOString()).toLowerCase(),
    'swipe right on your next obsession',
    'gigs · raves · galleries · comedy · everything',
    'no account needed to look — sign up to get picked for you',
  ]

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-12 sm:py-16">
      {/* Wordmark — Roundel already reads "CULTURED", so the wordmark text
          is "London." next to it, not "Cultured." (that repeated itself). */}
      <div className="flex items-center gap-3 mb-10">
        <span className="roundel-idle-spin inline-block">
          <span className="inline-block transition-transform duration-500 hover:rotate-[360deg]">
            <Roundel size={52} />
          </span>
        </span>
        <span className="font-serif italic text-[28px] text-ink tracking-tight leading-none">
          London<span className="text-accent">.</span>
        </span>
      </div>

      {/* Punchy pitch */}
      <div className="w-full max-w-md text-center mb-4">
        <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em] mb-3">
          london · zero fomo
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl text-ink tracking-tight leading-tight">
          delete the doomscroll.<br /><em>book the night.</em>
        </h1>
        <p className="text-muted text-base mt-4 leading-relaxed">
          gigs, raves, talks, galleries — matched to your taste, not vibes-based guessing.
          every pick&apos;s got receipts.
        </p>
      </div>

      <div className="w-full max-w-md">
        <LiveTicker items={tickerItems} />
      </div>

      <AuthForm />
    </div>
  )
}
