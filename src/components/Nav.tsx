'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Compass, Bookmark, UserCircle, Users, Clock, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/explore',      label: 'Explore',     icon: Compass },
  { href: '/saved',        label: 'Saved',        icon: Bookmark },
  { href: '/past-events',  label: 'Been to',      icon: Clock },
  { href: '/friends',      label: 'Friends',      icon: Users },
  { href: '/profile',      label: 'Profile',      icon: UserCircle },
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

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-surface border-r border-border z-30 py-6 px-4">
        <Link href="/explore" className="flex items-center gap-2 mb-8 px-2">
          <span className="text-xl font-bold text-ink">Cultured</span>
          <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded font-medium">LDN</span>
        </Link>

        <nav className="flex-1 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink hover:bg-bg'}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-bg transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-30 flex">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors
                ${active ? 'text-accent' : 'text-muted'}`}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
