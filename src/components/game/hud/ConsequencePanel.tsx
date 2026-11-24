'use client'
import type { ApplyResult, Scenario, WorldState } from '@/game/types'
import type { CommitKind } from '@/game/branches'
import { diffState } from '@/game/engine'
import { optionLabel } from '@/game/compare'
import { FACTION_NAME } from '@/game/factions'
import { Btn, ForkIcon, KindBadge, Panel, toneText } from './ui'

export interface LastResult {
  result: ApplyResult
  before: WorldState
  commit: CommitKind | null
  branchName: string
  viewOnly: boolean
  affected: string[]
}

function Changes({ sc, from, to }: { sc: Scenario; from: WorldState; to: WorldState }) {
  const d = diffState(from, to)
  if (!d.stats.length && !d.control.length && !d.vars.length) return <p className="text-xs text-parchment/50">No tracked changes.</p>
  return (
    <div className="space-y-0.5 text-xs text-parchment/80">
      {d.control.map((c) => (
        <p key={c.territory}>
          <span className="text-parchment/50">Region</span> {sc.territories.find((t) => t.id === c.territory)?.name}: {FACTION_NAME[c.from]} → <b className="text-parchment">{FACTION_NAME[c.to]}</b>
        </p>
      ))}
      {d.vars.map((c) => {
        const v = sc.vars.find((x) => x.id === c.id)!
        const tone = v.options.find((o) => o.id === c.to)?.tone
        return (
          <p key={c.id}>
            <span className="text-parchment/50">{v.label}:</span> {optionLabel(v, c.from)} → <b className={toneText(tone)}>{optionLabel(v, c.to)}</b>
          </p>
        )
      })}
      {d.stats.map((c) => (
        <p key={c.id}>
          <span className="text-parchment/50">{sc.statMeta[c.id].label}:</span> {c.from} → <b className={c.to > c.from ? 'text-emerald-300' : 'text-rose-300'}>{c.to}</b>
        </p>
      ))}
    </div>
  )
}

export default function ConsequencePanel({ sc, last, ended, onContinue, onReplay, onCompare, onSite }: { sc: Scenario; last: LastResult; ended: boolean; onContinue: () => void; onReplay: () => void; onCompare: (() => void) | null; onSite: (id: string) => void }) {
  const { result, before } = last
  const o = result.outcome
  const step = result.state.history[result.state.history.length - 1]
  const echo = step.diverged && result.choice.historical
  return (
    <Panel className="wi-in max-h-[calc(100vh-15rem)] space-y-3 overflow-y-auto" data-testid="consequence-panel">
      {last.commit === 'fork' && <p className="rounded bg-fuchsia-500/15 px-2 py-1 text-xs text-fuchsia-100" data-testid="fork-notice"><ForkIcon /> New branch created: <b>{last.branchName}</b>. Your earlier timeline is unchanged.</p>}
      {last.commit === 'switch' && <p className="rounded bg-sky-500/15 px-2 py-1 text-xs text-sky-100">You joined an existing branch: <b>{last.branchName}</b>.</p>}
      {last.viewOnly && <p className="rounded bg-white/5 px-2 py-1 text-xs text-parchment/70">Replay of a recorded decision. Nothing was changed.</p>}
      <div className="flex items-center justify-between gap-2">
        <KindBadge kind={o.kind} echo={echo} />
        <span className="text-xs text-parchment/50">until {o.endYear}</span>
      </div>
      <h2 className="font-serif text-2xl">{o.title}</h2>
      <p className="text-sm italic text-parchment/75">{o.visual}</p>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gold-400">Immediate effects</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-parchment/85">{o.immediate.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gold-400">Long-term effects</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-parchment/85">{o.longTerm.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <div className="rounded border border-white/10 p-2" data-testid="diff">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-parchment/50">World changes</p>
        <Changes sc={sc} from={before} to={result.afterChoice} />
        {result.entered?.enter && (
          <div className="mt-2 border-t border-white/10 pt-2" data-testid="time-passes">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-parchment/50">{result.entered.enter.label} · towards {result.entered.dateLabel}</p>
            <Changes sc={sc} from={result.afterChoice} to={result.state} />
          </div>
        )}
      </div>
      {last.affected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-parchment/50">Affected</span>
          {last.affected.map((id) => (
            <button key={id} onClick={() => onSite(id)} className="rounded-full border border-gold-500/40 px-2 py-0.5 text-[11px] text-gold-200 hover:bg-gold-500/10">
              {sc.sites.find((s) => s.id === id)?.name}
            </button>
          ))}
        </div>
      )}
      <div className="rounded border border-white/10 bg-white/[0.03] p-2">
        <p className="text-[10px] uppercase tracking-widest text-parchment/50">{o.kind === 'fictional' ? 'What history actually did' : echo ? 'What really happened at this moment' : 'Historical context'}</p>
        <p className="mt-1 text-xs leading-relaxed text-parchment/80">{o.context}</p>
        {echo && <p className="mt-1 text-[11px] text-fuchsia-200/80">This timeline had already diverged, so here the outcome mirrors reality but belongs to an alternate history.</p>}
      </div>
      {o.sources.length > 0 && <p className="text-[11px] text-parchment/55">Further reading: {o.sources.map((s) => sc.sources[s]?.label ?? s).join(' · ')}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn primary data-testid="continue-story" onClick={onContinue}>{last.viewOnly ? 'Back to the present' : ended ? 'See the ending' : 'Continue to the next event'}</Btn>
        <Btn onClick={onReplay}>Replay cinematic</Btn>
        {onCompare && <Btn data-testid="compare-from-consequence" onClick={onCompare}>Compare with original</Btn>}
      </div>
    </Panel>
  )
}
