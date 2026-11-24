import type { ChronicleEntry, Ending, FactionId, Scenario, StatId, WorldVar } from './types.ts'
import { chronicle, evaluateEnding, replay } from './engine.ts'

/**
 * Compare two timelines of the same scenario, built from their decision histories. Pure.
 * Events are aligned by their `key`: the same key in both timelines is "the same event", which may then
 * differ in date or in what happened.
 */
export type RowStatus = 'same' | 'date' | 'outcome' | 'only-a' | 'only-b'
export interface CompareRow {
  key: string
  a?: ChronicleEntry
  b?: ChronicleEntry
  status: RowStatus
  dateDiffers: boolean
  outcomeDiffers: boolean
  year: number
}
export interface Comparison {
  divergence: { index: number; nodeId: string; nodeTitle: string; a: string | null; b: string | null } | null
  rows: CompareRow[]
  vars: { v: WorldVar; a: string; b: string; differs: boolean }[]
  stats: { id: StatId; a: number; b: number }[]
  control: { territory: string; a: FactionId; b: FactionId; differs: boolean }[]
  years: { a: number; b: number }
  endings: { a: Ending | null; b: Ending | null }
  counts: Record<RowStatus, number>
}

export function compareTimelines(sc: Scenario, aChoices: readonly string[], bChoices: readonly string[]): Comparison {
  const A = replay(sc, aChoices)
  const B = replay(sc, bChoices)
  let divergence: Comparison['divergence'] = null
  const n = Math.max(A.applied.length, B.applied.length)
  for (let i = 0; i < n; i++) {
    if (A.applied[i] !== B.applied[i]) {
      const h = A.state.history[i] ?? B.state.history[i]
      const node = sc.nodes[h.nodeId]
      const label = (id?: string) => (id ? node.choices.find((c) => c.id === id)?.label ?? id : null)
      divergence = { index: i, nodeId: node.id, nodeTitle: node.title, a: label(A.applied[i]), b: label(B.applied[i]) }
      break
    }
  }

  const ca = chronicle(sc, A.applied)
  const cb = chronicle(sc, B.applied)
  const order: string[] = []
  for (const e of [...ca, ...cb].sort((x, y) => x.year - y.year)) if (!order.includes(e.key)) order.push(e.key)
  const counts: Record<RowStatus, number> = { same: 0, date: 0, outcome: 0, 'only-a': 0, 'only-b': 0 }
  const rows = order.map((key): CompareRow => {
    const a = ca.find((e) => e.key === key)
    const b = cb.find((e) => e.key === key)
    let status: RowStatus
    if (a && !b) status = 'only-a'
    else if (b && !a) status = 'only-b'
    else if (a!.title !== b!.title) status = 'outcome'
    else if (a!.year !== b!.year || a!.date !== b!.date) status = 'date'
    else status = 'same'
    counts[status]++
    const both = !!a && !!b
    return {
      key,
      a,
      b,
      status,
      dateDiffers: both && (a!.year !== b!.year || a!.date !== b!.date),
      outcomeDiffers: both && a!.title !== b!.title,
      year: Math.min(a?.year ?? Infinity, b?.year ?? Infinity),
    }
  })

  return {
    divergence,
    rows,
    vars: sc.vars.map((v) => ({ v, a: A.state.vars[v.id], b: B.state.vars[v.id], differs: A.state.vars[v.id] !== B.state.vars[v.id] })),
    stats: (Object.keys(sc.statMeta) as StatId[]).map((id) => ({ id, a: A.state.stats[id], b: B.state.stats[id] })),
    control: sc.territories.map((t) => ({ territory: t.id, a: A.state.control[t.id], b: B.state.control[t.id], differs: A.state.control[t.id] !== B.state.control[t.id] })),
    years: { a: A.state.year, b: B.state.year },
    endings: { a: evaluateEnding(sc, A.state), b: evaluateEnding(sc, B.state) },
    counts,
  }
}

export function optionLabel(v: WorldVar, id: string) {
  return v.options.find((o) => o.id === id)?.label ?? id
}
