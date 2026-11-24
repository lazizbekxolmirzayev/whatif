'use client'
import { useMemo, useState } from 'react'
import type { Scenario, VarCategory } from '@/game/types'
import type { BranchSet } from '@/game/branches'
import { allBranches, getBranch } from '@/game/branches'
import { compareTimelines, optionLabel } from '@/game/compare'
import type { RowStatus } from '@/game/compare'
import { FACTION_NAME } from '@/game/factions'
import MiniMap from './MiniMap'
import { Btn, ForkIcon, KindBadge, Panel, toneText } from './ui'

export type MapView = 'a' | 'b' | 'diff'
const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  same: { label: 'Same', cls: 'text-parchment/40' },
  date: { label: 'Different date', cls: 'text-amber-300' },
  outcome: { label: 'Different outcome', cls: 'text-fuchsia-300' },
  'only-a': { label: 'Only in A', cls: 'text-emerald-300' },
  'only-b': { label: 'Only in B', cls: 'text-sky-300' },
}
const CATS: [VarCategory, string][] = [
  ['country', 'Countries'],
  ['political', 'Politics'],
  ['economy', 'Economy'],
  ['technology', 'Technology'],
  ['population', 'Population'],
  ['figure', 'Historical figures'],
  ['relation', 'International relations'],
]

