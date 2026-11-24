'use client'
import { useState } from 'react'
import type { Scenario } from '@/game/types'
import type { Branch, BranchSet } from '@/game/branches'
import { ORIGINAL_ID, allBranches, branchDivergence } from '@/game/branches'
import { evaluateEnding, replay } from '@/game/engine'
import BranchMap from './BranchMap'
import { Btn, Panel } from './ui'

function Row({ sc, b, active, onOpen, onCompare, onReplay, onDelete, onRename }: { sc: Scenario; b: Branch; active: boolean; onOpen: () => void; onCompare: () => void; onReplay: () => void; onDelete: () => void; onRename: (name: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(b.name)
  const div = branchDivergence(sc, b)
  const st = replay(sc, b.choices).state
  const ending = evaluateEnding(sc, st)
  const orig = b.id === ORIGINAL_ID
  return (
    <li className={`rounded-md border p-3 ${active ? 'border-gold-500/60 bg-gold-500/5' : 'border-white/10'}`} data-testid={`branch-row-${b.id}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${orig ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onRename(name)
                setEditing(false)
              }}
            >
              <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={() => (onRename(name), setEditing(false))} className="w-full rounded border border-gold-500/40 bg-black/40 px-2 py-0.5 text-sm" aria-label="Branch name" />
            </form>
          ) : (
            <p className="truncate text-sm text-parchment">
              {b.name} {active && <span className="ml-1 text-[10px] uppercase tracking-widest text-gold-300">· current</span>}
            </p>
          )}
          <p className="text-[11px] text-parchment/55">
            {orig ? 'The documented course of events. Read-only.' : div ? `Diverges ${div.node.dateLabel} at ${div.node.title}: ${div.choice?.label ?? ''}` : ''}
          </p>
          <p className="text-[11px] text-parchment/45">
            {b.choices.length} decision{b.choices.length === 1 ? '' : 's'} · reaches {st.year}
            {ending ? ` · ending: ${ending.title}` : ' · unfinished'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Btn className="!px-2 !py-1 !text-xs" onClick={onOpen} data-testid={`open-${b.id}`}>Open</Btn>
        {!orig && <Btn className="!px-2 !py-1 !text-xs" onClick={onCompare} data-testid={`compare-${b.id}`}>Compare</Btn>}
        <Btn className="!px-2 !py-1 !text-xs" onClick={onReplay} data-testid={`replay-${b.id}`}>Replay</Btn>
        {!orig && <Btn className="!px-2 !py-1 !text-xs" onClick={() => setEditing(true)}>Rename</Btn>}
        {!orig && (
          <Btn className={`!px-2 !py-1 !text-xs ${confirm ? '!border-rose-400 text-rose-200' : ''}`} onClick={() => (confirm ? onDelete() : setConfirm(true))} onBlur={() => setConfirm(false)} data-testid={`delete-${b.id}`}>
            {confirm ? 'Click again to delete' : 'Delete'}
          </Btn>
        )}
      </div>
    </li>
  )
}

export default function BranchDrawer(p: {
  sc: Scenario
  set: BranchSet
  onClose: () => void
  onOpen: (id: string) => void
  onCompare: (id: string) => void
  onReplay: (id: string) => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
  onRename: (id: string, name: string) => void
  onNew: () => void
  onPick: (prefix: string[]) => void
}) {
  const [confirmAll, setConfirmAll] = useState(false)
  const list = allBranches(p.sc, p.set)
  const active = list.find((b) => b.id === p.set.activeId)!
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={p.onClose} data-testid="branch-drawer">
      <Panel className="wi-in flex max-h-[calc(100vh-2rem)] w-[min(56rem,100%)] flex-col !p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl">Timelines</h2>
          <p className="text-xs text-parchment/55">
            {p.set.branches.length} branch{p.set.branches.length === 1 ? '' : 'es'} · endings discovered {p.set.discovered.length} / {p.sc.endings.length}
          </p>
          <button className="ml-auto text-sm text-parchment/60 hover:text-parchment" onClick={p.onClose} data-testid="close-drawer">Close ✕</button>
        </div>
        <div className="mt-3 rounded border border-white/10 bg-black/30 p-2">
          <p className="mb-1 flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-parchment/50">
            <span>Every possible path</span>
            <span className="text-emerald-300">— original history</span>
            <span className="text-fuchsia-300">— explored</span>
            <span className="text-gold-300">— current</span>
            <span className="text-parchment/40">--- unexplored (click to go there)</span>
          </p>
          <BranchMap sc={p.sc} explored={list.map((b) => b.choices)} activePath={active.choices} onPick={p.onPick} />
        </div>
        <ul className="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {list.map((b) => (
            <Row
              key={b.id}
              sc={p.sc}
              b={b}
              active={b.id === p.set.activeId}
              onOpen={() => p.onOpen(b.id)}
              onCompare={() => p.onCompare(b.id)}
              onReplay={() => p.onReplay(b.id)}
              onDelete={() => p.onDelete(b.id)}
              onRename={(n) => p.onRename(b.id, n)}
            />
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn primary onClick={p.onNew} data-testid="new-timeline">New timeline from {p.sc.startYear}</Btn>
          {p.set.branches.length > 0 && (
            <Btn className={confirmAll ? '!border-rose-400 text-rose-200' : ''} onClick={() => (confirmAll ? (p.onDeleteAll(), setConfirmAll(false)) : setConfirmAll(true))} onBlur={() => setConfirmAll(false)}>
              {confirmAll ? 'Click again to delete all branches' : 'Delete all my branches'}
            </Btn>
          )}
          <p className="ml-auto self-center text-[11px] text-parchment/40">Branches are saved in this browser.</p>
        </div>
      </Panel>
    </div>
  )
}
