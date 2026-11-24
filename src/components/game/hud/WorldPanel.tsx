'use client'
import { useState } from 'react'
import type { Scenario, StatId, VarCategory, WorldState, WorldVar } from '@/game/types'
import { FACTION_COLOR, FACTION_NAME } from '@/game/factions'
import { optionLabel } from '@/game/compare'
import { Panel, initials, toneText } from './ui'

type Tab = 'powers' | 'people' | 'society' | 'ties'
const TABS: { id: Tab; label: string; cats: VarCategory[] }[] = [
  { id: 'powers', label: 'Powers', cats: ['country'] },
  { id: 'people', label: 'People', cats: ['figure'] },
  { id: 'society', label: 'Society', cats: ['political', 'economy', 'technology', 'population'] },
  { id: 'ties', label: 'Relations', cats: ['relation'] },
]
const CAT_LABEL: Record<VarCategory, string> = { country: 'Country', political: 'Politics', economy: 'Economy', technology: 'Technology', population: 'Population', figure: 'Figure', relation: 'Relation' }

/** World state at the current point of the timeline. `prev` marks what the last decision changed. */
export default function WorldPanel({ sc, state, prev }: { sc: Scenario; state: WorldState; prev: WorldState | null }) {
  const [tab, setTab] = useState<Tab>('powers')
  const changed = (v: WorldVar) => !!prev && prev.vars[v.id] !== state.vars[v.id]
  const counts = Object.fromEntries(TABS.map((t) => [t.id, sc.vars.filter((v) => t.cats.includes(v.category) && changed(v)).length])) as Record<Tab, number>
  const current = TABS.find((t) => t.id === tab)!
  const vars = sc.vars.filter((v) => current.cats.includes(v.category) && !(v.hiddenWhen && state.vars[v.id] === v.hiddenWhen))

  return (
    <Panel className="flex max-h-full flex-col !p-3" data-testid="world-panel">
      <div className="space-y-1.5">
        {(Object.keys(sc.statMeta) as StatId[]).map((k) => {
          const d = prev ? state.stats[k] - prev.stats[k] : 0
          return (
            <div key={k} title={sc.statMeta[k].note}>
              <div className="flex justify-between text-[11px] text-parchment/70">
                <span>{sc.statMeta[k].label}</span>
                <span className="tabular-nums">
                  {d !== 0 && <span key={`${k}${state.stats[k]}`} className={`wi-in mr-1 ${d > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{d > 0 ? `+${d}` : d}</span>}
                  <span data-testid={`stat-${k}`}>{state.stats[k]}</span>
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded bg-white/10">
                <div className="h-full bg-gold-500 transition-all duration-700" style={{ width: `${state.stats[k]}%` }} />
              </div>
            </div>
          )
        })}
        <p className="text-[9px] uppercase tracking-widest text-parchment/35">Schematic indices, not measurements</p>
      </div>
      <div className="mt-2 flex gap-1 border-b border-white/10" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} data-testid={`world-tab-${t.id}`} onClick={() => setTab(t.id)} className={`relative px-1.5 pb-1 text-[11px] ${tab === t.id ? 'border-b-2 border-gold-400 text-gold-300' : 'text-parchment/55 hover:text-parchment'}`}>
            {t.label}
            {counts[t.id] > 0 && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold-400" />}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {tab === 'people'
          ? vars.map((v) => {
              const opt = v.options.find((o) => o.id === state.vars[v.id])
              const col = v.figure ? FACTION_COLOR[v.figure.faction] : '#888'
              return (
                <div key={`${v.id}-${state.vars[v.id]}`} className={`flex items-center gap-2 rounded px-1 py-1 ${changed(v) ? 'wi-flash' : ''}`} data-testid={`var-${v.id}`} data-value={state.vars[v.id]}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 bg-black/40 font-serif text-[11px] text-parchment" style={{ borderColor: col }}>
                    {initials(v.label)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-parchment">{v.label}</span>
                    <span className={`block text-[11px] leading-tight ${toneText(opt?.tone)}`}>{opt?.label}</span>
                  </span>
                </div>
              )
            })
          : vars.map((v) => {
              const opt = v.options.find((o) => o.id === state.vars[v.id])
              return (
                <div key={`${v.id}-${state.vars[v.id]}`} className={`rounded px-1 py-0.5 ${changed(v) ? 'wi-flash' : ''}`} title={v.note} data-testid={`var-${v.id}`} data-value={state.vars[v.id]}>
                  <p className="text-[10px] uppercase tracking-wider text-parchment/45">
                    {tab === 'society' && <span className="text-gold-500/70">{CAT_LABEL[v.category]} · </span>}
                    {v.label}
                  </p>
                  <p className={`text-xs leading-snug ${toneText(opt?.tone)}`}>
                    {opt?.label}
                    {changed(v) && prev && <span className="ml-1 text-[10px] text-parchment/40">(was {optionLabel(v, prev.vars[v.id])})</span>}
                  </p>
                </div>
              )
            })}
        {tab === 'powers' && (
          <div className="pt-1">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-parchment/45">Regions (schematic, not borders)</p>
            {sc.territories.map((t) => {
              const f = state.control[t.id] ?? t.initial
              const ch = !!prev && prev.control[t.id] !== f
              return (
                <p key={`${t.id}-${f}`} className={`flex items-center gap-2 rounded px-1 text-[11px] text-parchment/75 ${ch ? 'wi-flash' : ''}`} data-testid={`terr-${t.id}`} data-value={f}>
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full transition-colors duration-700" style={{ background: FACTION_COLOR[f] }} />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto shrink-0 text-parchment/45">{FACTION_NAME[f].split(' ')[0]}</span>
                </p>
              )
            })}
          </div>
        )}
      </div>
    </Panel>
  )
}
