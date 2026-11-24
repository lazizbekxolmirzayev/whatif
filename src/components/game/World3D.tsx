'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import type { CinematicSpec, FactionId, Scenario } from '@/game/types'
import { FACTION_COLOR } from '@/game/factions'
import { TIMING, segments, ease } from '@/game/choreography'
import { loadLand, paintGlobeTexture, latLngToVec3 } from '@/lib/geo'
import Diorama from './Diorama'

export interface Clock {
  t: number
  playing: boolean
  speed: number
}
export interface CinematicRun {
  spec: CinematicSpec
  siteId: string
  /** control map before the outcome (shown while flying in) */
  before: Record<string, FactionId>
  /** control map after the outcome (what the result phase morphs to) */
  after: Record<string, FactionId>
}
export type CinePhase = 'fly' | 'scene' | 'result'

export interface WorldProps {
  scenario: Scenario
  /** map shown outside cinematics; colours animate towards it whenever it changes */
  display: Record<string, FactionId>
  displayKey: string
  /** territories to outline and pulse (changed regions, comparison differences) */
  highlight: string[]
  /** sites to pulse (locations affected by the last change) */
  affected: string[]
  /** short status line under a site's name */
  labels: Record<string, string>
  /** horizontal shift of the globe, as a fraction of the canvas width (to make room for side panels) */
  viewShift: number
  capitalSiteId: string | null
  decisionSiteId: string | null
  focusSiteId: string
  focusToken: number
  cinematic: CinematicRun | null
  clock: MutableRefObject<Clock>
  fadeRef: MutableRefObject<HTMLDivElement | null>
  onSite: (id: string) => void
  onTerritory: (id: string) => void
  onPhase: (p: CinePhase, t: number) => void
  onEnd: () => void
  onFail: (reason: string) => void
  /** called once the rendered territory colours have reached `display` */
  onMapSettled: (key: string) => void
}

const R_FAR = 2.9
const R_NEAR = 1.75
const UP = new THREE.Vector3(0, 1, 0)

function siteVec(sc: Scenario, id: string, r = 1) {
  const s = sc.sites.find((x) => x.id === id) ?? sc.sites[0]
  return new THREE.Vector3(...latLngToVec3(s.lat, s.lng, r))
}

type Mats = MutableRefObject<Record<string, THREE.MeshBasicMaterial | null>>

function Cap({ id, lat, lng, radius, highlight, onClick, mats }: { id: string; lat: number; lng: number; radius: number; highlight: boolean; onClick: () => void; mats: Mats }) {
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...latLngToVec3(lat, lng)).normalize()), [lat, lng])
  const geo = useMemo(() => new THREE.SphereGeometry(1.004, 40, 6, 0, Math.PI * 2, 0, (radius * Math.PI) / 180), [radius])
  const ring = useMemo(() => {
    const r = (radius * Math.PI) / 180
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.sin(r) * Math.cos(a), Math.cos(r), Math.sin(r) * Math.sin(a)).multiplyScalar(1.007))
    }
    const mat = new THREE.LineBasicMaterial({ color: '#f3d27a', transparent: true, opacity: 0.9, depthWrite: false })
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat)
  }, [radius])
  useFrame(({ clock }) => {
    const m = mats.current[id]
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)
    if (m) m.opacity = highlight ? 0.36 + 0.24 * k : 0.34
    ;(ring.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.6 * k
  })
  return (
    <group quaternion={quat}>
      <mesh geometry={geo} onClick={(e) => { e.stopPropagation(); onClick() }}>
        <meshBasicMaterial ref={(m) => void (mats.current[id] = m)} transparent opacity={0.34} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {highlight && <primitive object={ring} />}
    </group>
  )
}

const LABEL_POS: Record<string, string> = {
  above: 'translate(-50%, calc(-100% - 12px))',
  below: 'translate(-50%, 12px)',
  left: 'translate(calc(-100% - 12px), -50%)',
  right: 'translate(12px, -50%)',
}

type LabelReg = MutableRefObject<Map<string, { el: HTMLDivElement | null; priority: number; facing: number }>>

/** Hides labels that overlap a higher-priority label (hover > current decision > affected > capital). */
function LabelManager({ reg }: { reg: LabelReg }) {
  useFrame(() => {
    const placed: DOMRect[] = []
    const items = [...reg.current.values()].filter((x) => x.el).sort((a, b) => b.priority - a.priority)
    for (const it of items) {
      const el = it.el!
      if (it.facing <= 0.02) {
        el.style.opacity = '0'
        continue
      }
      const r = el.getBoundingClientRect()
      const hit = placed.some((q) => r.left < q.right + 2 && r.right > q.left - 2 && r.top < q.bottom + 1 && r.bottom > q.top - 1)
      el.style.opacity = hit ? '0' : String(it.facing)
      if (!hit) placed.push(r)
    }
  })
  return null
}

