'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { EVENTS, EVENT_BY_ID } from '@/data/events'
import { yearLabel } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { saveBranch, useProgress } from '@/store/progress'
import type { CustomCharacter } from '@/types'
import { FictionalBadge } from './Badges'

export const FREE_BRANCH_LIMIT = 3
const HORIZONS = ['First year', 'First decade', 'Long run']
const TRAITS = ['Cautious', 'Ambitious', 'Idealistic', 'Ruthless', 'Diplomatic', 'Charismatic', 'Scholarly', 'Devout', 'Reckless', 'Loyal']
const STEPS = ['Event', 'Change', 'Character', 'Consequences', 'Review']

export default function CreateHistory() {
  const params = useSearchParams()
  const router = useRouter()
  const { user, isPremium } = useAuth()
  const { branches } = useProgress(user?.id)

  const initialEvent = params.get('event')
  const [eventId, setEventId] = useState<string | null>(initialEvent && EVENT_BY_ID[initialEvent] ? initialEvent : null)
  const [step, setStep] = useState(eventId ? 1 : 0)
  const [change, setChange] = useState(params.get('change') ?? '')
  const [title, setTitle] = useState('')
  const [withChar, setWithChar] = useState(false)
  const [char, setChar] = useState<CustomCharacter>({ name: '', role: '', traits: [], motivation: '' })
  const [ripples, setRipples] = useState(HORIZONS.map((h) => ({ horizon: h, text: '' })))
  const [error, setError] = useState<string | null>(null)

  const event = eventId ? EVENT_BY_ID[eventId] : null
  const atLimit = !isPremium && branches.length >= FREE_BRANCH_LIMIT
  const input = 'w-full rounded-md border border-white/10 bg-charcoal-800 px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold-500/60 focus:outline-none'

  const problems = useMemo(() => {
    const p: Record<number, string | null> = {}
    p[0] = event ? null : 'Pick an event to begin.'
    p[1] = change.trim().length >= 15 ? null : 'Describe your change in at least 15 characters.'
    p[2] = !withChar ? null : char.name.trim().length < 2 ? 'Give your character a name.' : char.role.trim().length < 2 ? 'Give your character a role.' : null
    p[3] = ripples.some((r) => r.text.trim().length >= 20) ? null : 'Write at least one consequence (20+ characters).'
    return p
  }, [event, change, withChar, char, ripples])

  function next() {
    const msg = problems[step]
    if (msg) return setError(msg)
    setError(null)
    setStep((s) => s + 1)
  }

  function save() {
    if (!user || !event) return
    if (atLimit) return setError(`Free accounts can save up to ${FREE_BRANCH_LIMIT} custom timelines. Delete one or upgrade.`)
    for (let i = 0; i < 4; i++) if (problems[i]) return setError(problems[i])
    saveBranch({
      id: crypto.randomUUID(),
      userId: user.id,
      eventId: event.id,
      title: title.trim() || `What if: ${change.trim().slice(0, 48)}`,
      change: change.trim(),
      character: withChar ? { ...char, name: char.name.trim(), role: char.role.trim() } : null,
      ripples: ripples.filter((r) => r.text.trim()),
      createdAt: Date.now(),
    })
    router.push('/timelines')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex flex-wrap gap-2 text-xs" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${i === step ? 'bg-gold-500 text-midnight-950' : i < step ? 'bg-gold-500/20 text-gold-300' : 'border border-white/10 text-parchment/50'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-white/5 bg-charcoal-900/70 p-6">
        {step === 0 && (
          <div>
            <h2 className="font-serif text-2xl text-parchment">Which moment will you change?</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {EVENTS.map((e) => (
                <li key={e.id}>
                  <button onClick={() => { setEventId(e.id); setChange(''); setError(null) }} className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${e.id === eventId ? 'border-gold-500 bg-gold-500/10' : 'border-white/10 hover:border-white/25'}`}>
                    <span className="block text-parchment">{e.title}</span>
                    <span className="text-xs text-parchment/50">{yearLabel(e.year)} · {e.place}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 1 && event && (
          <div>
            <h2 className="font-serif text-2xl text-parchment">What changes at the decision point?</h2>
            <p className="mt-2 text-sm text-parchment/70">{event.pivot.question}</p>
            <p className="mt-1 text-sm text-parchment/60"><span className="text-emerald-300">In reality:</span> {event.pivot.actual}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {event.pivot.alternatives.map((a) => (
                <button key={a} onClick={() => setChange(a)} className="rounded-full border border-gold-500/30 px-3 py-1 text-xs text-gold-300 hover:bg-gold-500/10">{a}</button>
              ))}
            </div>
            <label className="mt-4 block text-xs uppercase tracking-widest text-parchment/50" htmlFor="chg">Your change</label>
            <textarea id="chg" value={change} onChange={(e) => setChange(e.target.value)} rows={3} maxLength={400} className={`${input} mt-1`} placeholder="Pick a suggestion above or write your own…" />
            <label className="mt-4 block text-xs uppercase tracking-widest text-parchment/50" htmlFor="ttl">Timeline title (optional)</label>
            <input id="ttl" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={`${input} mt-1`} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-serif text-2xl text-parchment">Add a character (optional)</h2>
            <p className="mt-2 text-sm text-parchment/70">A fictional figure who acts in your timeline. They are never presented as a real historical person.</p>
            <label className="mt-4 flex items-center gap-2 text-sm text-parchment/85">
              <input type="checkbox" checked={withChar} onChange={(e) => setWithChar(e.target.checked)} className="accent-[#c19a4a]" /> Include a custom character
            </label>
            {withChar && (
              <div className="mt-4 space-y-3">
                <input value={char.name} onChange={(e) => setChar({ ...char, name: e.target.value })} placeholder="Name" aria-label="Character name" maxLength={60} className={input} />
                <input value={char.role} onChange={(e) => setChar({ ...char, role: e.target.value })} placeholder="Role (e.g. envoy, scribe, officer)" aria-label="Character role" maxLength={60} className={input} />
                <div className="flex flex-wrap gap-2" role="group" aria-label="Traits (up to 4)">
                  {TRAITS.map((t) => {
                    const on = char.traits.includes(t)
                    return (
                      <button key={t} type="button" aria-pressed={on} onClick={() => setChar({ ...char, traits: on ? char.traits.filter((x) => x !== t) : char.traits.length < 4 ? [...char.traits, t] : char.traits })} className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/10 text-parchment/70'}`}>{t}</button>
                    )
                  })}
                </div>
                <textarea value={char.motivation} onChange={(e) => setChar({ ...char, motivation: e.target.value })} placeholder="What do they want?" aria-label="Motivation" rows={2} maxLength={250} className={input} />
              </div>
            )}
          </div>
        )}

        {step === 3 && event && (
          <div>
            <h2 className="font-serif text-2xl text-parchment">Trace the consequences</h2>
            <p className="mt-2 text-sm text-parchment/70">You write the ripple effects. These real factors shaped the actual outcome and are worth reasoning about:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-parchment/65">
              {event.factors.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <div className="mt-4 space-y-4">
              {ripples.map((r, i) => (
                <div key={r.horizon}>
                  <label className="text-xs uppercase tracking-widest text-gold-400" htmlFor={`r${i}`}>{r.horizon}</label>
                  <textarea id={`r${i}`} value={r.text} rows={3} maxLength={600} onChange={(e) => setRipples(ripples.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={`${input} mt-1`} />
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-md border border-white/10 px-3 py-2 text-xs text-parchment/50">AI co-writing is not connected yet, so consequences are written by you.</p>
          </div>
        )}

        {step === 4 && event && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl text-parchment">{title.trim() || `What if: ${change.trim().slice(0, 48)}`}</h2>
              <FictionalBadge label="Fictional · yours" />
            </div>
            <p className="mt-1 text-xs text-parchment/50">Diverges from: {event.title} ({event.dateLabel})</p>
            <p className="mt-3 text-sm text-parchment/90">{change}</p>
            {withChar && <p className="mt-3 text-sm text-parchment/75">Character: <b>{char.name}</b>, {char.role}{char.traits.length ? ` (${char.traits.join(', ')})` : ''}</p>}
            <ul className="mt-4 space-y-2 text-sm text-parchment/80">
              {ripples.filter((r) => r.text.trim()).map((r) => <li key={r.horizon}><b className="text-gold-300">{r.horizon}:</b> {r.text}</li>)}
            </ul>
            {!user && (
              <p className="mt-5 rounded-md border border-gold-500/30 bg-gold-500/5 px-3 py-2 text-sm text-gold-300">
                <Link href="/account" className="underline">Sign in</Link> to save this timeline. Your draft stays on this page meanwhile.
              </p>
            )}
            {user && atLimit && <p className="mt-5 text-sm text-gold-300">You have reached the free limit of {FREE_BRANCH_LIMIT} saved timelines. <Link href="/premium" className="underline">Premium</Link> removes it.</p>}
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex justify-between">
          <button onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)) }} disabled={step === 0} className="rounded-md border border-white/10 px-4 py-2 text-sm text-parchment/70 disabled:opacity-30">Back</button>
          {step < 4 ? (
            <button onClick={next} className="rounded-md bg-gold-500 px-5 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400">Continue</button>
          ) : (
            <button onClick={save} disabled={!user || atLimit} className="rounded-md bg-gold-500 px-5 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-40">Save timeline</button>
          )}
        </div>
      </div>
    </div>
  )
}
