'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
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
  /** control map after the outcome is applied (what the result phase morphs to) */
  after: Record<string, FactionId>
}
export type CinePhase = 'fly' | 'scene' | 'result'

interface Props {
  scenario: Scenario
  control: Record<string, FactionId>
  focusSiteId: string
  /** changes every time the camera should glide to the focus site */
  focusToken: number
  cinematic: CinematicRun | null
  clock: MutableRefObject<Clock>
  fadeRef: MutableRefObject<HTMLDivElement | null>
  onSite: (id: string) => void
  onTerritory: (id: string) => void
  onPhase: (p: CinePhase, t: number) => void
  onEnd: () => void
  onFail: (reason: string) => void
}

const R_FAR = 2.9
const R_NEAR = 1.75

function siteVec(sc: Scenario, id: string, r = 1) {
  const s = sc.sites.find((x) => x.id === id) ?? sc.sites[0]
  return new THREE.Vector3(...latLngToVec3(s.lat, s.lng, r))
}

function Cap({ lat, lng, radius, onClick, matRef, active }: { lat: number; lng: number; radius: number; onClick: () => void; matRef: (m: THREE.MeshBasicMaterial | null) => void; active: boolean }) {
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...latLngToVec3(lat, lng)).normalize()), [lat, lng])
  const geo = useMemo(() => new THREE.SphereGeometry(1.004, 40, 6, 0, Math.PI * 2, 0, (radius * Math.PI) / 180), [radius])
  return (
    <mesh geometry={geo} quaternion={quat} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <meshBasicMaterial ref={matRef} transparent opacity={active ? 0.5 : 0.34} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Marker({ position, current, onClick }: { position: THREE.Vector3; current: boolean; onClick: () => void }) {
  const ring = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh>(null)
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()), [position])
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime * (current ? 1.2 : 0.6)) % 1
    if (ring.current) {
      ring.current.scale.setScalar(1 + k * (current ? 1.8 : 0.9))
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (current ? 0.9 : 0.5)
    }
    if (core.current) core.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.12)
  })
  return (
    <group position={position} quaternion={quat}>
      <mesh ref={core} onClick={(e) => { e.stopPropagation(); onClick() }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <sphereGeometry args={[current ? 0.014 : 0.01, 14, 14]} />
        <meshBasicMaterial color={current ? '#f3d27a' : '#d9cfb4'} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.016, 0.02, 32]} />
        <meshBasicMaterial color="#d4b66c" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

type Mats = MutableRefObject<Record<string, THREE.MeshBasicMaterial | null>>

