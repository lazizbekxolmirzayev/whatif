'use client'
import { useMemo } from 'react'
import type { ChronicleEntry, Kind } from '@/game/types'
import { ForkIcon, kindLabel } from './ui'

export interface StepMark {
  year: number
  kind: Kind
  diverged: boolean
  label: string
  nodeTitle: string
}

/** Compressed year scale: gaps grow with the square root of the years between events. */
function makeScale(years: number[]) {
  const ys = [...new Set(years.filter(Number.isFinite))].sort((a, b) => a - b)
  const cum = [0]
  for (let i = 1; i < ys.length; i++) cum.push(cum[i - 1] + Math.sqrt(ys[i] - ys[i - 1]))
  const total = cum[cum.length - 1] || 1
  return (y: number) => {
    if (y <= ys[0]) return 0
    if (y >= ys[ys.length - 1]) return 1
    let i = 0
    while (i < ys.length - 2 && y >= ys[i + 1]) i++
    const f = (y - ys[i]) / (ys[i + 1] - ys[i])
    return (cum[i] + f * (cum[i + 1] - cum[i])) / total
  }
}

const dotColor = (e: ChronicleEntry) => (e.kind === 'historical' ? 'bg-emerald-400 border-emerald-200' : e.echo ? 'bg-fuchsia-500 border-emerald-300' : 'bg-fuchsia-500 border-fuchsia-200')

