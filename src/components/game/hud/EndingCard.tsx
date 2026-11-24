'use client'
import type { Ending, Scenario, WorldState } from '@/game/types'
import { summarize } from '@/game/engine'
import { Btn, KindBadge, Panel } from './ui'

export default function EndingCard({ sc, state, ending, discovered, branchName, isOriginal, onCompare, onBranches, onReplay, onRestart }: { sc: Scenario; state: WorldState; ending: Ending | null; discovered: string[]; branchName: string; isOriginal: boolean; onCompare: () => void; onBranches: () => void; onReplay: () => void; onRestart: () => void }) {
  const sum = summarize(state)
  return (
    <Panel className="wi-in w-[min(34rem,calc(100vw-2rem))] !p-7 text-center" data-testid="ending" data-ending={ending?.id ?? ''}>
      <p className="text-xs uppercase tracking-[0.3em] text-gold-400">End of this timeline · {state.year}</p>
      <p className="mt-1 text-xs text-parchment/50">{branchName}</p>
      <h2 className="mt-2 font-serif text-3xl">{ending?.title ?? 'The story ends'}</h2>
      {ending && <KindBadge kind={ending.kind} className="mt-2 inline-block" />}
      {ending && <p className="mt-3 text-sm leading-relaxed text-parchment/80">{ending.text}</p>}
      <p className="mt-3 text-xs text-parchment/60">
        {sum.decisions} decisions: {sum.historical} followed documented history, {sum.fictional} diverged into alternate-history fiction.
      </p>
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-widest text-parchment/50" data-testid="endings-count">
          Endings discovered {discovered.length} / {sc.endings.length}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {sc.endings.map((e) => {
            const got = discovered.includes(e.id)
            return (
              <div key={e.id} title={got ? e.title : 'Not yet discovered'} className={`rounded border px-1 py-1.5 text-[10px] leading-tight ${e.id === ending?.id ? 'border-gold-400 bg-gold-500/15 text-gold-200' : got ? 'border-white/15 text-parchment/75' : 'border-dashed border-white/10 text-parchment/30'}`}>
                {got ? e.title : '?'}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {!isOriginal && <Btn primary data-testid="ending-compare" onClick={onCompare}>Compare with original history</Btn>}
        <Btn onClick={onBranches} data-testid="ending-branches">Branch from an earlier decision</Btn>
        <Btn onClick={onReplay} data-testid="ending-replay">Replay this timeline</Btn>
        <Btn onClick={onRestart} primary={isOriginal}>Start again from {sc.startYear}</Btn>
      </div>
    </Panel>
  )
}
