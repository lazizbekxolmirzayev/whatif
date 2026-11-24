import type { CinematicSpec, FactionId, GroupFrame, GroupMode, SceneFrame, Vec3 } from './types.ts'

/**
 * Cinematic choreography: a PURE function of (spec, time). No state, no randomness.
 * The renderer (Diorama.tsx) just draws whatever sceneFrame() returns, so scrubbing, pausing,
 * replaying and testing are all trivial and always consistent.
 */

export const TIMING = { fly: 3.2, transition: 1.0, result: 3.6 } as const

export const totalDuration = (spec: CinematicSpec) => TIMING.fly + TIMING.transition + spec.duration + TIMING.transition + TIMING.result

export function segments(spec: CinematicSpec) {
  const sceneStart = TIMING.fly + TIMING.transition
  const sceneEnd = sceneStart + spec.duration
  const resultStart = sceneEnd + TIMING.transition
  return { sceneStart, sceneEnd, resultStart, total: resultStart + TIMING.result }
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const ease = (k: number) => k * k * (3 - 2 * k)
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

interface KF {
  p: number
  pos: Vec3
  look: Vec3
}
function cameraAt(kfs: KF[], p: number): { pos: Vec3; look: Vec3 } {
  if (p <= kfs[0].p) return { pos: kfs[0].pos, look: kfs[0].look }
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]
    const b = kfs[i + 1]
    if (p <= b.p) {
      const k = ease(seg(p, a.p, b.p))
      return {
        pos: [lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k)],
        look: [lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k)],
      }
    }
  }
  const l = kfs[kfs.length - 1]
  return { pos: l.pos, look: l.look }
}

function group(
  id: string,
  role: 'army' | 'leader',
  faction: FactionId,
  count: number,
  seed: number,
  p: Partial<GroupFrame>,
): GroupFrame {
  return { id, role, faction, mixK: 0, x: 0, z: 0, facing: 0, spread: 1, alive: 1, mode: 'idle', count, seed, shape: 'block', ...p }
}

function captionAt(spec: CinematicSpec, p: number): string | null {
  const c = spec.captions.find((c) => p >= c.from && p < c.to) ?? (p >= 1 ? spec.captions[spec.captions.length - 1] : null)
  return c ? c.text : null
}