function Marker({ id, reg, name, label, labelAt = 'below', position, current, affected, important, capital, onClick }: { id: string; reg: LabelReg; name: string; label?: string; labelAt?: string; position: THREE.Vector3; current: boolean; affected: boolean; important: boolean; capital: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const ring = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh>(null)
  const tag = useRef<HTMLDivElement>(null)
  const { camera } = useThree()
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()), [position])
  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const hot = current || affected
    const k = (clock.elapsedTime * (hot ? 1.2 : 0.6)) % 1
    if (ring.current) {
      ring.current.scale.setScalar(1 + k * (affected ? 2.6 : current ? 1.8 : 0.9))
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (hot ? 0.95 : 0.45)
    }
    if (core.current) core.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.12)
    if (core.current) {
      core.current.getWorldPosition(world)
      const facing = Math.max(0, Math.min(1, (world.normalize().dot(camera.position.clone().normalize()) - 0.25) * 4))
      const priority = hover ? 4 : current ? 3 : affected ? 2 : capital ? 1 : 0
      reg.current.set(id, { el: tag.current, priority, facing })
    }
  })
  useEffect(() => () => void reg.current.delete(id), [reg, id])
  return (
    <group position={position} quaternion={quat}>
      <mesh
        ref={core}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; setHover(true) }}
        onPointerOut={() => { document.body.style.cursor = ''; setHover(false) }}
      >
        <sphereGeometry args={[current ? 0.014 : 0.01, 14, 14]} />
        <meshBasicMaterial color={affected ? '#ffe08a' : current ? '#f3d27a' : '#d9cfb4'} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.016, 0.02, 32]} />
        <meshBasicMaterial color={affected ? '#ffd56b' : '#d4b66c'} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {(important || hover) && (
        <Html position={[0, 0, 0.001]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={tag}
            className={`pointer-events-none select-none whitespace-nowrap rounded bg-black/45 px-1.5 py-0.5 ${labelAt === 'left' ? 'text-right' : labelAt === 'right' ? 'text-left' : 'text-center'}`}
            style={{ transform: LABEL_POS[labelAt] ?? LABEL_POS.below, textShadow: '0 1px 3px #000', opacity: 0, transition: 'opacity 0.25s' }}
          >
            <p className={`text-[10px] font-medium tracking-wide ${affected || current ? 'text-gold-200' : 'text-parchment/80'}`}>{name}</p>
            {label && <p className={`text-[9px] ${affected ? 'text-gold-300' : 'text-parchment/55'}`}>{label}</p>}
          </div>
        </Html>
      )}
    </group>
  )
}

function Crown({ sc, siteId }: { sc: Scenario; siteId: string | null }) {
  const g = useRef<THREE.Group>(null)
  const target = useMemo(() => (siteId ? siteVec(sc, siteId, 1.03) : null), [sc, siteId])
  useFrame(({ clock }, dt) => {
    if (!g.current || !target) return
    g.current.visible = true
    g.current.position.lerp(target, 1 - Math.exp(-Math.min(dt, 0.1) * 3))
    const n = g.current.position.clone().normalize()
    g.current.quaternion.setFromUnitVectors(UP, n)
    g.current.position.addScaledVector(n, Math.sin(clock.elapsedTime * 2) * 0.0004)
  })
  if (!target) return null
  return (
    <group ref={g} position={target} visible={false}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.018, 0.014, 0.014, 5, 1, true]} />
        <meshBasicMaterial color="#f3d27a" side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.016, 0.032, Math.sin((i / 5) * Math.PI * 2) * 0.016]}>
          <coneGeometry args={[0.004, 0.012, 4]} />
          <meshBasicMaterial color="#ffe6a3" />
        </mesh>
      ))}
    </group>
  )
}

