import assert from 'node:assert/strict'
import { applyChoice, availableChoices, createInitialState, diffState, getNode, isEnded, maxDepth, replay, summarize } from '../src/game/engine.ts'
import { SCENARIOS } from '../src/game/scenarios/index.ts'
import { sceneFrame, segments, totalDuration } from '../src/game/choreography.ts'
import { terrainHeight } from '../src/game/terrain.ts'
import { videoProviderStatus } from '../src/game/media.ts'
import type { Scenario, WorldState } from '../src/game/types.ts'

let n = 0
const t = (name: string, fn: () => void) => {
  fn()
  n++
  console.log('  ok  ' + name)
}

/** Enumerate every reachable path (choice-id lists) from the start. */
function allPaths(sc: Scenario): string[][] {
  const out: string[][] = []
  const walk = (s: WorldState, path: string[]) => {
    if (isEnded(s)) return void out.push(path)
    for (const { choice, locked } of availableChoices(sc, s)) if (!locked) walk(applyChoice(sc, s, choice.id).state, [...path, choice.id])
  }
  walk(createInitialState(sc), [])
  return out
}

for (const sc of SCENARIOS) {
  console.log(sc.id)
  const paths = allPaths(sc)

  t('every path terminates and the graph is acyclic', () => {
    assert.ok(paths.length >= 8, `expected >= 8 paths, got ${paths.length}`)
    paths.forEach((p) => assert.ok(p.length <= maxDepth(sc)))
  })

  t('engine is deterministic: replaying a path twice gives identical state', () => {
    for (const p of paths) assert.equal(JSON.stringify(replay(sc, p).state), JSON.stringify(replay(sc, p).state))
  })

  t('applyChoice never mutates its input', () => {
    const s = createInitialState(sc)
    const snap = JSON.stringify(s)
    applyChoice(sc, s, getNode(sc, s)!.choices[0].id)
    assert.equal(JSON.stringify(s), snap)
  })

  t('decisions change state: control, stats, flags, year and history', () => {
    const s0 = createInitialState(sc)
    const r = applyChoice(sc, s0, 'fight')
    const d = diffState(s0, r.state)
    assert.ok(d.stats.length > 0 && d.control.length > 0)
    assert.equal(r.state.history.length, 1)
    assert.equal(r.state.year, 1403)
    assert.ok(r.state.flags.bayezidCaptured)
    assert.equal(r.state.node, 'succession')
  })

  t('branching: different choices lead to different next nodes', () => {
    const s0 = createInitialState(sc)
    assert.equal(applyChoice(sc, s0, 'fight').state.node, 'succession')
    assert.equal(applyChoice(sc, s0, 'withdraw').state.node, 'siege-choice')
    assert.equal(applyChoice(sc, s0, 'concede').state.node, 'siege-choice')
  })

  t('requirements gate later choices based on earlier decisions', () => {
    const viaMusa = replay(sc, ['fight', 'musa']).state
    const viaMehmed = replay(sc, ['fight', 'mehmed']).state
    const holdMusa = availableChoices(sc, viaMusa).find((c) => c.choice.id === 'walls-hold')!
    const holdMehmed = availableChoices(sc, viaMehmed).find((c) => c.choice.id === 'walls-hold')!
    assert.equal(holdMusa.locked, true)
    assert.equal(holdMehmed.locked, false)
    assert.throws(() => applyChoice(sc, viaMusa, 'walls-hold'), /locked/)
  })

  t('invalid input is rejected and replay stops at the first invalid id', () => {
    assert.throws(() => applyChoice(sc, createInitialState(sc), 'nope'), /Unknown choice/)
    const r = replay(sc, ['fight', 'bogus', 'mehmed'])
    assert.deepEqual(r.applied, ['fight'])
  })

  t('reset: a fresh state equals the initial state', () => {
    assert.equal(JSON.stringify(replay(sc, []).state), JSON.stringify(createInitialState(sc)))
  })

  t('exactly one historical choice per decision; classification matches summary()', () => {
    const onlyAlternate = new Set(['siege-choice']) // reachable only through fictional branches
    for (const node of Object.values(sc.nodes)) assert.equal(node.choices.filter((c) => c.historical).length, onlyAlternate.has(node.id) ? 0 : 1, node.id)
    const hist = replay(sc, ['fight', 'mehmed', 'walls-fall']).state
    assert.deepEqual(summarize(hist), { decisions: 3, fictional: 0, historical: 3 })
    const alt = replay(sc, ['withdraw', 'resume']).state
    assert.equal(summarize(alt).fictional, 2)
  })

  t('every outcome is labelled, matches its choice, and has sources, effects text and captions', () => {
    for (const node of Object.values(sc.nodes)) {
      assert.ok(node.situation.length > 40 && node.question.length > 5)
      assert.ok(sc.sites.some((s) => s.id === node.siteId), `site ${node.siteId}`)
      for (const c of node.choices) {
        const o = c.outcome
        assert.equal(o.kind === 'historical', c.historical, c.id)
        assert.ok(o.immediate.length >= 2 && o.longTerm.length >= 1 && o.context.length > 40 && o.visual.length > 10, c.id)
        assert.ok(o.sources.length >= 1 && o.sources.every((id) => sc.sources[id]), c.id)
        if (o.kind === 'fictional') assert.match(o.context, /Fiction/, c.id)
        assert.ok(o.cinematic.captions.length >= 3, c.id)
        o.cinematic.captions.forEach((cp) => assert.ok(cp.from >= 0 && cp.to <= 1 && cp.from < cp.to))
        assert.equal(o.media, undefined, 'no outcome may ship a fabricated video')
        c.next.forEach((r) => assert.ok(r.goto === null || sc.nodes[r.goto], `${c.id} -> ${r.goto}`))
      }
    }
  })

  t('territory effects reference real territories', () => {
    const ids = new Set(sc.territories.map((x) => x.id))
    for (const node of Object.values(sc.nodes)) for (const c of node.choices) for (const e of c.effects) if (e.type === 'control') assert.ok(ids.has(e.territory), e.territory)
  })

  t('choreography is pure and deterministic, finite, and in bounds for every outcome', () => {
    for (const node of Object.values(sc.nodes)) {
      for (const c of node.choices) {
        const spec = c.outcome.cinematic
        for (let i = 0; i <= 40; i++) {
          const tt = (i / 40) * spec.duration
          const f1 = sceneFrame(spec, tt)
          assert.equal(JSON.stringify(f1), JSON.stringify(sceneFrame(spec, tt)))
          for (const g of f1.groups) {
            assert.ok(Number.isFinite(g.x) && Math.abs(g.x) < 30, `${c.id} x=${g.x} at ${tt}`)
            assert.ok(g.alive >= 0 && g.alive <= 1.0001 && g.mixK >= 0 && g.mixK <= 1.0001)
          }
          f1.camera.pos.concat(f1.camera.look).forEach((v) => assert.ok(Number.isFinite(v)))
        }
        const seg = segments(spec)
        assert.equal(seg.total, totalDuration(spec))
        // the scene visibly changes over time
        assert.notEqual(JSON.stringify(sceneFrame(spec, 0).groups), JSON.stringify(sceneFrame(spec, spec.duration).groups))
      }
    }
  })

  t('the Anatolian defection is choreographed: contingent changes colour and side', () => {
    const spec = sc.nodes.ankara.choices[0].outcome.cinematic
    const before = sceneFrame(spec, 0.2 * spec.duration).groups.find((g) => g.id === 'c')!
    const after = sceneFrame(spec, 0.7 * spec.duration).groups.find((g) => g.id === 'c')!
    assert.equal(before.mixK, 0)
    assert.equal(after.mixK, 1)
    assert.ok(after.x < before.x - 3, 'defectors cross the field')
  })

  t('terrain is deterministic and finite', () => {
    for (const k of ['steppe', 'plain', 'coast'] as const) {
      assert.equal(terrainHeight(3.3, -4.1, k, 7), terrainHeight(3.3, -4.1, k, 7))
      assert.ok(Number.isFinite(terrainHeight(-30, 30, k, 7)))
    }
  })

  t('no video provider is configured, so the player must fall back to 3D', () => {
    assert.equal(videoProviderStatus().configured, false)
  })
}
console.log(`\n${n} engine tests passed`)