/* ------------------------------ BATTLE ------------------------------ */
function battle(spec: CinematicSpec, p: number): SceneFrame {
  const R = spec.result
  const aSide = -1
  const bSide = 1
  const decisive = R === 'a' || R === 'b'
  const winnerSide = R === 'a' ? aSide : bSide
  const loserSide = -winnerSide

  // positions along x for each side
  let ax: number
  let bx: number
  let aAlive = 1
  let bAlive = 1
  let aMode: GroupMode = 'advance'
  let bMode: GroupMode = 'advance'
  let aSpread = 1
  let bSpread = 1
  let clash = 0

  if (decisive) {
    const adv = ease(seg(p, 0, 0.28))
    ax = lerp(-17, -3.4, adv)
    bx = lerp(17, 3.4, adv)
    clash = Math.sin(clamp(seg(p, 0.26, 0.66)) * Math.PI)
    const clashing = p > 0.26 && p < 0.62
    const aMode0: GroupMode = clashing ? 'clash' : p >= 0.62 ? 'cheer' : 'advance'
    aMode = aMode0
    bMode = aMode0
    const rout = ease(seg(p, 0.62, 1))
    const lx = lerp(3.4, 21, rout) * loserSide
    const lAlive = lerp(1, 0.78, seg(p, 0.26, 0.62)) * lerp(1, 0.5, rout)
    const lSpread = lerp(1, 2.4, rout)
    const wAlive = lerp(1, 0.86, seg(p, 0.26, 0.62))
    if (winnerSide === aSide) {
      bx = loserSide === bSide ? lx : bx
      bAlive = lAlive
      bSpread = lSpread
      aAlive = wAlive
      if (p >= 0.62) bMode = 'rout'
    } else {
      ax = lx
      aAlive = lAlive
      aSpread = lSpread
      bAlive = wAlive
      if (p >= 0.62) aMode = 'rout'
    }
  } else {
    const adv = ease(seg(p, 0, 0.3))
    ax = lerp(-17, -8, adv)
    bx = lerp(17, 8, adv)
    const away = ease(seg(p, 0.52, 1))
    const standing: GroupMode = p < 0.3 ? 'advance' : 'idle'
    aMode = standing
    bMode = standing
    if (R === 'b-withdraws') {
      bx = lerp(8, 21, away)
      if (p >= 0.52) bMode = 'advance'
    } else {
      ax = lerp(-8, -21, away)
      if (p >= 0.52) aMode = 'advance'
    }
  }

  const groups: GroupFrame[] = []
  const bFaceBack = R === 'b-withdraws' && p >= 0.52
  const aFaceBack = R === 'a-withdraws' && p >= 0.52
  const defect = spec.defect
  const defectK = defect ? ease(seg(p, defect.atP, defect.atP + 0.14)) : 0
  groups.push(group('a', 'army', spec.a.faction, spec.a.count, spec.seed + 1, { x: ax, z: 0, facing: aFaceBack ? Math.PI : 0, alive: aAlive, mode: aMode, spread: aSpread }))
  groups.push(
    group('b', 'army', spec.b.faction, spec.b.count, spec.seed + 2, {
      x: bx,
      z: 0,
      facing: bFaceBack ? 0 : Math.PI,
      alive: bAlive * (1 - 0.18 * defectK),
      mode: bMode,
      spread: bSpread,
    }),
  )
  if (defect) {
    // A flank contingent of side b crosses over to side a and changes colour.
    const colorK = ease(seg(p, defect.atP, defect.atP + 0.08))
    const startX = bx + 1.2
    const targetX = ax + 4
    const x = lerp(startX, targetX, defectK)
    const z = lerp(8.5, 5.5, defectK)
    groups.push(
      group('c', 'army', spec.b.faction, defect.count, spec.seed + 3, {
        mixTo: defect.toFaction,
        mixK: colorK,
        x,
        z,
        facing: lerp(Math.PI, 0, colorK),
        alive: 1,
        mode: defectK > 0 && defectK < 1 ? 'advance' : p >= 0.62 ? 'cheer' : 'idle',
        spread: 0.9,
      }),
    )
  }
  if (spec.captureLeader && decisive) {
    // The losing commander stays behind his line, then is led to the victors after the rout.
    const loserIsB = loserSide === bSide
    const walk = ease(seg(p, 0.7, 0.95))
    const lx = lerp(loserSide * 6.5, winnerSide * 1.4, walk)
    groups.push(
      group('leader', 'leader', loserIsB ? spec.b.faction : spec.a.faction, 1, spec.seed + 9, {
        x: lx,
        z: 0,
        facing: walk > 0 ? (winnerSide === aSide ? Math.PI : 0) : loserIsB ? Math.PI : 0,
        mode: p > 0.95 ? 'idle' : 'advance',
      }),
    )
  }

  const camKfs: KF[] = [
    { p: 0, pos: [0, 15, 36], look: [0, 1, 0] },
    { p: 0.3, pos: [-15, 6, 15], look: [-1, 1, 0] },
    { p: 0.5, pos: [11, 4.5, 11], look: [0, 1, 0] },
    { p: 0.72, pos: [0, 24, 21], look: [0, 0, 0] },
    { p: 1, pos: [decisive ? winnerSide * 9 : -7, 5, 13], look: [0, 1.2, 0] },
  ]
  return {
    progress: p,
    groups,
    wall: null,
    cannon: null,
    dust: { x: (ax + bx) / 2, z: 0, intensity: decisive ? clash : 0.15 },
    shake: decisive ? clash * 0.35 : 0,
    camera: cameraAt(camKfs, p),
    caption: captionAt(spec, p),
  }
}

/* ------------------------------ SIEGE ------------------------------- */
const WALL_X = 3.2