function Beacon({ sc, siteId }: { sc: Scenario; siteId: string | null }) {
  const m = useRef<THREE.Mesh>(null)
  const pos = useMemo(() => (siteId ? siteVec(sc, siteId, 1.11) : null), [sc, siteId])
  const quat = useMemo(() => (pos ? new THREE.Quaternion().setFromUnitVectors(UP, pos.clone().normalize()) : new THREE.Quaternion()), [pos])
  useFrame(({ clock }) => {
    if (m.current) (m.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 3)
  })
  if (!pos) return null
  return (
    <mesh ref={m} position={pos} quaternion={quat}>
      <cylinderGeometry args={[0.002, 0.009, 0.2, 10, 1, true]} />
      <meshBasicMaterial color="#f3d27a" transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Rig(p: WorldProps & { setPhase: (x: CinePhase | null) => void; setLand: (t: THREE.CanvasTexture) => void; mats: Mats }) {
  const { scenario, display, displayKey, cinematic, clock, fadeRef, focusSiteId, focusToken, mats } = p
  const { camera, size } = useThree()
  const controls = useRef<OrbitImpl>(null)
  const shift = useRef(0)
  const tween = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number } | null>(null)
  const startPos = useRef(new THREE.Vector3())
  const last = useRef<CinePhase | null>(null)
  const ended = useRef(false)
  const settled = useRef('')
  const cur = useRef<Record<string, THREE.Color>>({})
  const tmp = useMemo(() => new THREE.Color(), [])
  const tmp2 = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    let alive = true
    loadLand()
      .then((land) => {
        if (!alive) return
        const c = document.createElement('canvas')
        c.width = 2048
        c.height = 1024
        paintGlobeTexture(c, land)
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        p.setLand(t)
      })
      .catch(() => p.onFail('Globe data could not be loaded.'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cinematic) return
    tween.current = { from: camera.position.clone(), to: siteVec(scenario, focusSiteId, R_FAR), t: 0, dur: 1.6 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, focusSiteId])

  useEffect(() => {
    ended.current = false
    last.current = null
    if (cinematic) {
      startPos.current.copy(camera.position)
      tween.current = null
    } else {
      p.setPhase(null)
      if (fadeRef.current) fadeRef.current.style.opacity = '0'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinematic])

  /** move each territory's colour towards `to` (k = 1 jumps), then write it to the material */
  const paint = (to: Record<string, FactionId>, k: number, from?: Record<string, FactionId>) => {
    let maxd = 0
    for (const t of scenario.territories) {
      const c = (cur.current[t.id] ??= new THREE.Color(FACTION_COLOR[display[t.id] ?? t.initial]))
      tmp.set(FACTION_COLOR[to[t.id] ?? t.initial])
      if (from) c.copy(tmp2.set(FACTION_COLOR[from[t.id] ?? t.initial])).lerp(tmp, k)
      else c.lerp(tmp, k)
      maxd = Math.max(maxd, Math.abs(c.r - tmp.r), Math.abs(c.g - tmp.g), Math.abs(c.b - tmp.b))
      mats.current[t.id]?.color.copy(c)
    }
    return maxd
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const clk = clock.current
    const want = cinematic ? 0 : p.viewShift
    const cam = camera as THREE.PerspectiveCamera
    shift.current += (want - shift.current) * (1 - Math.exp(-dt * 5))
    if (want === 0 && Math.abs(shift.current) < 0.0008) shift.current = 0
    if (shift.current !== 0) cam.setViewOffset(size.width, size.height, shift.current * size.width, 0, size.width, size.height)
    else if (cam.view?.enabled) cam.clearViewOffset()
    if (!cinematic) {
      const d = paint(display, 1 - Math.exp(-dt * 4))
      if (d < 0.004 && settled.current !== displayKey) {
        paint(display, 1)
        settled.current = displayKey
        p.onMapSettled(displayKey)
      }
      const tw = tween.current
      if (tw) {
        tw.t += dt
        const k = ease(Math.min(1, tw.t / tw.dur))
        camera.position.copy(tw.from.clone().normalize().lerp(tw.to.clone().normalize(), k).normalize().multiplyScalar(THREE.MathUtils.lerp(tw.from.length(), tw.to.length(), k)))
        camera.lookAt(0, 0, 0)
        if (k >= 1) {
          tween.current = null
          controls.current?.update()
        }
      }
      return
    }
    settled.current = ''
    const seg = segments(cinematic.spec)
    if (clk.playing) clk.t = Math.min(seg.total, clk.t + dt * clk.speed)
    const t = clk.t
    const phase: CinePhase = t < TIMING.fly + TIMING.transition / 2 ? 'fly' : t < seg.sceneEnd + TIMING.transition / 2 ? 'scene' : 'result'
    if (phase !== last.current) {
      last.current = phase
      p.setPhase(phase)
    }
    p.onPhase(phase, t)
    let fade = 0
    const tri = (x: number) => 1 - Math.abs(x * 2 - 1)
    if (t >= TIMING.fly && t < TIMING.fly + TIMING.transition) fade = Math.min(1, tri((t - TIMING.fly) / TIMING.transition) * 1.6)
    else if (t >= seg.sceneEnd && t < seg.sceneEnd + TIMING.transition) fade = Math.min(1, tri((t - seg.sceneEnd) / TIMING.transition) * 1.6)
    if (fadeRef.current) fadeRef.current.style.opacity = String(fade)

    const site = siteVec(scenario, cinematic.siteId, 1)
    if (phase === 'fly') {
      const k = ease(Math.min(1, t / TIMING.fly))
      const dir = startPos.current.clone().normalize().lerp(site.clone().normalize(), k).normalize()
      camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(startPos.current.length(), R_NEAR, k)))
      camera.lookAt(0, 0, 0)
      paint(cinematic.before, 1)
    } else if (phase === 'result') {
      const k = ease(Math.min(1, (t - seg.resultStart) / 1.6))
      const r = THREE.MathUtils.lerp(R_NEAR, R_FAR - 0.4, ease(Math.min(1, (t - seg.resultStart) / TIMING.result)))
      camera.position.copy(site.clone().normalize().multiplyScalar(r))
      camera.lookAt(0, 0, 0)
      paint(cinematic.after, k, cinematic.before)
    }
    if (t >= seg.total && !ended.current) {
      ended.current = true
      clk.playing = false
      p.onEnd()
    }
  })

  return cinematic ? null : <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.35} maxDistance={4.2} rotateSpeed={0.5} zoomSpeed={0.6} />
}

