'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Compass, Bookmark, UserCircle, Users, Clock, LogOut, Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Roundel from './Roundel'

// Four jobs, four destinations. Everything else is secondary.
const PRIMARY_NAV = [
  { href: '/home',    label: 'For you', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/taste',   label: 'Swipe',   icon: Heart },
  { href: '/saved',   label: 'Saved',   icon: Bookmark },
]

const SECONDARY_NAV = [
  { href: '/past-events', label: 'Been to', icon: Clock },
  { href: '/friends',     label: 'Friends', icon: Users },
  { href: '/profile',     label: 'Profile', icon: UserCircle },
]

const MOBILE_NAV = [
  { href: '/home',    label: 'For you', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/taste',   label: 'Swipe',   icon: Heart },
  { href: '/saved',   label: 'Saved',   icon: Bookmark },
  { href: '/profile', label: 'Profile', icon: UserCircle },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/home' ? pathname === '/home' : pathname.startsWith(href)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-surface border-r border-border z-30 py-6 px-4">
        <Link href="/home" className="flex items-center gap-3 mb-10 px-1 group">
          <span className="transition-transform duration-500 group-hover:rotate-[360deg]">
            <Roundel size={52} />
          </span>
          <span className="font-serif italic text-[27px] text-ink tracking-tight leading-none">
            London<span className="text-accent">.</span>
          </span>
        </Link>

        <nav className="flex-1">
          <div className="space-y-1">
            {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-150
                    ${active
                      ? 'bg-accent-soft text-accent'
                      : 'text-ink hover:bg-bg'}`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />}
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                  {label}
                </Link>
              )
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border space-y-0.5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted/70">You</p>
            {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150
                    ${active
                      ? 'text-accent bg-accent-soft'
                      : 'text-muted hover:text-ink hover:bg-bg'}`}
                >
                  <Icon size={16} strokeWidth={active ? 2.4 : 2} />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-sm font-medium text-muted border-t border-border pt-4 hover:text-accent hover:bg-accent-soft transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border z-30 flex pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors
                ${active ? 'text-accent' : 'text-muted'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
              <span className={`w-1 h-1 rounded-full transition-colors ${active ? 'bg-accent' : 'bg-transparent'}`} />
            </Link>
          )
        })}
      </nav>
    </>
  )
}
