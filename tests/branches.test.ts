import assert from 'node:assert/strict'
import { affectedSites, applyChoice, canonicalPath, chronicle, createInitialState, enumeratePaths, evaluateEnding, fingerprint, replay, siteTerritory, statesAlong } from '../src/game/engine.ts'
import { MAX_BRANCHES, ORIGINAL_ID, allBranches, commitChoice, deleteAll, deleteBranch, emptySet, loadSet, migrateRun, navigate, originalBranch } from '../src/game/branches.ts'
import type { BranchSet } from '../src/game/branches.ts'
import { compareTimelines } from '../src/game/compare.ts'
import { SCENARIOS } from '../src/game/scenarios/index.ts'
import type { WorldState } from '../src/game/types.ts'

let n = 0
const t = (name: string, fn: () => void) => {
  fn()
  n++
  console.log('  ok  ' + name)
}
let seq = 0
const newId = () => `b${++seq}`
const commitAll = (set: BranchSet, ids: string[]) => ids.reduce((s, id) => commitChoice(sc, s, id, 1, newId).set, set)

const sc = SCENARIOS[0]
console.log(sc.id + ' — branching and world state')
const canon = canonicalPath(sc)
const paths = enumeratePaths(sc)

t('original timeline: the documented path, all historical, never diverged', () => {
  assert.deepEqual(canon, ['fight', 'mehmed', 'walls-fall'])
  const s = replay(sc, canon).state
  assert.ok(s.history.every((h) => h.kind === 'historical' && !h.diverged))
  const c = chronicle(sc, canon)
  assert.ok(c.length >= 10 && c.every((e) => e.kind === 'historical' && !e.echo))
  assert.equal(evaluateEnding(sc, s)!.id, 'as-it-happened')
})

t('world variables are well-formed and every effect on every path uses defined values', () => {
  const ids = new Set<string>()
  for (const v of sc.vars) {
    assert.ok(!ids.has(v.id), v.id)
    ids.add(v.id)
    assert.ok(v.options.some((o) => o.id === v.initial), `${v.id} initial`)
    assert.equal(new Set(v.options.map((o) => o.id)).size, v.options.length, `${v.id} options unique`)
    for (const o of v.options) if (o.siteId) assert.ok(sc.sites.some((x) => x.id === o.siteId))
    if (v.siteId) assert.ok(sc.sites.some((x) => x.id === v.siteId))
  }
  for (const p of paths) assert.equal(replay(sc, p).applied.length, p.length) // replay throws on unknown values
  const cats = new Set(sc.vars.map((v) => v.category))
  for (const c of ['country', 'political', 'economy', 'technology', 'population', 'figure', 'relation']) assert.ok(cats.has(c as never), c)
})

t('world state updates: decisions change countries, figures, relations, economy and technology', () => {
  const s0 = createInitialState(sc)
  const fight = applyChoice(sc, s0, 'fight').state
  assert.equal(fight.vars.bayezid, 'dead')
  assert.equal(fight.vars.beyliks, 'restored')
  assert.equal(fight.vars['rel-byz'], 'peace')
  assert.equal(fight.vars.straits, 'reopened')
  const end = replay(sc, canon).state
  assert.equal(end.vars.capital, 'constantinople')
  assert.equal(end.vars.byzantium, 'fallen')
  assert.equal(end.vars.mehmed2, 'conqueror')
  assert.equal(end.vars.artillery, 'bombards')
  // an alternate dynasty never produces a named Mehmed II
  assert.equal(replay(sc, ['fight', 'musa', 'walls-fall']).state.vars.mehmed2, 'offstage')
  // early fall without great bombards
  const early = replay(sc, ['withdraw', 'resume']).state
  assert.equal(early.vars.byzantium, 'fallen')
  assert.equal(early.vars.artillery, 'early')
})

t('event dependencies: reaching a node applies the passage of time, separately from the choice', () => {
  const r = applyChoice(sc, replay(sc, ['fight']).state, 'mehmed')
  assert.equal(r.entered?.id, 'walls-1453')
  assert.equal(r.afterChoice.year, 1413)
  assert.equal(r.state.year, 1453)
  assert.equal(r.afterChoice.vars.artillery, 'early')
  assert.equal(r.state.vars.artillery, 'bombards')
  assert.equal(r.state.vars.mehmed2, 'sultan')
  const alt = applyChoice(sc, replay(sc, ['fight']).state, 'suleyman').state
  assert.equal(alt.vars.mehmed2, 'offstage')
})

t('historical choices after a divergence are labelled as part of an alternate timeline', () => {
  const p = ['fight', 'suleyman', 'walls-fall']
  const s = replay(sc, p).state
  assert.deepEqual(s.history.map((h) => h.diverged), [false, true, true])
  const fall = chronicle(sc, p).filter((e) => e.step === 2)
  assert.ok(fall.length > 0 && fall.every((e) => e.kind === 'fictional' && e.echo))
  assert.ok(chronicle(sc, p).filter((e) => e.step === 0).every((e) => e.kind === 'historical'))
})