function siege(spec: CinematicSpec, p: number): SceneFrame {
  const falls = spec.result === 'falls'
  const adv = ease(seg(p, 0, 0.35))
  const assault = ease(seg(p, 0.55, 0.95))
  const rout = ease(seg(p, 0.6, 1))
  const breach = falls ? ease(seg(p, 0.44, 0.62)) : 0.2 * ease(seg(p, 0.42, 0.5)) * (1 - seg(p, 0.6, 0.7))
  let ax = lerp(-19, -6, adv)
  let aMode: GroupMode = p < 0.35 ? 'advance' : 'clash'
  let aAlive = lerp(1, falls ? 0.8 : 0.7, seg(p, 0.4, 0.9))
  let aSpread = 1
  let bAlive = 1
  let bMode: GroupMode = p < 0.35 ? 'idle' : 'clash'
  if (falls) {
    ax = lerp(ax, WALL_X + 7, assault)
    aMode = p > 0.58 ? 'advance' : aMode
    bAlive = lerp(1, 0.15, seg(p, 0.55, 0.95))
    if (p > 0.7) bMode = 'rout'
  } else {
    ax = lerp(ax, -21, rout)
    aSpread = lerp(1, 2.2, rout)
    aAlive = lerp(aAlive, 0.5, rout)
    if (p > 0.6) {
      aMode = 'rout'
      bMode = 'cheer'
    }
  }
  const pulse = (t: number) => Math.pow(Math.max(0, Math.sin(t * 150)), 10)
  const cannonFire = p > 0.3 && p < 0.62 ? pulse(p) : 0

  const groups: GroupFrame[] = [
    group('a', 'army', spec.a.faction, spec.a.count, spec.seed + 1, { x: ax, z: 0, facing: 0, alive: aAlive, mode: aMode, spread: aSpread }),
    group('b', 'army', spec.b.faction, spec.b.count, spec.seed + 2, { x: WALL_X + 0.9, z: 0, facing: Math.PI, alive: bAlive, mode: bMode, shape: 'line', spread: 1 }),
  ]
  const fallen = spec.commanderFalls && falls && p > 0.58
  groups.push(
    group('leader', 'leader', spec.b.faction, 1, spec.seed + 9, {
      x: WALL_X + 0.9,
      z: 1.5,
      facing: Math.PI,
      mode: fallen ? 'fallen' : p > 0.6 && !falls ? 'cheer' : 'idle',
    }),
  )

  const camKfs: KF[] = [
    { p: 0, pos: [-8, 11, 34], look: [0, 2, 0] },
    { p: 0.3, pos: [-15, 6, 13], look: [0, 2, 0] },
    { p: 0.52, pos: [-3.5, 5, 8], look: [WALL_X, 2, 0] },
    { p: 0.7, pos: [8, 12, 16], look: [WALL_X, 1.5, 0] },
    { p: 1, pos: [0, 26, 22], look: [WALL_X, 0, 0] },
  ]
  return {
    progress: p,
    groups,
    wall: { x: WALL_X, length: 22, breach },
    cannon: { x: -9, z: -3.5, fire: cannonFire },
    dust: { x: WALL_X - 2, z: 0, intensity: p > 0.3 && p < 0.9 ? 0.8 : 0.1 },
    shake: cannonFire * 0.5 + (falls ? Math.sin(clamp(seg(p, 0.44, 0.62)) * Math.PI) * 0.4 : 0),
    camera: cameraAt(camKfs, p),
    caption: captionAt(spec, p),
  }
}

/* ------------------------------ PARLEY ------------------------------ */
function parley(spec: CinematicSpec, p: number): SceneFrame {
  const meet = ease(seg(p, 0, 0.4))
  const depart = ease(seg(p, 0.72, 1))
  const ax = lerp(-17, -3.6, meet) - 16 * depart
  const bx = lerp(17, 3.6, meet)
  const leaderMeet = ease(seg(p, 0.42, 0.58))
  const phase: GroupMode = p < 0.4 ? 'advance' : p < 0.72 ? 'idle' : 'cheer'
  const groups: GroupFrame[] = [
    group('a', 'army', spec.a.faction, spec.a.count, spec.seed + 1, { x: ax, z: 0, facing: p > 0.72 ? Math.PI : 0, mode: p > 0.72 ? 'advance' : phase }),
    group('b', 'army', spec.b.faction, spec.b.count, spec.seed + 2, { x: bx, z: 0, facing: Math.PI, mode: p > 0.72 ? 'cheer' : phase }),
    group('leader-a', 'leader', spec.a.faction, 1, spec.seed + 8, { x: lerp(ax + 3, -0.9, leaderMeet) - 16 * depart, z: 0, facing: 0, mode: 'idle' }),
    group('leader-b', 'leader', spec.b.faction, 1, spec.seed + 9, { x: lerp(bx - 3, 0.9, leaderMeet), z: 0, facing: Math.PI, mode: 'idle' }),
  ]
  const camKfs: KF[] = [
    { p: 0, pos: [0, 12, 34], look: [0, 1, 0] },
    { p: 0.4, pos: [-10, 5, 14], look: [0, 1.2, 0] },
    { p: 0.6, pos: [3, 3.2, 7], look: [0, 1.3, 0] },
    { p: 1, pos: [10, 12, 22], look: [-4, 1, 0] },
  ]
  return {
    progress: p,
    groups,
    wall: spec.terrain === 'coast' ? { x: WALL_X + 7, length: 22, breach: 0 } : null,
    cannon: null,
    dust: { x: 0, z: 0, intensity: 0.12 },
    shake: 0,
    camera: cameraAt(camKfs, p),
    caption: captionAt(spec, p),
  }
}

/** t = seconds since the scene started (clamped to the scene duration). */
export function sceneFrame(spec: CinematicSpec, t: number): SceneFrame {
  const p = clamp(t / spec.duration)
  if (spec.template === 'siege') return siege(spec, p)
  if (spec.template === 'parley') return parley(spec, p)
  return battle(spec, p)
}
