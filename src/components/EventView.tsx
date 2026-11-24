'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { HistoricalEvent } from '@/types'
import { EVENT_BY_ID } from '@/data/events'
import { useAuth } from '@/store/auth'
import { markEventVisited, markScenarioRead, useProgress } from '@/store/progress'
import { FictionalBadge, PremiumBadge, VerifiedBadge } from './Badges'
import BranchTimeline, { type TimelineBranch } from './BranchTimeline'
import VideoPanel from './VideoPanel'

export default function EventView({ event }: { event: HistoricalEvent }) {
  const { user, isPremium } = useAuth()
  const { branches } = useProgress(user?.id)
  const mine = branches.filter((b) => b.eventId === event.id)
  const [activeId, setActiveId] = useState<string>(event.scenarios[0].id)

  useEffect(() => {
    if (user) markEventVisited(user.id, event.id)
  }, [user, event.id])

  const active = event.scenarios.find((s) => s.id === activeId)
  const activeCustom = mine.find((b) => b.id === activeId)
  const locked = !!active && active.premium && !isPremium

  useEffect(() => {
    if (user && active && !locked) markScenarioRead(user.id, active.id)
  }, [user, active, locked])

  const tlBranches: TimelineBranch[] = useMemo(
    () => [
      ...event.scenarios.map((s) => ({ id: s.id, label: s.title, kind: 'scenario' as const, locked: s.premium && !isPremium })),
      ...mine.map((b) => ({ id: b.id, label: b.title, kind: 'custom' as const })),
    ],
    [event.scenarios, mine, isPremium],
  )

  return (
    <article className="space-y-10">
      <header>
        <p className="text-xs uppercase tracking-widest text-gold-400">
          {event.dateLabel} · {event.place} · {event.era}
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-parchment sm:text-5xl">{event.title}</h1>
      </header>

      <section aria-labelledby="verified" className="rounded-2xl border border-emerald-400/15 bg-charcoal-900/70 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="verified" className="font-serif text-2xl text-parchment">What actually happened</h2>
          <VerifiedBadge />
        </div>
        <p className="mt-3 leading-relaxed text-parchment/85">{event.summary}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-parchment/75">
          {event.verifiedFacts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-parchment/45">
          Where historians disagree, the text says so. Summaries are condensed; consult academic histories for detail.
        </p>
      </section>

      <section aria-labelledby="pivot" className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-charcoal-900 to-midnight-900 p-6">
        <h2 id="pivot" className="font-serif text-2xl text-gold-300">The decision point</h2>
        <p className="mt-2 text-parchment/90">{event.pivot.question}</p>
        <p className="mt-2 text-sm text-parchment/70"><span className="text-emerald-300">In reality:</span> {event.pivot.actual}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {event.pivot.alternatives.map((a) => (
            <Link key={a} href={`/create?event=${event.id}&change=${encodeURIComponent(a)}`} className="rounded-full border border-gold-500/30 px-3 py-1 text-xs text-gold-300 hover:bg-gold-500/10">
              ✦ {a}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="branches">
        <h2 id="branches" className="font-serif text-2xl text-parchment">Alternate timelines</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/5 bg-midnight-900 p-4">
          <div className="min-w-[640px]">
            <BranchTimeline event={event} branches={tlBranches} activeId={activeId} onPick={setActiveId} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Scenarios">
          {event.scenarios.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === activeId} onClick={() => setActiveId(s.id)} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${s.id === activeId ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 text-parchment/75 hover:border-white/25'}`}>
              {s.title} {s.premium && <PremiumBadge />}
            </button>
          ))}
          {mine.map((b) => (
            <button key={b.id} role="tab" aria-selected={b.id === activeId} onClick={() => setActiveId(b.id)} className={`rounded-lg border px-4 py-2 text-sm ${b.id === activeId ? 'border-violet-400 bg-violet-400/10 text-violet-200' : 'border-white/10 text-parchment/75'}`}>
              {b.title} <span className="text-xs opacity-60">(yours)</span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/5 bg-charcoal-900/70 p-6">
          {active && locked && (
            <div className="text-center">
              <PremiumBadge />
              <h3 className="mt-3 font-serif text-2xl text-parchment">{active.title}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-parchment/70">This scenario is part of WHATIF Premium.</p>
              <Link href="/premium" className="mt-4 inline-block rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950">See Premium</Link>
            </div>
          )}
          {active && !locked && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-2xl text-parchment">{active.title}</h3>
                <FictionalBadge />
              </div>
              <p className="mt-2 text-parchment/90">{active.premise}</p>
              <h4 className="mt-5 text-xs uppercase tracking-widest text-parchment/50">What would have to be true</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-parchment/75">
                {active.assumptions.map((a) => <li key={a}>{a}</li>)}
              </ul>
              <ol className="mt-6 space-y-5 border-l border-gold-500/30 pl-5">
                {active.chapters.map((c) => (
                  <li key={c.horizon}>
                    <p className="text-xs uppercase tracking-widest text-gold-400">{c.horizon}</p>
                    <p className="mt-1 text-sm leading-relaxed text-parchment/85">{c.text}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 rounded-md bg-gold-500/5 px-3 py-2 text-xs text-gold-300/90">
                This is a speculative scenario written for WHATIF. It is not a historical claim.
              </p>
            </div>
          )}
          {activeCustom && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-2xl text-parchment">{activeCustom.title}</h3>
                <FictionalBadge label="Fictional · written by you" />
              </div>
              <p className="mt-2 text-parchment/90">{activeCustom.change}</p>
              <ol className="mt-5 space-y-4 border-l border-violet-400/30 pl-5">
                {activeCustom.ripples.filter((r) => r.text.trim()).map((r) => (
                  <li key={r.horizon}>
                    <p className="text-xs uppercase tracking-widest text-violet-300">{r.horizon}</p>
                    <p className="mt-1 text-sm text-parchment/85">{r.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="mt-4"><VideoPanel /></div>
      </section>

      {event.related && event.related.length > 0 && (
        <section>
          <h2 className="font-serif text-xl text-parchment">Connected events</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {event.related.map((id) => EVENT_BY_ID[id] && (
              <Link key={id} href={`/events/${id}`} className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-parchment/80 hover:border-gold-500/40">
                {EVENT_BY_ID[id].title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div>
        <Link href={`/create?event=${event.id}`} className="rounded-md bg-gold-500 px-5 py-2.5 text-sm font-medium text-midnight-950 hover:bg-gold-400">
          Create your own history from here
        </Link>
      </div>
    </article>
  )
}
