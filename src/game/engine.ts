import type { ApplyResult, Choice, ChronicleEntry, DecisionNode, Effect, Ending, NextRule, Requirement, Scenario, StatId, WorldState } from './types.ts'

/**
 * Deterministic simulation engine.
 * state' = apply(state, choice): a pure function with no clocks and no randomness,
 * so a timeline is fully described by its ordered list of choice ids (see replay()).
 */
const clampStat = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

function clone(s: WorldState): WorldState {
  return { year: s.year, node: s.node, control: { ...s.control }, flags: { ...s.flags }, stats: { ...s.stats }, vars: { ...s.vars }, history: [...s.history] }
}

export function createInitialState(sc: Scenario): WorldState {
  const s: WorldState = {
    year: sc.startYear,
    node: sc.start,
    control: { ...sc.initialControl },
    flags: {},
    stats: { ...sc.initialStats },
    vars: Object.fromEntries(sc.vars.map((v) => [v.id, v.initial])),
    history: [],
  }
  enterNode(sc, s)
  return s
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
  if (r.vars && !Object.entries(r.vars).every(([id, allowed]) => allowed.includes(s.vars[id]))) return false
  if (r.allHistorical && s.history.some((h) => h.diverged)) return false
  return true
}

export function availableChoices(sc: Scenario, s: WorldState): { choice: Choice; locked: boolean }[] {
  const node = getNode(sc, s)
  return node ? node.choices.map((choice) => ({ choice, locked: !meetsRequirement(s, choice.requires) })) : []
}

function applyEffect(sc: Scenario, s: WorldState, e: Effect) {
  switch (e.type) {
    case 'control':
      if (!(e.territory in sc.initialControl)) throw new Error(`Unknown territory "${e.territory}".`)
      s.control[e.territory] = e.to
      break
    case 'flag':
      s.flags[e.flag] = true
      break
    case 'stat':
      s.stats[e.stat as StatId] = clampStat(s.stats[e.stat as StatId] + e.delta)
      break
    case 'var': {
      const v = sc.vars.find((x) => x.id === e.id)
      if (!v || !v.options.some((o) => o.id === e.to)) throw new Error(`Unknown world value ${e.id}=${e.to}.`)
      s.vars[e.id] = e.to
      break
    }
    case 'when':
      if (meetsRequirement(s, e.if)) e.then.forEach((x) => applyEffect(sc, s, x))
      break
  }
}

function enterNode(sc: Scenario, s: WorldState) {
  const node = getNode(sc, s)
  if (!node?.enter) return
  if (node.enter.year) s.year = Math.max(s.year, node.enter.year)
  node.enter.effects.forEach((e) => applyEffect(sc, s, e))
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
  const diverged = (s.history.length > 0 && s.history[s.history.length - 1].diverged) || !choice.historical
  const next = clone(s)
  next.year = choice.outcome.endYear
  next.history.push({ nodeId: node.id, choiceId, kind: choice.outcome.kind, year: node.year, diverged })
  choice.effects.forEach((e) => applyEffect(sc, next, e))
  next.node = resolveNext(choice.next, next)
  const afterChoice = clone(next)
  enterNode(sc, next)
  return { state: next, afterChoice, entered: getNode(sc, next), node, choice, outcome: choice.outcome }
}