function Rig(p: Props & { setPhase: (x: CinePhase | null) => void; setLand: (t: THREE.CanvasTexture) => void; mats: Mats }) {
  const { scenario, control, cinematic, clock, fadeRef, focusSiteId, focusToken } = p
  const { camera } = useThree()
  const controls = useRef<OrbitImpl>(null)
  const mats = p.mats
  const tween = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number } | null>(null)
  const startPos = useRef(new THREE.Vector3())
  const last = useRef<CinePhase | null>(null)
  const ended = useRef(false)
  const colA = useMemo(() => new THREE.Color(), [])
  const colB = useMemo(() => new THREE.Color(), [])

  // texture
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

  // glide to focus site (explore mode)
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

  const placeTerritoryColors = (from: Record<string, FactionId>, to: Record<string, FactionId>, k: number) => {
    for (const t of scenario.territories) {
      const m = mats.current[t.id]
      if (!m) continue
      colA.set(FACTION_COLOR[from[t.id] ?? t.initial])
      colB.set(FACTION_COLOR[to[t.id] ?? t.initial])
      m.color.copy(colA.lerp(colB, k))
    }
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const clk = clock.current
    if (!cinematic) {
      placeTerritoryColors(control, control, 1)
      const tw = tween.current
      if (tw) {
        tw.t += dt
        const k = ease(Math.min(1, tw.t / tw.dur))
        camera.position.copy(tw.from.clone().normalize().lerp(tw.to.clone().normalize(), k).normalize().multiplyScalar(THREE.MathUtils.lerp(tw.from.length(), tw.to.length(), k)))
        camera.lookAt(0, 0, 0)
        if (controls.current) controls.current.enabled = false
        if (k >= 1) {
          tween.current = null
          if (controls.current) {
            controls.current.enabled = true
            controls.current.update()
          }
        }
      }
      return
    }
    const seg = segments(cinematic.spec)
    if (clk.playing) clk.t = Math.min(seg.total, clk.t + dt * clk.speed)
    const t = clk.t
    const phase: CinePhase = t < TIMING.fly + TIMING.transition / 2 ? 'fly' : t < seg.sceneEnd + TIMING.transition / 2 ? 'scene' : 'result'
    if (phase !== last.current) {
      last.current = phase
      p.setPhase(phase)
    }
    p.onPhase(phase, t)
    // fade: black during the middle of each transition
    let fade = 0
    const a0 = TIMING.fly
    const b0 = seg.sceneEnd
    const tri = (x: number) => 1 - Math.abs(x * 2 - 1)
    if (t >= a0 && t < a0 + TIMING.transition) fade = Math.min(1, tri((t - a0) / TIMING.transition) * 1.6)
    else if (t >= b0 && t < b0 + TIMING.transition) fade = Math.min(1, tri((t - b0) / TIMING.transition) * 1.6)
    if (fadeRef.current) fadeRef.current.style.opacity = String(fade)

    // globe camera + territory morph
    const site = siteVec(cinematic.siteId ? scenario : scenario, cinematic.siteId, 1)
    if (phase === 'fly') {
      const k = ease(Math.min(1, t / TIMING.fly))
      const dir = startPos.current.clone().normalize().lerp(site.clone().normalize(), k).normalize()
      camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(startPos.current.length(), R_NEAR, k)))
      camera.lookAt(0, 0, 0)
      placeTerritoryColors(control, control, 1)
    } else if (phase === 'result') {
      const k = ease(Math.min(1, (t - seg.resultStart) / 1.6))
      const r = THREE.MathUtils.lerp(R_NEAR, R_FAR - 0.4, ease(Math.min(1, (t - seg.resultStart) / TIMING.result)))
      camera.position.copy(site.clone().normalize().multiplyScalar(r))
      camera.lookAt(0, 0, 0)
      placeTerritoryColors(control, cinematic.after, k)
    }
    if (t >= seg.total && !ended.current) {
      ended.current = true
      clk.playing = false
      p.onEnd()
    }
  })

  return (
    <>
      {!cinematic && <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.35} maxDistance={4.2} rotateSpeed={0.5} zoomSpeed={0.6} />}
    </>
  )
}

function GlobeScene(p: Props & { phase: CinePhase | null; setPhase: (x: CinePhase | null) => void }) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  const mats = useRef<Record<string, THREE.MeshBasicMaterial | null>>({})
  const { camera } = useThree()
  // initial camera facing the scenario
  useEffect(() => {
    camera.position.copy(siteVec(p.scenario, p.focusSiteId, R_FAR))
    camera.lookAt(0, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const inScene = p.phase === 'scene'
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
            {p.scenario.sites.map((s) => (
              <Marker key={s.id} position={new THREE.Vector3(...latLngToVec3(s.lat, s.lng, 1.012))} current={s.id === (p.cinematic?.siteId ?? p.focusSiteId)} onClick={() => p.onSite(s.id)} />
            ))}
            {p.scenario.territories.map((t) => (
              <Cap key={t.id} lat={t.lat} lng={t.lng} radius={t.radius} active={false} onClick={() => p.onTerritory(t.id)} matRef={(m) => (mats.current[t.id] = m)} />
            ))}
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

export default function World3D(props: Props) {
  const [phase, setPhase] = useState<CinePhase | null>(null)
  return (
    <Canvas camera={{ fov: 42, near: 0.05, far: 400, position: [0, 0, R_FAR] }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <GlobeScene {...props} phase={phase} setPhase={setPhase} />
    </Canvas>
  )
}
