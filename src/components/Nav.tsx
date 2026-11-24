'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, signOut } from '@/store/auth'

const LINKS = [
  { href: '/', label: 'World' },
  { href: '/events', label: 'Events' },
  { href: '/create', label: 'Create History' },
  { href: '/timelines', label: 'My Timelines' },
  { href: '/premium', label: 'Premium' },
]

export default function Nav() {
  const path = usePathname()
  const { user, isPremium, loading } = useAuth()
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-midnight-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-2xl font-semibold tracking-[0.2em] text-gold-400">
          WHATIF
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${active ? 'bg-gold-500/15 text-gold-300' : 'text-parchment/70 hover:text-parchment'}`}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {loading ? (
            <span className="h-8 w-20" aria-hidden />
          ) : user ? (
            <>
              <span className="hidden text-parchment/70 sm:inline">
                {user.name}
                {isPremium && <span className="ml-2 text-gold-400">★</span>}
              </span>
              <button onClick={() => void signOut()} className="rounded-md border border-white/10 px-3 py-1.5 text-parchment/80 hover:border-gold-500/40">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/account" className="rounded-md bg-gold-500 px-3.5 py-1.5 font-medium text-midnight-950 hover:bg-gold-400">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-3 py-1.5 md:hidden" aria-label="Main mobile">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-md px-3 py-1 text-xs text-parchment/70">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