function GlobeScene(p: WorldProps & { phase: CinePhase | null; setPhase: (x: CinePhase | null) => void }) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  const mats = useRef<Record<string, THREE.MeshBasicMaterial | null>>({})
  const reg: LabelReg = useRef(new Map())
  const { camera } = useThree()
  useEffect(() => {
    camera.position.copy(siteVec(p.scenario, p.focusSiteId, R_FAR))
    camera.lookAt(0, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const inScene = p.phase === 'scene'
  const hl = new Set(p.highlight)
  const aff = new Set(p.affected)
  return (
    <>
      <color attach="background" args={[inScene ? '#0a0d14' : '#05070d']} />
      {!inScene && (
        <>
          <ambientLight intensity={1.05} />
          <directionalLight position={[3, 2, 4]} intensity={1.4} color="#ffe9b8" />
          <Stars radius={60} depth={30} count={1800} factor={3} fade speed={0.4} />
          <group>
            <mesh>
              <sphereGeometry args={[1, 96, 96]} />
              <meshStandardMaterial key={tex ? 'tex' : 'plain'} map={tex ?? undefined} color={tex ? '#ffffff' : '#101522'} roughness={0.9} metalness={0.05} />
            </mesh>
            <mesh>
              <sphereGeometry args={[1.035, 64, 64]} />
              <meshBasicMaterial color="#d4b66c" transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
            </mesh>
            {p.scenario.territories.map((t) => (
              <Cap key={t.id} id={t.id} lat={t.lat} lng={t.lng} radius={t.radius} highlight={!p.cinematic && hl.has(t.id)} onClick={() => p.onTerritory(t.id)} mats={mats} />
            ))}
            {p.scenario.sites.map((s) => (
              <Marker
                key={s.id}
                id={s.id}
                reg={reg}
                capital={s.id === p.capitalSiteId}
                name={s.name}
                labelAt={s.labelAt}
                important={!p.cinematic && (s.id === p.decisionSiteId || aff.has(s.id) || s.id === p.capitalSiteId)}
                label={p.cinematic ? undefined : p.labels[s.id]}
                position={new THREE.Vector3(...latLngToVec3(s.lat, s.lng, 1.012))}
                current={s.id === (p.cinematic?.siteId ?? p.decisionSiteId)}
                affected={!p.cinematic && aff.has(s.id)}
                onClick={() => p.onSite(s.id)}
              />
            ))}
            <Crown sc={p.scenario} siteId={p.capitalSiteId} />
            <LabelManager reg={reg} />
            {!p.cinematic && <Beacon sc={p.scenario} siteId={p.decisionSiteId} />}
          </group>
        </>
      )}
      <Rig {...p} setLand={setTex} mats={mats} />
      {inScene && p.cinematic && <SceneClock clock={p.clock} cinematic={p.cinematic} />}
    </>
  )
}

/** Feeds the diorama its local time from the master clock. */
function SceneClock({ clock, cinematic }: { clock: MutableRefObject<Clock>; cinematic: CinematicRun }) {
  const local = useRef(0)
  const active = useRef(true)
  const seg = useMemo(() => segments(cinematic.spec), [cinematic])
  useFrame(() => {
    local.current = Math.min(cinematic.spec.duration, Math.max(0, clock.current.t - seg.sceneStart))
  })
  return <Diorama spec={cinematic.spec} localT={local} active={active} />
}

export default function World3D(props: WorldProps) {
  const [phase, setPhase] = useState<CinePhase | null>(null)
  return (
    <Canvas camera={{ fov: 42, near: 0.05, far: 400, position: [0, 0, R_FAR] }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <GlobeScene {...props} phase={phase} setPhase={setPhase} />
    </Canvas>
  )
}