t('every path reaches exactly one ending; every ending is reachable', () => {
  assert.equal(paths.length, 16)
  const reached = new Set<string>()
  for (const p of paths) {
    const e = evaluateEnding(sc, replay(sc, p).state)
    assert.ok(e, p.join('>'))
    reached.add(e!.id)
  }
  assert.deepEqual([...reached].sort(), sc.endings.map((e) => e.id).sort())
  assert.equal(sc.endings[sc.endings.length - 1].when, undefined)
  assert.equal(sc.endings.filter((e) => e.kind === 'historical').length, 1)
  assert.equal(evaluateEnding(sc, replay(sc, ['fight']).state), null, 'no ending before the end')
})

t('reproducible: a branch is fully determined by its decisions (fingerprints)', () => {
  const fps = paths.map((p) => fingerprint(replay(sc, p).state))
  assert.equal(new Set(fps).size, paths.length, 'different paths give different worlds')
  for (const p of paths) assert.equal(fingerprint(replay(sc, p).state), fingerprint(replay(sc, [...p]).state))
  const s = replay(sc, canon).state
  const shuffled: WorldState = { ...s, vars: Object.fromEntries(Object.entries(s.vars).reverse()), control: Object.fromEntries(Object.entries(s.control).reverse()) }
  assert.equal(fingerprint(shuffled), fingerprint(s), 'key order does not matter')
  const along = statesAlong(sc, canon)
  assert.equal(along.length, canon.length + 1)
  assert.equal(fingerprint(along[along.length - 1]), fingerprint(s))
})

t('multiple branches: forks, advances along history, switches instead of duplicating', () => {
  let set = emptySet()
  let r = commitChoice(sc, set, 'fight', 1, newId)
  assert.equal(r.kind, 'advance', 'the documented choice follows the original timeline')
  assert.equal(r.set.branches.length, 0)
  set = navigate(sc, r.set, ORIGINAL_ID, 0)
  r = commitChoice(sc, set, 'withdraw', 1, newId)
  assert.equal(r.kind, 'fork')
  set = r.set
  const first = set.activeId
  set = commitChoice(sc, set, 'resume', 2, newId).set
  assert.equal(set.branches[0].choices.join('>'), 'withdraw>resume', 'appends to its own branch')
  set = navigate(sc, set, ORIGINAL_ID, 0)
  set = commitChoice(sc, set, 'concede', 3, newId).set
  set = navigate(sc, set, ORIGINAL_ID, 1)
  set = commitChoice(sc, set, 'musa', 4, newId).set
  assert.equal(set.branches.length, 3)
  r = commitChoice(sc, navigate(sc, set, ORIGINAL_ID, 0), 'withdraw', 5, newId)
  assert.equal(r.kind, 'switch')
  assert.equal(r.branchId, first)
  assert.equal(r.set.branches.length, 3, 'no duplicate branch')
  assert.equal(new Set(set.branches.map((b) => b.name)).size, 3)
})

t('original timeline remains unchanged and cannot be mutated', () => {
  const before = JSON.stringify(originalBranch(sc))
  let set = emptySet()
  set = commitAll(set, ['withdraw', 'lift', 'balkans'])
  set = commitAll(navigate(sc, set, ORIGINAL_ID, 2), ['terms'])
  compareTimelines(sc, canon, set.branches[0].choices)
  assert.equal(JSON.stringify(originalBranch(sc)), before)
  assert.deepEqual(allBranches(sc, set)[0].choices, canon)
  assert.ok(Object.isFrozen(originalBranch(sc)) && Object.isFrozen(originalBranch(sc).choices))
  assert.throws(() => (originalBranch(sc).choices as string[]).push('x'))
  assert.equal(deleteBranch(set, ORIGINAL_ID), set)
})

t('branches are independent: changing one never changes another', () => {
  let set = commitAll(emptySet(), ['fight', 'suleyman'])
  assert.equal(set.branches.length, 1)
  const a = set.branches[0]
  const aSnap = JSON.stringify(a)
  set = navigate(sc, set, a.id, 1) // back to the succession decision inside branch A
  set = commitChoice(sc, set, 'musa', 9, newId).set
  set = commitChoice(sc, set, 'walls-fall', 9, newId).set
  assert.equal(set.branches.length, 2)
  assert.equal(JSON.stringify(set.branches[0]), aSnap, 'branch A untouched by its fork')
  assert.deepEqual(set.branches[1].choices, ['fight', 'musa', 'walls-fall'])
  assert.equal(set.branches[1].parentId, a.id)
  assert.equal(set.branches[1].forkAt, 1)
  for (const b of set.branches) assert.equal(b.fingerprint, fingerprint(replay(sc, b.choices).state))
})

