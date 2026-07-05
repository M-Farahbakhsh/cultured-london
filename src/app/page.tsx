import AuthForm from '@/components/AuthForm'
import Roundel from '@/components/Roundel'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-12 sm:py-16">
      {/* Wordmark — Roundel already reads "CULTURED", so the wordmark text
          is "London." next to it, not "Cultured." (that repeated itself). */}
      <div className="flex items-center gap-3 mb-10">
        <span className="roundel-idle-spin inline-block">
          <Roundel size={52} />
        </span>
        <span className="font-serif italic text-[28px] text-ink tracking-tight leading-none">
          London<span className="text-accent">.</span>
        </span>
      </div>

      {/* Punchy pitch */}
      <div className="w-full max-w-md text-center mb-10">
        <p className="text-accent text-xs font-semibold uppercase tracking-[0.15em] mb-3">
          london · picked for you
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl text-ink tracking-tight leading-tight">
          stop scrolling.<br /><em>start going.</em>
        </h1>
        <p className="text-muted text-base mt-4 leading-relaxed">
          gigs, raves, talks, galleries — matched to your taste, not an algorithm&apos;s mood.
          every pick comes with a reason.
        </p>
      </div>

      <AuthForm />
    </div>
  )
}
