'use client'
import type { Choice, DecisionNode, Scenario, WorldState } from '@/game/types'
import { ForkIcon, KindBadge, Panel } from './ui'

export interface ChoiceInfo {
  choice: Choice
  locked: boolean
  /** the active branch already took this option here */
  taken: boolean
  /** another stored branch already contains this path */
  exploredIn: string | null
  /** choosing it would create a new branch */
  forks: boolean
}

function requirementText(sc: Scenario, s: WorldState, c: Choice) {
  const r = c.requires?.stat
  return r ? `Needs ${sc.statMeta[r.id].label} ≥ ${r.min}; this timeline: ${s.stats[r.id]}.` : null
}

export default function DecisionPanel({ sc, node, state, choices, revisiting, diverged, failure, onChoose }: { sc: Scenario; node: DecisionNode; state: WorldState; choices: ChoiceInfo[]; revisiting: boolean; diverged: boolean; failure: string; onChoose: (id: string) => void }) {
  const variants = node.variants?.filter((v) => state.flags[v.flag]) ?? []
  return (
    <Panel className="wi-in max-h-[calc(100vh-15rem)] overflow-y-auto">
      <p className="text-[10px] uppercase tracking-widest text-gold-400">{node.dateLabel}</p>
      <h2 className="font-serif text-2xl">{node.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-parchment/80">{node.situation}</p>
      {variants.map((v) => (
        <p key={v.flag} className="mt-2 border-l-2 border-fuchsia-400/50 pl-3 text-xs italic text-parchment/70">{v.text}</p>
      ))}
      {node.dependsOn && (
        <p className="mt-2 text-[11px] text-parchment/50" data-testid="depends-on">
          <span className="text-gold-500/80">⛓ Depends on:</span> {node.dependsOn}
        </p>
      )}
      {revisiting && (
        <p className="mt-3 rounded border border-gold-500/25 bg-gold-500/5 p-2 text-xs text-parchment/80" data-testid="revisit-note">
          You are revisiting a decision of this timeline. Choose the same option to continue along it, or a different one to open a new branch. Nothing already recorded is lost.
        </p>
      )}
      <p className="mt-4 font-serif text-lg text-gold-200">{node.question}</p>
      <div className="mt-2 space-y-2">
        {choices.map(({ choice, locked, taken, exploredIn, forks }) => (
          <button
            key={choice.id}
            data-testid={`choice-${choice.id}`}
            data-taken={taken ? '1' : '0'}
            data-forks={forks ? '1' : '0'}
            disabled={locked}
            onClick={() => onChoose(choice.id)}
            className={`w-full rounded-md border p-3 text-left transition ${locked ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-50' : taken ? 'border-gold-500/50 bg-gold-500/10 hover:bg-gold-500/15' : 'border-white/10 bg-white/[0.04] hover:border-gold-500/60 hover:bg-gold-500/10'}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="font-medium">{choice.label}</span>
              <KindBadge kind={choice.historical ? 'historical' : 'fictional'} echo={choice.historical && diverged} />
            </span>
            <span className="mt-1 block text-xs text-parchment/65">{locked ? choice.lockedReason ?? 'Not available in this timeline.' : choice.summary}</span>
            {locked && requirementText(sc, state, choice) && <span className="mt-0.5 block text-[11px] text-rose-300/80">{requirementText(sc, state, choice)}</span>}
            {!locked && (taken || exploredIn || forks) && (
              <span className="mt-1.5 flex gap-1.5 text-[10px] uppercase tracking-wider">
                {taken && <span className="rounded bg-gold-500/20 px-1.5 py-0.5 text-gold-200">▸ Continue this timeline</span>}
                {!taken && exploredIn && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-200">Explored · {exploredIn}</span>}
                {!taken && !exploredIn && forks && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-200"><ForkIcon /> Opens a new branch</span>}
              </span>
            )}
          </button>
        ))}
      </div>
      {failure && <p className="mt-3 text-xs text-rose-300" role="alert">{failure}</p>}
    </Panel>
  )
}