export default function ComparePanel({ sc, set, a, b, map, onChange, onWatch, onClose }: { sc: Scenario; set: BranchSet; a: string; b: string; map: MapView; onChange: (x: { a?: string; b?: string; map?: MapView }) => void; onWatch: (branchId: string, step: number) => void; onClose: () => void }) {
  const list = allBranches(sc, set)
  const A = getBranch(sc, set, a)
  const B = getBranch(sc, set, b)
  const c = useMemo(() => compareTimelines(sc, A.choices, B.choices), [sc, A.choices, B.choices])
  const [showSame, setShowSame] = useState(false)
  const rows = showSame ? c.rows : c.rows.filter((r) => r.status !== 'same')
  const differing = c.control.filter((x) => x.differs).map((x) => x.territory)
  const sel = (value: string, key: 'a' | 'b') => (
    <select value={value} onChange={(e) => onChange({ [key]: e.target.value })} className="min-w-0 flex-1 rounded border border-white/15 bg-black/50 px-2 py-1 text-sm" data-testid={`compare-select-${key}`} aria-label={key === 'a' ? 'Timeline A' : 'Timeline B'}>
      {list.map((x) => (
        <option key={x.id} value={x.id}>{x.name}</option>
      ))}
    </select>
  )
  return (
    <Panel className="wi-in flex h-full flex-col !p-4" data-testid="compare-panel" data-differences={c.rows.filter((r) => r.status !== 'same').length}>
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-2xl">Compare timelines</h2>
        <button className="ml-auto text-sm text-parchment/60 hover:text-parchment" onClick={onClose} data-testid="close-compare">Close ✕</button>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="font-semibold text-emerald-300">A</span>
        {sel(a, 'a')}
        <button className="rounded border border-white/15 px-2 py-1 hover:border-gold-500/50" onClick={() => onChange({ a: b, b: a })} title="Swap" aria-label="Swap timelines">⇄</button>
        <span className="font-semibold text-sky-300">B</span>
        {sel(b, 'b')}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs" role="group" aria-label="Globe shows">
        <span className="text-parchment/50">Globe shows:</span>
        {(['a', 'b', 'diff'] as MapView[]).map((m) => (
          <button key={m} data-testid={`map-${m}`} onClick={() => onChange({ map: m })} className={`rounded border px-2 py-0.5 ${map === m ? 'border-gold-500/60 bg-gold-500/10 text-gold-200' : 'border-white/15'}`}>
            {m === 'a' ? 'Timeline A' : m === 'b' ? 'Timeline B' : `Differences (${differing.length})`}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {c.divergence ? (
          <div className="rounded border border-fuchsia-400/30 bg-fuchsia-500/5 p-3 text-sm" data-testid="divergence">
            <p className="text-[10px] uppercase tracking-widest text-fuchsia-300"><ForkIcon /> Point of divergence · decision {c.divergence.index + 1}</p>
            <p className="font-serif text-lg">{c.divergence.nodeTitle}</p>
            <p className="text-xs text-parchment/80"><span className="text-emerald-300">A:</span> {c.divergence.a ?? 'stops here'}</p>
            <p className="text-xs text-parchment/80"><span className="text-sky-300">B:</span> {c.divergence.b ?? 'stops here'}</p>
            <div className="mt-2 flex gap-2">
              {c.divergence.a && <Btn className="!px-2 !py-1 !text-xs" onClick={() => onWatch(a, c.divergence!.index)} data-testid="watch-a">▶ Watch A</Btn>}
              {c.divergence.b && <Btn className="!px-2 !py-1 !text-xs" onClick={() => onWatch(b, c.divergence!.index)} data-testid="watch-b">▶ Watch B</Btn>}
            </div>
          </div>
        ) : (
          <p className="rounded border border-white/10 p-3 text-sm text-parchment/70">These two timelines are identical so far.</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {(['a', 'b'] as const).map((k) => {
            const e = c.endings[k]
            return (
              <div key={k} className="rounded border border-white/10 p-2">
                <p className={`text-[10px] uppercase tracking-widest ${k === 'a' ? 'text-emerald-300' : 'text-sky-300'}`}>{k.toUpperCase()} · reaches {c.years[k]}</p>
                <p className="font-serif text-base">{e?.title ?? 'Unfinished'}</p>
                {e && <KindBadge kind={e.kind} />}
              </div>
            )
          })}
        </div>

        <section>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-[10px] uppercase tracking-widest text-gold-400">Events</h3>
            {(Object.keys(STATUS) as RowStatus[]).filter((s) => c.counts[s] > 0).map((s) => (
              <span key={s} className={`text-[10px] ${STATUS[s].cls}`}>{c.counts[s]} {STATUS[s].label.toLowerCase()}</span>
            ))}
          </div>
          <table className="w-full text-left text-xs" data-testid="compare-events">
            <thead className="text-[10px] uppercase tracking-wider text-parchment/40">
              <tr><th className="w-1/2 pb-1 font-normal text-emerald-300/80">A · {A.name}</th><th className="pb-1 font-normal text-sky-300/80">B · {B.name}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`border-t border-white/5 align-top ${r.status === 'same' ? 'opacity-60' : ''}`} data-status={r.status}>
                  {(['a', 'b'] as const).map((k) => {
                    const e = r[k]
                    const dateHot = r.dateDiffers
                    const hot = r.outcomeDiffers || r.status === (k === 'a' ? 'only-a' : 'only-b')
                    return (
                      <td key={k} className="py-1.5 pr-2">
                        {e ? (
                          <>
                            <span className={`tabular-nums ${dateHot ? 'text-amber-300' : 'text-parchment/50'}`}>{e.date}</span>
                            <span className={`block ${hot ? 'text-parchment' : 'text-parchment/75'}`}>{e.title}</span>
                            <span className={`text-[9px] uppercase tracking-wider ${e.kind === 'historical' ? 'text-emerald-300/70' : 'text-fuchsia-300/70'}`}>{e.kind === 'historical' ? 'documented' : e.echo ? 'alternate · mirrors reality' : 'fiction'}</span>
                          </>
                        ) : (
                          <span className="italic text-parchment/35">— does not happen</span>
                        )}
                        {k === 'b' && r.status !== 'same' && <span className={`ml-1 text-[9px] uppercase tracking-wider ${STATUS[r.status].cls}`}>· {r.status === 'outcome' && r.dateDiffers ? 'different outcome and date' : STATUS[r.status].label}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {c.counts.same > 0 && (
            <button className="mt-1 text-[11px] text-parchment/55 underline hover:text-parchment" onClick={() => setShowSame((x) => !x)} data-testid="toggle-same">
              {showSame ? 'Hide identical events' : `Show ${c.counts.same} identical event${c.counts.same === 1 ? '' : 's'}`}
            </button>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-[10px] uppercase tracking-widest text-gold-400">Map</h3>
          <div className="flex gap-2">
            <MiniMap sc={sc} control={Object.fromEntries(c.control.map((x) => [x.territory, x.a]))} differs={differing} title={`A · ${c.years.a}`} tone="a" />
            <MiniMap sc={sc} control={Object.fromEntries(c.control.map((x) => [x.territory, x.b]))} differs={differing} title={`B · ${c.years.b}`} tone="b" />
          </div>
          {differing.length > 0 && (
            <ul className="mt-1 text-[11px] text-parchment/70">
              {c.control.filter((x) => x.differs).map((x) => (
                <li key={x.territory}>{sc.territories.find((t) => t.id === x.territory)?.name}: <span className="text-emerald-300">{FACTION_NAME[x.a]}</span> vs <span className="text-sky-300">{FACTION_NAME[x.b]}</span></li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[10px] text-parchment/40">Schematic regions, not historical borders.</p>
        </section>

        <section data-testid="compare-world">
          <h3 className="mb-1 text-[10px] uppercase tracking-widest text-gold-400">World state at the end of each timeline</h3>
          <div className="space-y-1">
            {c.stats.map((s) => (
              <div key={s.id} className="grid grid-cols-[8rem_1fr_1fr] items-center gap-2 text-[11px]">
                <span className="text-parchment/60">{sc.statMeta[s.id].label}</span>
                <span className="flex items-center gap-1"><span className="h-1 rounded bg-emerald-400/70" style={{ width: `${s.a * 0.8}%` }} />{s.a}</span>
                <span className="flex items-center gap-1"><span className="h-1 rounded bg-sky-400/70" style={{ width: `${s.b * 0.8}%` }} />{s.b}</span>
              </div>
            ))}
          </div>
          {CATS.map(([cat, label]) => {
            const rows = c.vars.filter((x) => x.v.category === cat && !(x.v.hiddenWhen && x.a === x.v.hiddenWhen && x.b === x.v.hiddenWhen))
            if (!rows.length) return null
            return (
              <div key={cat} className="mt-2">
                <p className="text-[10px] uppercase tracking-wider text-parchment/45">{label}</p>
                {rows.map((x) => (
                  <div key={x.v.id} className={`grid grid-cols-[8rem_1fr_1fr] gap-2 rounded px-1 py-0.5 text-[11px] ${x.differs ? 'bg-gold-500/[0.07]' : 'opacity-55'}`} data-differs={x.differs ? '1' : '0'}>
                    <span className="text-parchment/60">{x.v.label}</span>
                    <span className={toneText(x.v.options.find((o) => o.id === x.a)?.tone)}>{optionLabel(x.v, x.a)}</span>
                    <span className={toneText(x.v.options.find((o) => o.id === x.b)?.tone)}>{optionLabel(x.v, x.b)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </section>
      </div>
    </Panel>
  )
}