/** Rebuilds a state from an ordered list of choice ids. Invalid ids end the replay (returns what was valid). */
export function replay(sc: Scenario, choiceIds: readonly string[]): { state: WorldState; applied: string[] } {
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

/** All states along a timeline: index i is the world before decision i (last one is the end). */
export function statesAlong(sc: Scenario, choiceIds: readonly string[]): WorldState[] {
  const out = [createInitialState(sc)]
  for (const id of choiceIds) {
    try {
      out.push(applyChoice(sc, out[out.length - 1], id).state)
    } catch {
      break
    }
  }
  return out
}

/** The documented course of events: follow the single historical choice at every node. */
export function canonicalPath(sc: Scenario): string[] {
  const path: string[] = []
  let s = createInitialState(sc)
  while (!isEnded(s)) {
    const node = getNode(sc, s)!
    const hist = node.choices.filter((c) => c.historical)
    if (hist.length !== 1) throw new Error(`Node "${node.id}" on the documented path needs exactly one historical choice.`)
    s = applyChoice(sc, s, hist[0].id).state
    path.push(hist[0].id)
  }
  return path
}

/** Every complete path through the scenario (respecting requirements). */
export function enumeratePaths(sc: Scenario): string[][] {
  const out: string[][] = []
  const walk = (s: WorldState, path: string[]) => {
    if (isEnded(s)) return void out.push(path)
    for (const { choice, locked } of availableChoices(sc, s)) if (!locked) walk(applyChoice(sc, s, choice.id).state, [...path, choice.id])
  }
  walk(createInitialState(sc), [])
  return out
}

/** Index of the first decision that leaves documented history; -1 if the timeline never leaves it. */
export function divergenceIndex(sc: Scenario, choiceIds: readonly string[]): number {
  const canon = canonicalPath(sc)
  for (let i = 0; i < choiceIds.length; i++) if (choiceIds[i] !== canon[i]) return i
  return -1
}

/** Dated entries of a timeline: documented background, then every outcome's entries in order. */
export function chronicle(sc: Scenario, choiceIds: readonly string[]): ChronicleEntry[] {
  const out: ChronicleEntry[] = sc.prelude.map((e) => ({ ...e, kind: 'historical', echo: false, step: -1, nodeId: null }))
  let s = createInitialState(sc)
  for (let i = 0; i < choiceIds.length; i++) {
    let r: ApplyResult
    try {
      r = applyChoice(sc, s, choiceIds[i])
    } catch {
      break
    }
    const step = r.state.history[i]
    for (const seed of r.outcome.chronicle) out.push({ ...seed, kind: step.diverged ? 'fictional' : 'historical', echo: step.diverged && r.choice.historical, step: i, nodeId: r.node.id })
    s = r.state
  }
  return out.map((e, i) => ({ e, i })).sort((a, b) => a.e.year - b.e.year || a.i - b.i).map((x) => x.e)
}

export function evaluateEnding(sc: Scenario, s: WorldState): Ending | null {
  if (!isEnded(s)) return null
  return sc.endings.find((e) => meetsRequirement(s, e.when)) ?? null
}

/** Stable, order-independent hash of a world state (FNV-1a, 32 bit). Same decisions => same fingerprint. */
export function fingerprint(s: WorldState): string {
  const sort = (o: Record<string, unknown>) => Object.keys(o).sort().map((k) => [k, o[k]])
  const text = JSON.stringify([s.year, s.node, sort(s.control), Object.keys(s.flags).sort(), sort(s.stats), sort(s.vars), s.history.map((h) => h.choiceId)])
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
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
  return { decisions: s.history.length, fictional, historical: s.history.length - fictional, diverged: s.history.some((h) => h.diverged) }
}

export function diffState(before: WorldState, after: WorldState) {
  const stats = (Object.keys(after.stats) as StatId[])
    .map((id) => ({ id, from: before.stats[id], to: after.stats[id] }))
    .filter((d) => d.from !== d.to)
  const control = Object.keys(after.control)
    .filter((t) => before.control[t] !== after.control[t])
    .map((t) => ({ territory: t, from: before.control[t], to: after.control[t] }))
  const vars = Object.keys(after.vars)
    .filter((v) => before.vars[v] !== after.vars[v])
    .map((v) => ({ id: v, from: before.vars[v], to: after.vars[v] }))
  return { stats, control, vars }
}

/* ---------- map helpers (pure) ---------- */
function angularDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / r
}

/** The schematic territory a site belongs to: the containing region whose centre is relatively closest. */
export function siteTerritory(sc: Scenario, siteId: string): string | null {
  const site = sc.sites.find((x) => x.id === siteId)
  if (!site) return null
  const hits = sc.territories
    .map((t) => ({ id: t.id, k: angularDistance(site.lat, site.lng, t.lat, t.lng) / t.radius }))
    .filter((x) => x.k <= 1)
    .sort((a, b) => a.k - b.k)
  return hits[0]?.id ?? null
}

export function capitalSite(sc: Scenario, s: WorldState): string | null {
  for (const v of sc.vars) {
    const opt = v.options.find((o) => o.id === s.vars[v.id])
    if (v.category === 'political' && opt?.siteId) return opt.siteId
  }
  return null
}

/** Sites touched by a change: territory flips, world variables tied to a site, capital moves. */
export function affectedSites(sc: Scenario, before: WorldState, after: WorldState, extra?: string | null): string[] {
  const out = new Set<string>()
  const d = diffState(before, after)
  const flipped = new Set(d.control.map((c) => c.territory))
  for (const site of sc.sites) {
    const t = siteTerritory(sc, site.id)
    if (t && flipped.has(t)) out.add(site.id)
  }
  for (const ch of d.vars) {
    const v = sc.vars.find((x) => x.id === ch.id)
    if (v?.siteId) out.add(v.siteId)
    for (const o of v?.options ?? []) if (o.siteId && (o.id === ch.from || o.id === ch.to)) out.add(o.siteId)
  }
  if (extra) out.add(extra)
  return sc.sites.map((x) => x.id).filter((id) => out.has(id))
}
