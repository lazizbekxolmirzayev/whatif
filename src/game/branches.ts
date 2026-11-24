import type { Scenario } from './types.ts'
import { canonicalPath, divergenceIndex, evaluateEnding, fingerprint, getNode, replay } from './engine.ts'

/**
 * Branching timelines. Pure functions over a serialisable BranchSet:
 *  - the ORIGINAL timeline is derived from the scenario data (the documented path) and is never stored
 *    or modified;
 *  - every user branch is just an ordered list of choice ids, so it can always be rebuilt with replay();
 *  - a stored fingerprint detects branches that no longer replay to the same world (e.g. data changed).
 */
export const ORIGINAL_ID = 'original'
export const MAX_BRANCHES = 30

export interface Branch {
  id: string
  name: string
  choices: string[]
  parentId: string | null
  /** number of decisions shared with the parent when this branch was created */
  forkAt: number | null
  createdAt: number
  updatedAt: number
  fingerprint: string
}

export interface BranchSet {
  version: 2
  branches: Branch[]
  activeId: string
  /** how many decisions of the active branch are currently "lived"; later ones are its recorded future */
  cursor: number
  /** ending ids reached in any branch, kept even if that branch is deleted */
  discovered: string[]
}

export type CommitKind = 'advance' | 'append' | 'switch' | 'fork'
export interface CommitResult {
  set: BranchSet
  kind: CommitKind
  branchId: string
  error?: string
}

const frozen = new WeakMap<Scenario, Branch>()
/** The documented timeline. Frozen: any attempt to mutate it throws in strict mode. */
export function originalBranch(sc: Scenario): Branch {
  const hit = frozen.get(sc)
  if (hit) return hit
  const choices = canonicalPath(sc)
  const b: Branch = Object.freeze({
    id: ORIGINAL_ID,
    name: 'Original history',
    choices: Object.freeze([...choices]) as unknown as string[],
    parentId: null,
    forkAt: null,
    createdAt: 0,
    updatedAt: 0,
    fingerprint: fingerprint(replay(sc, choices).state),
  })
  frozen.set(sc, b)
  return b
}

export function emptySet(): BranchSet {
  return { version: 2, branches: [], activeId: ORIGINAL_ID, cursor: 0, discovered: [] }
}

export function allBranches(sc: Scenario, set: BranchSet): Branch[] {
  return [originalBranch(sc), ...set.branches]
}

export function getBranch(sc: Scenario, set: BranchSet, id: string): Branch {
  return allBranches(sc, set).find((b) => b.id === id) ?? originalBranch(sc)
}

export function activeBranch(sc: Scenario, set: BranchSet): Branch {
  return getBranch(sc, set, set.activeId)
}

const startsWith = (a: readonly string[], prefix: readonly string[]) => prefix.length <= a.length && prefix.every((x, i) => a[i] === x)

