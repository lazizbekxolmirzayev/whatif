'use client'
import Link from 'next/link'
import { devSetPlan, useAuth } from '@/store/auth'

const FEATURES = [
  ['Premium scenarios', 'Additional curated fictional branches on every event.'],
  ['Unlimited saved timelines', 'Free accounts keep up to 3 custom timelines.'],
  ['Cinematic AI video scenes', 'Planned. Not available until a video service is connected.'],
]

export default function PremiumPanel() {
  const { user, isPremium } = useAuth()
  const dev = process.env.NODE_ENV !== 'production'
  return (
    <div className="mx-auto max-w-2xl">
      <ul className="space-y-3">
        {FEATURES.map(([t, d]) => (
          <li key={t} className="rounded-xl border border-gold-500/20 bg-charcoal-900/70 p-5">
            <p className="font-serif text-xl text-gold-300">{t}</p>
            <p className="mt-1 text-sm text-parchment/70">{d}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-2xl border border-white/10 bg-midnight-900 p-6 text-center">
        {isPremium ? (
          <p className="text-gold-300">Premium is active on this account.</p>
        ) : (
          <>
            <p className="text-parchment/80">Monthly subscription checkout is not available yet. No payment provider is connected, so no one can be charged and nothing here can unlock Premium.</p>
            <button disabled className="mt-4 cursor-not-allowed rounded-md bg-gold-500/30 px-5 py-2 text-sm font-medium text-parchment/50">Subscribe (coming soon)</button>
          </>
        )}
        {!user && <p className="mt-4 text-sm text-parchment/60"><Link href="/account" className="underline">Sign in</Link> to manage your plan.</p>}
        {dev && user && (
          <div className="mt-6 border-t border-white/10 pt-4 text-xs text-parchment/50">
            Development build only: <button className="underline" onClick={() => void devSetPlan(isPremium ? 'free' : 'premium')}>{isPremium ? 'switch to Free' : 'simulate Premium for testing'}</button> (hidden in production).
          </div>
        )}
      </div>
    </div>
  )
}
