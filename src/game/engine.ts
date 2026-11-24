import type { ApplyResult, Choice, DecisionNode, Effect, NextRule, Requirement, Scenario, StatId, WorldState } from './types.ts'

/**
 * Deterministic simulation engine.
 * state' = apply(state, choice): a pure function with no clocks and no randomness,
 * so a run is fully described by its ordered list of choice ids (see replay()).
 */
const clampStat = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

export function createInitialState(sc: Scenario): WorldState {
  return {
    year: sc.startYear,
    node: sc.start,
    control: { ...sc.initialControl },
    flags: {},
    stats: { ...sc.initialStats },
    history: [],
  }
}

export function getNode(sc: Scenario, s: WorldState): DecisionNode | null {
  return s.node ? sc.nodes[s.node] ?? null : null
}

export function isEnded(s: WorldState) {
  return s.node === null
}

export function meetsRequirement(s: WorldState, r?: Requirement): boolean {
  if (!r) return true
  if (r.flags && !r.flags.every((f) => s.flags[f])) return false
  if (r.notFlags && r.notFlags.some((f) => s.flags[f])) return false
  if (r.stat && s.stats[r.stat.id] < r.stat.min) return false
  return true
}

export function availableChoices(sc: Scenario, s: WorldState): { choice: Choice; locked: boolean }[] {
  const node = getNode(sc, s)
  return node ? node.choices.map((choice) => ({ choice, locked: !meetsRequirement(s, choice.requires) })) : []
}

function applyEffect(s: WorldState, e: Effect) {
  if (e.type === 'control') s.control[e.territory] = e.to
  else if (e.type === 'flag') s.flags[e.flag] = true
  else s.stats[e.stat as StatId] = clampStat(s.stats[e.stat as StatId] + e.delta)
}

function resolveNext(rules: NextRule[], s: WorldState): string | null {
  for (const r of rules) {
    if (r.whenFlags && !r.whenFlags.every((f) => s.flags[f])) continue
    if (r.whenNotFlags && r.whenNotFlags.some((f) => s.flags[f])) continue
    return r.goto
  }
  return null
}

export function applyChoice(sc: Scenario, s: WorldState, choiceId: string): ApplyResult {
  const node = getNode(sc, s)
  if (!node) throw new Error('The scenario has already ended.')
  const choice = node.choices.find((c) => c.id === choiceId)
  if (!choice) throw new Error(`Unknown choice "${choiceId}" at node "${node.id}".`)
  if (!meetsRequirement(s, choice.requires)) throw new Error(`Choice "${choiceId}" is locked.`)
  const next: WorldState = {
    year: choice.outcome.endYear,
    node: s.node,
    control: { ...s.control },
    flags: { ...s.flags },
    stats: { ...s.stats },
    history: [...s.history, { nodeId: node.id, choiceId, kind: choice.outcome.kind, year: node.year }],
  }
  choice.effects.forEach((e) => applyEffect(next, e))
  next.node = resolveNext(choice.next, next)
  return { state: next, node, choice, outcome: choice.outcome }
}

/** Rebuilds a state from an ordered list of choice ids. Invalid ids end the replay (returns what was valid). */
export function replay(sc: Scenario, choiceIds: string[]): { state: WorldState; applied: string[] } {
  let state = createInitialState(sc)
  const applied: string[] = []
  for (const id of choiceIds) {
    try {
      state = applyChoice(sc, state, id).state
      applied.push(id)
    } catch {
      break
    }
  }
  return { state, applied }
}

/** Longest possible number of decisions on any path (for the progress indicator). */
export function maxDepth(sc: Scenario): number {
  const memo: Record<string, number> = {}
  const walk = (id: string | null, seen: string[]): number => {
    if (!id || seen.includes(id)) return 0
    if (memo[id] !== undefined) return memo[id]
    const node = sc.nodes[id]
    let best = 0
    for (const c of node.choices) for (const r of c.next) best = Math.max(best, walk(r.goto, [...seen, id]))
    return (memo[id] = 1 + best)
  }
  return walk(sc.start, [])
}

export function summarize(s: WorldState) {
  const fictional = s.history.filter((h) => h.kind === 'fictional').length
  return { decisions: s.history.length, fictional, historical: s.history.length - fictional }
}

export function diffState(before: WorldState, after: WorldState) {
  const stats = (Object.keys(after.stats) as StatId[])
    .map((id) => ({ id, from: before.stats[id], to: after.stats[id] }))
    .filter((d) => d.from !== d.to)
  const control = Object.keys(after.control)
    .filter((t) => before.control[t] !== after.control[t])
    .map((t) => ({ territory: t, from: before.control[t], to: after.control[t] }))
  return { stats, control }
}