/** Human name for a new branch, from the choice that created it. */
export function branchName(sc: Scenario, set: BranchSet, choices: readonly string[], at: number): string {
  const { state } = replay(sc, choices.slice(0, at))
  const label = getNode(sc, state)?.choices.find((c) => c.id === choices[at])?.label ?? 'New timeline'
  const base = `What if: ${label}`
  const taken = new Set(set.branches.map((b) => b.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} (${n})`)) n++
  return `${base} (${n})`
}

function withDiscovered(sc: Scenario, set: BranchSet, choices: readonly string[]): string[] {
  const e = evaluateEnding(sc, replay(sc, choices).state)
  return e && !set.discovered.includes(e.id) ? [...set.discovered, e.id] : set.discovered
}

/**
 * Record a decision taken at the cursor of the active branch.
 *  advance: the branch already took this choice here -> move the cursor forward;
 *  append:  a user branch at its end -> extend it;
 *  switch:  another branch already holds this exact path -> move to it (no duplicates);
 *  fork:    otherwise -> create a new branch. The previous branch is left untouched.
 */
export function commitChoice(sc: Scenario, set: BranchSet, choiceId: string, now: number, newId: () => string): CommitResult {
  const active = activeBranch(sc, set)
  const cursor = Math.min(set.cursor, active.choices.length)
  const next = [...active.choices.slice(0, cursor), choiceId]
  const check = replay(sc, next)
  if (check.applied.length !== next.length) return { set, kind: 'advance', branchId: active.id, error: 'That decision is not available here.' }
  const fp = fingerprint(check.state)

  if (active.choices[cursor] === choiceId) {
    return { set: { ...set, cursor: cursor + 1, discovered: withDiscovered(sc, set, next) }, kind: 'advance', branchId: active.id }
  }
  if (active.id !== ORIGINAL_ID && cursor === active.choices.length) {
    const branches = set.branches.map((b) => (b.id === active.id ? { ...b, choices: next, updatedAt: now, fingerprint: fp } : b))
    return { set: { ...set, branches, cursor: next.length, discovered: withDiscovered(sc, set, next) }, kind: 'append', branchId: active.id }
  }
  const existing = allBranches(sc, set).find((b) => startsWith(b.choices, next))
  if (existing) {
    return { set: { ...set, activeId: existing.id, cursor: next.length, discovered: withDiscovered(sc, set, next) }, kind: 'switch', branchId: existing.id }
  }
  if (set.branches.length >= MAX_BRANCHES) return { set, kind: 'fork', branchId: active.id, error: `You can keep up to ${MAX_BRANCHES} branches. Delete one to create another.` }
  const b: Branch = { id: newId(), name: branchName(sc, set, next, cursor), choices: next, parentId: active.id, forkAt: cursor, createdAt: now, updatedAt: now, fingerprint: fp }
  return { set: { ...set, branches: [...set.branches, b], activeId: b.id, cursor: next.length, discovered: withDiscovered(sc, set, next) }, kind: 'fork', branchId: b.id }
}

export function navigate(sc: Scenario, set: BranchSet, branchId: string, cursor: number): BranchSet {
  const b = getBranch(sc, set, branchId)
  return { ...set, activeId: b.id, cursor: Math.max(0, Math.min(cursor, b.choices.length)) }
}

export function renameBranch(set: BranchSet, id: string, name: string, now: number): BranchSet {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!clean || id === ORIGINAL_ID) return set
  return { ...set, branches: set.branches.map((b) => (b.id === id ? { ...b, name: clean, updatedAt: now } : b)) }
}

export function deleteBranch(set: BranchSet, id: string): BranchSet {
  if (id === ORIGINAL_ID) return set
  const branches = set.branches.filter((b) => b.id !== id)
  return set.activeId === id ? { ...set, branches, activeId: ORIGINAL_ID, cursor: 0 } : { ...set, branches }
}

export function deleteAll(set: BranchSet): BranchSet {
  return { ...emptySet(), discovered: set.discovered }
}

/** Where a branch leaves documented history, for labels. */
export function branchDivergence(sc: Scenario, b: Branch) {
  const i = divergenceIndex(sc, b.choices)
  if (i < 0) return null
  const { state } = replay(sc, b.choices.slice(0, i))
  const node = getNode(sc, state)
  return node ? { index: i, node, choice: node.choices.find((c) => c.id === b.choices[i]) ?? null } : null
}

/**
 * Parse and repair a stored set. Anything malformed is dropped; a branch whose choices no longer replay
 * is cut back to its longest valid prefix; branches identical to the original are removed.
 */
export function loadSet(sc: Scenario, raw: unknown): { set: BranchSet; repaired: string[] } {
  const repaired: string[] = []
  const set = emptySet()
  if (!raw || typeof raw !== 'object') return { set, repaired }
  const r = raw as Partial<BranchSet>
  const canon = originalBranch(sc).choices
  const seen = new Set<string>()
  for (const b of Array.isArray(r.branches) ? r.branches : []) {
    if (!b || typeof b.id !== 'string' || !Array.isArray(b.choices) || !b.choices.every((x: unknown) => typeof x === 'string')) continue
    const rep = replay(sc, b.choices)
    const choices = rep.applied
    const fp = fingerprint(rep.state)
    if (choices.length !== b.choices.length || fp !== b.fingerprint) repaired.push(String(b.name ?? b.id))
    const key = choices.join('>')
    if (!choices.length || startsWith(canon, choices) || seen.has(key) || b.id === ORIGINAL_ID) continue
    seen.add(key)
    set.branches.push({
      id: b.id,
      name: typeof b.name === 'string' && b.name.trim() ? b.name.slice(0, 60) : 'Untitled branch',
      choices,
      parentId: typeof b.parentId === 'string' ? b.parentId : null,
      forkAt: typeof b.forkAt === 'number' ? b.forkAt : null,
      createdAt: Number(b.createdAt) || 0,
      updatedAt: Number(b.updatedAt) || 0,
      fingerprint: fp,
    })
    if (set.branches.length >= MAX_BRANCHES) break
  }
  const active = allBranches(sc, set).find((b) => b.id === r.activeId)
  set.activeId = active?.id ?? ORIGINAL_ID
  set.cursor = active ? Math.max(0, Math.min(Number(r.cursor) || 0, active.choices.length)) : 0
  const endingIds = new Set(sc.endings.map((e) => e.id))
  set.discovered = Array.isArray(r.discovered) ? r.discovered.filter((x): x is string => typeof x === 'string' && endingIds.has(x)) : []
  for (const b of set.branches) set.discovered = withDiscovered(sc, set, b.choices)
  return { set, repaired }
}

/** Migrate the single saved run from the previous version (an array of choice ids) into a branch set. */
export function migrateRun(sc: Scenario, run: unknown, now: number, newId: () => string): BranchSet {
  let set = emptySet()
  if (!Array.isArray(run) || !run.every((x) => typeof x === 'string')) return set
  for (const id of replay(sc, run as string[]).applied) set = commitChoice(sc, set, id, now, newId).set
  return set
}
