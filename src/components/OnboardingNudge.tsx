'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Sparkles } from 'lucide-react'

export default function OnboardingNudge() {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  // Clears the ?justOnboarded param so a manual refresh doesn't keep bringing it back.
  const dismiss = () => {
    setDismissed(true)
    router.replace('/home')
  }

  if (dismissed) return null

  return (
    <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-ink text-white flex items-start sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3">
        <Sparkles size={18} className="text-accent shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-sm sm:text-[15px] leading-snug">
          you&apos;re in <span className="font-serif italic text-accent">.</span> now go
          swipe a few in <Link href="/taste" className="underline underline-offset-2 font-semibold">taste</Link> so
          your feed learns you instead of guessing.
        </p>
      </div>
      <button onClick={dismiss} className="shrink-0 text-white/50 hover:text-white transition-colors" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