function Dots({ entries, y, x, ghostFrom, testid }: { entries: ChronicleEntry[]; y: number; x: (n: number) => number; ghostFrom: number; testid: string }) {
  const byYear: Record<number, number> = {}
  return (
    <>
      {entries.map((e, i) => {
        const k = (byYear[e.year] = (byYear[e.year] ?? -1) + 1)
        const n = entries.filter((z) => z.year === e.year).length
        const ghost = e.step >= ghostFrom
        return (
          <div key={`${e.key}-${e.step}-${i}`} className={`group absolute -translate-x-1/2 -translate-y-1/2 ${ghost ? 'opacity-30' : ''}`} style={{ left: `calc(${x(e.year) * 100}% + ${k * 9 - (n - 1) * 4.5}px)`, top: y }} data-testid={testid} data-key={e.key} data-ghost={ghost ? '1' : '0'}>
            <div className={`wi-pop h-2.5 w-2.5 rounded-full border ${dotColor(e)} ${ghost ? 'border-dashed' : ''}`} />
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 hidden w-56 -translate-x-1/2 rounded border border-gold-500/30 bg-midnight-950/95 p-2 text-left shadow-xl group-hover:block">
              <p className="text-[10px] uppercase tracking-widest text-gold-400">{e.date}</p>
              <p className="text-xs text-parchment">{e.title}</p>
              <p className={`mt-0.5 text-[10px] ${e.kind === 'historical' ? 'text-emerald-300' : 'text-fuchsia-300'}`}>{kindLabel(e.kind, e.echo)}{ghost ? ' · later in this branch' : ''}</p>
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function Chronicle({
  original,
  branch,
  branchName,
  steps,
  cursor,
  divergeYear,
  shownYear,
  anchors,
  disabled,
  onNavigate,
}: {
  original: ChronicleEntry[]
  /** null when the active timeline is the original */
  branch: ChronicleEntry[] | null
  branchName: string
  steps: StepMark[]
  cursor: number
  /** year at which the branch leaves the original line; null if it never does */
  divergeYear: number | null
  shownYear: number
  anchors: number[]
  disabled: boolean
  onNavigate: (cursor: number) => void
}) {
  const x = useMemo(() => makeScale([...original, ...(branch ?? [])].map((e) => e.year).concat(steps.map((s) => s.year), anchors)), [original, branch, steps, anchors])
  const two = !!branch
  const yO = 16
  const yB = two ? 48 : 16
  const divYear = divergeYear
  const ticks: number[] = []
  for (const yr of [...new Set([...anchors, ...steps.map((s) => s.year)])].sort((a, b) => a - b)) if (!ticks.length || x(yr) - x(ticks[ticks.length - 1]) > 0.045) ticks.push(yr)

  return (
    <div className="pointer-events-auto relative mx-auto max-w-5xl" data-testid="timeline" style={{ height: two ? 88 : 56 }}>
      <div className="absolute left-0 top-0 w-[6.5rem] text-right text-[10px] uppercase leading-tight tracking-wider">
        <p className="text-emerald-300/80" style={{ marginTop: yO - 7 }}>Original</p>
        {two && (
          <p className="truncate text-fuchsia-200" style={{ marginTop: yB - yO - 12 }} title={branchName}>
            {branchName.replace(/^What if: /, '')}
          </p>
        )}
      </div>
      <div className="absolute bottom-0 left-[7.25rem] right-16 top-0">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
          <line x1={0} x2={1000} y1={(yO / (two ? 88 : 56)) * 100} y2={(yO / (two ? 88 : 56)) * 100} stroke="#34d399" strokeOpacity={two ? 0.35 : 0.5} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {two && divYear !== null && (
            <>
              <line x1={0} x2={x(divYear) * 1000} y1={(yB / 88) * 100} y2={(yB / 88) * 100} stroke="#34d399" strokeOpacity={0.25} strokeDasharray="4 4" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <path className="wi-draw" d={`M ${x(divYear) * 1000} ${(yO / 88) * 100} C ${x(divYear) * 1000 + 14} ${(yO / 88) * 100}, ${x(divYear) * 1000 + 4} ${(yB / 88) * 100}, ${x(divYear) * 1000 + 22} ${(yB / 88) * 100} L 1000 ${(yB / 88) * 100}`} fill="none" stroke="#e879f9" strokeOpacity={0.7} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {two && divYear !== null && (
          <span className="absolute -translate-x-1/2 text-[9px] uppercase tracking-widest text-fuchsia-300" style={{ left: `${x(divYear) * 100}%`, top: yO + 4 }} data-testid="fork-mark">
            <ForkIcon /> fork
          </span>
        )}
        <Dots entries={original} y={yO} x={x} ghostFrom={two ? Infinity : cursor} testid="tl-original" />
        {branch && <Dots entries={branch} y={yB} x={x} ghostFrom={cursor} testid="tl-branch" />}
        {steps.map((s, i) => (
          <button
            key={i}
            data-testid={`tl-step-${i}`}
            disabled={disabled}
            onClick={() => onNavigate(i)}
            title={`${s.year} · ${s.nodeTitle}: ${s.label}. Click to revisit this decision.`}
            className={`absolute h-3 w-3 -translate-x-1/2 rotate-45 border-2 transition hover:scale-125 disabled:cursor-not-allowed ${i < cursor ? (s.diverged ? 'border-fuchsia-200 bg-fuchsia-500' : 'border-emerald-200 bg-emerald-500') : 'border-white/40 bg-transparent'} ${i === cursor ? 'ring-2 ring-gold-400' : ''}`}
            style={{ left: `${x(s.year) * 100}%`, top: yB + 9 }}
          />
        ))}
        <div className="pointer-events-none absolute w-0.5 -translate-x-1/2 bg-gold-400 shadow-[0_0_8px_#d4b66c] transition-all duration-500" style={{ left: `${x(shownYear) * 100}%`, top: 4, height: yB + 8 }} data-testid="playhead" />
        {ticks.map((yr) => (
          <span key={yr} className="absolute -translate-x-1/2 text-[9px] tabular-nums text-parchment/45" style={{ left: `${x(yr) * 100}%`, top: yB + 24 }}>
            {yr}
          </span>
        ))}
      </div>
      {cursor < steps.length && (
        <button data-testid="tl-latest" disabled={disabled} onClick={() => onNavigate(steps.length)} className="absolute right-0 top-1/2 -translate-y-1/2 rounded border border-white/15 bg-black/40 px-2 py-1 text-[10px] text-parchment/80 hover:border-gold-500/50">
          Latest ▸
        </button>
      )}
    </div>
  )
}
