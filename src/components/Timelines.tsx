'use client'
import Link from 'next/link'
import { EVENT_BY_ID, EVENTS } from '@/data/events'
import { useAuth } from '@/store/auth'
import { deleteBranch, useProgress } from '@/store/progress'
import { FictionalBadge } from './Badges'
import { EmptyState } from './States'

export default function Timelines() {
  const { user } = useAuth()
  const { visited, scenariosRead, branches } = useProgress(user?.id)
  if (!user) {
    return <EmptyState title="Sign in to see your timelines" hint="Saved timelines and progress belong to your account." action={<Link href="/account" className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950">Sign in</Link>} />
  }
  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Events explored', `${visited.length} / ${EVENTS.length}`],
          ['Scenarios read', String(scenariosRead.length)],
          ['Your timelines', String(branches.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/5 bg-charcoal-900/70 p-5">
            <p className="text-xs uppercase tracking-widest text-parchment/50">{k}</p>
            <p className="mt-1 font-serif text-3xl text-gold-300">{v}</p>
          </div>
        ))}
      </section>
      <section>
        <h2 className="font-serif text-2xl text-parchment">Your alternate histories</h2>
        {branches.length === 0 ? (
          <div className="mt-4"><EmptyState title="Nothing saved yet" hint="Pick a moment in history and change it." action={<Link href="/create" className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950">Create your own history</Link>} /></div>
        ) : (
          <ul className="mt-4 space-y-3">
            {branches.sort((a, b) => b.createdAt - a.createdAt).map((b) => (
              <li key={b.id} className="rounded-xl border border-white/5 bg-charcoal-900/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl text-parchment">{b.title}</h3>
                    <p className="text-xs text-parchment/50">Diverges from {EVENT_BY_ID[b.eventId]?.title ?? 'unknown event'}</p>
                  </div>
                  <FictionalBadge label="Fictional · yours" />
                </div>
                <p className="mt-2 text-sm text-parchment/75">{b.change}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <Link href={`/events/${b.eventId}`} className="text-gold-300 underline">Open on timeline</Link>
                  <button onClick={() => confirm('Delete this timeline?') && deleteBranch(b.id)} className="text-red-300/80 underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