t('navigation, deletion, limits and discovered endings', () => {
  let set = commitAll(emptySet(), ['withdraw', 'resume', 'reconquer'])
  assert.deepEqual(set.discovered, ['thunderbolt'])
  assert.equal(navigate(sc, set, set.activeId, 99).cursor, 3)
  assert.equal(navigate(sc, set, set.activeId, -4).cursor, 0)
  const id = set.activeId
  set = deleteBranch(set, id)
  assert.equal(set.activeId, ORIGINAL_ID)
  assert.equal(set.branches.length, 0)
  assert.deepEqual(set.discovered, ['thunderbolt'], 'discoveries survive deletion')
  assert.deepEqual(deleteAll(commitAll(emptySet(), ['concede'])).branches, [])
  let big = emptySet()
  big = { ...big, branches: Array.from({ length: MAX_BRANCHES }, (_, i) => ({ id: 'x' + i, name: 'x' + i, choices: ['concede'], parentId: null, forkAt: 0, createdAt: 0, updatedAt: 0, fingerprint: '' })) }
  const r = commitChoice(sc, navigate(sc, big, ORIGINAL_ID, 1), 'suleyman', 1, newId)
  assert.ok(r.error)
})

t('storage: round trip, repair of corrupted data, migration of the old single run', () => {
  const set = commitAll(emptySet(), ['withdraw', 'lift'])
  const round = loadSet(sc, JSON.parse(JSON.stringify(set)))
  assert.deepEqual(round.set, set)
  assert.deepEqual(round.repaired, [])
  const bad = JSON.parse(JSON.stringify(set))
  bad.branches[0].choices = ['withdraw', 'bogus', 'lift']
  bad.branches.push({ ...bad.branches[0], id: 'dup', choices: ['withdraw', 'lift'] }, { id: 'orig', name: 'h', choices: ['fight'] }, 'junk', null)
  const fixed = loadSet(sc, bad)
  assert.deepEqual(fixed.set.branches.map((b) => b.choices), [['withdraw'], ['withdraw', 'lift']])
  assert.ok(fixed.repaired.length >= 1)
  assert.deepEqual(loadSet(sc, 'nonsense').set, emptySet())
  const m = migrateRun(sc, ['withdraw', 'resume'], 1, newId)
  assert.equal(m.branches.length, 1)
  assert.deepEqual(m.branches[0].choices, ['withdraw', 'resume'])
  const h = migrateRun(sc, ['fight', 'mehmed'], 1, newId)
  assert.deepEqual([h.branches.length, h.activeId, h.cursor], [0, ORIGINAL_ID, 2])
})

t('comparison: identical timelines have no differences', () => {
  const c = compareTimelines(sc, canon, canon)
  assert.equal(c.divergence, null)
  assert.ok(c.rows.every((r) => r.status === 'same'))
  assert.ok(c.vars.every((v) => !v.differs) && c.control.every((x) => !x.differs))
})

t('comparison: different events, dates, outcomes and map', () => {
  const alt = compareTimelines(sc, canon, ['withdraw', 'resume', 'reconquer'])
  assert.equal(alt.divergence!.index, 0)
  assert.equal(alt.divergence!.nodeId, 'ankara')
  const city = alt.rows.find((r) => r.key === 'city')!
  assert.equal(city.a!.year, 1453)
  assert.equal(city.b!.year, 1403)
  assert.ok(city.dateDiffers && city.outcomeDiffers)
  assert.equal(alt.rows.find((r) => r.key === 'interregnum')!.status, 'only-a')
  assert.equal(alt.rows.find((r) => r.key === 'reconquest')!.status, 'only-b')
  assert.equal(alt.rows.find((r) => r.key === 'blockade')!.status, 'same')
  assert.ok(alt.control.some((x) => x.differs), 'map differs')
  assert.deepEqual([alt.endings.a!.id, alt.endings.b!.id], ['as-it-happened', 'thunderbolt'])
  const sul = compareTimelines(sc, canon, ['fight', 'suleyman', 'walls-fall'])
  assert.equal(sul.divergence!.index, 1)
  assert.equal(sul.rows.find((r) => r.key === 'interregnum')!.status, 'date')
  assert.equal(sul.rows.find((r) => r.key === 'timur')!.status, 'same')
  assert.ok(sul.rows.find((r) => r.key === 'reunion')!.dateDiffers)
})

t('map consequences: affected locations follow territory, capital and site-linked changes', () => {
  assert.equal(siteTerritory(sc, 'constantinople'), 'constantinople')
  assert.equal(siteTerritory(sc, 'edirne'), 'rumelia')
  assert.equal(siteTerritory(sc, 'ankara'), 'anatolia-central')
  assert.equal(siteTerritory(sc, 'bursa'), 'anatolia-west')
  assert.equal(siteTerritory(sc, 'sivas'), 'anatolia-east')
  const s0 = createInitialState(sc)
  const fight = applyChoice(sc, s0, 'fight').state
  const hit = affectedSites(sc, s0, fight, 'ankara')
  assert.ok(hit.includes('ankara') && hit.includes('bursa') && hit.includes('sivas') && hit.includes('samarkand'))
  const pre = replay(sc, ['fight', 'mehmed']).state
  const fall = applyChoice(sc, pre, 'walls-fall').state
  const moved = affectedSites(sc, pre, fall)
  assert.ok(moved.includes('edirne') && moved.includes('constantinople'), 'capital move touches both cities')
})

console.log(`\n${n} branching tests passed`)
