'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { CinematicSpec, GroupFrame, SceneFrame } from '@/game/types'
import { sceneFrame, ease } from '@/game/choreography'
import { FACTION_COLOR } from '@/game/factions'
import { PALETTES, SEA_LEVEL, terrainHeight, type TerrainKind } from '@/game/terrain'

/**
 * Real-time 3D reconstruction of an outcome. Everything drawn here is a pure function of
 * sceneFrame(spec, t): terrain, armies, walls, guns, dust, camera. It is NOT a video and is never
 * presented as one.
 */
interface Shared {
  spec: CinematicSpec
  localT: MutableRefObject<number>
  active: MutableRefObject<boolean>
  getFrame: () => SceneFrame
}

function mulberry(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()
function groupColor(g: GroupFrame, out: THREE.Color) {
  out.set(FACTION_COLOR[g.faction])
  if (g.mixTo) out.lerp(tmpB.set(FACTION_COLOR[g.mixTo]), g.mixK)
  return out
}

function Terrain({ kind, seed }: { kind: TerrainKind; seed: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(76, 76, 130, 130)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const [c0, c1, c2] = PALETTES[kind].map((c) => new THREE.Color(c))
    const rnd = mulberry(seed)
    const col = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const h = terrainHeight(pos.getX(i), pos.getZ(i), kind, seed)
      pos.setY(i, h)
      const k = Math.min(1, Math.max(0, (h + 1.2) / 4.2))
      col.copy(c0).lerp(c1, Math.min(1, k * 2)).lerp(c2, Math.max(0, k * 2 - 1))
      const v = 0.92 + rnd() * 0.16
      colors[i * 3] = col.r * v
      colors[i * 3 + 1] = col.g * v
      colors[i * 3 + 2] = col.b * v
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [kind, seed])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}

function Sea({ shared }: { shared: Shared }) {
  const ref = useRef<THREE.Mesh>(null)
  const ships = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = shared.localT.current
    if (ref.current) ref.current.position.y = SEA_LEVEL + Math.sin(t * 0.8) * 0.04
    ships.current?.children.forEach((s, i) => {
      s.position.y = SEA_LEVEL + 0.15 + Math.sin(t * 1.1 + i * 2) * 0.08
      s.rotation.z = Math.sin(t * 0.9 + i) * 0.04
    })
  })
  return (
    <>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_LEVEL, 0]}>
        <planeGeometry args={[76, 76]} />
        <meshStandardMaterial color="#1b3b5e" transparent opacity={0.88} roughness={0.25} metalness={0.2} />
      </mesh>
      <group ref={ships}>
        {[-14, 2, 16].map((x, i) => (
          <group key={x} position={[x, SEA_LEVEL, 21 + (i % 2) * 5]} rotation={[0, 0.5 * i, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[3, 0.6, 1]} />
              <meshStandardMaterial color="#5a3d22" />
            </mesh>
            <mesh position={[0, 1.6, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 2.6, 6]} />
              <meshStandardMaterial color="#3a2814" />
            </mesh>
            <mesh position={[0, 1.7, 0]}>
              <planeGeometry args={[1.5, 1.4]} />
              <meshStandardMaterial color="#d9cfb4" side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}

const CONE = new THREE.ConeGeometry(0.2, 0.6, 5)

function Army({ id, shared, kind, seed }: { id: string; shared: Shared; kind: TerrainKind; seed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const pole = useRef<THREE.Group>(null)
  const flag = useRef<THREE.Mesh>(null)
  const first = useMemo(() => shared.getFrame().groups.find((g) => g.id === id)!, [shared, id])
  const base = useMemo(() => {
    const rnd = mulberry(first.seed)
    const n = first.count
    const depth = first.shape === 'line' ? 2 : Math.max(2, Math.ceil(Math.sqrt(n / 2.2)))
    const front = Math.ceil(n / depth)
    const gap = first.shape === 'line' ? 0.5 : 0.62
    const items = Array.from({ length: n }, (_, i) => ({
      dx: ((i % depth) - (depth - 1) / 2) * gap + (rnd() - 0.5) * 0.2,
      dz: (Math.floor(i / depth) - (front - 1) / 2) * gap + (rnd() - 0.5) * 0.2,
      ph: rnd(),
      rank: rnd(),
    }))
    return items
  }, [first])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const f = shared.getFrame()
    const g = f.groups.find((x) => x.id === id)
    if (!g) {
      m.visible = false
      return
    }
    m.visible = true
    const tt = shared.localT.current
    const c = Math.cos(g.facing)
    const s = Math.sin(g.facing)
    const n = base.length
    for (let i = 0; i < n; i++) {
      const b = base[i]
      const shown = b.rank < g.alive
      let dx = b.dx * g.spread
      let dz = b.dz * g.spread
      let y = 0
      const w = tt * 8 + b.ph * 6.283
      if (g.mode === 'clash') {
        dx += Math.sin(tt * 6 + b.ph * 6.283) * 0.4
        dz += Math.sin(w * 1.3) * 0.18
        y = Math.max(0, Math.sin(w)) * 0.12
      } else if (g.mode === 'advance' || g.mode === 'rout') {
        y = Math.abs(Math.sin(w * (g.mode === 'rout' ? 1.4 : 1))) * 0.1
        dz += (g.mode === 'rout' ? (b.ph - 0.5) * 0.8 : 0) * Math.min(1, g.spread - 1)
      } else if (g.mode === 'cheer') {
        y = Math.abs(Math.sin(tt * 5 + b.ph * 6.283)) * 0.2
      } else {
        y = Math.sin(tt * 1.5 + b.ph * 6.283) * 0.015
      }
      const x = g.x + dx * c - dz * s
      const z = g.z + dx * s + dz * c
      const h = terrainHeight(x, z, kind, seed)
      dummy.position.set(x, h + 0.3 + y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(shown ? 1 : 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    groupColor(g, color)
    ;(m.material as THREE.MeshStandardMaterial).color.copy(color)
    if (pole.current && flag.current) {
      const hh = terrainHeight(g.x, g.z, kind, seed)
      pole.current.visible = g.alive > 0.15
      pole.current.position.set(g.x - Math.cos(g.facing) * 1.6, hh, g.z - Math.sin(g.facing) * 1.6)
      flag.current.rotation.y = Math.sin(tt * 3 + g.seed) * 0.25
      ;(flag.current.material as THREE.MeshStandardMaterial).color.copy(color)
    }
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[CONE, undefined, first.count]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.7} flatShading />
      </instancedMesh>
      {first.count >= 30 && (
        <group ref={pole}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
            <meshStandardMaterial color="#3a2a16" />
          </mesh>
          <mesh ref={flag} position={[0.45, 2.0, 0]}>
            <planeGeometry args={[0.9, 0.55]} />
            <meshStandardMaterial side={THREE.DoubleSide} emissiveIntensity={0.15} />
          </mesh>
        </group>
      )}
    </>
  )
}

function Leader({ id, shared, kind, seed }: { id: string; shared: Shared; kind: TerrainKind; seed: number }) {
  const grp = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const color = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const g = shared.getFrame().groups.find((x) => x.id === id)
    if (!grp.current || !body.current) return
    grp.current.visible = !!g
    if (!g) return
    const tt = shared.localT.current
    const h = terrainHeight(g.x, g.z, kind, seed)
    grp.current.position.set(g.x, h, g.z)
    const fallen = g.mode === 'fallen'
    grp.current.rotation.z = fallen ? -Math.PI / 2 : 0
    grp.current.position.y = h + (fallen ? 0.4 : 0.1 + (g.mode === 'cheer' ? Math.abs(Math.sin(tt * 5)) * 0.25 : 0))
    grp.current.rotation.y = -g.facing
    ;(body.current.material as THREE.MeshStandardMaterial).color.copy(groupColor(g, color))
  })
  return (
    <group ref={grp}>
      <mesh ref={body} position={[0, 0.8, 0]} scale={[1, 1, 1]}>
        <coneGeometry args={[0.38, 1.4, 6]} />
        <meshStandardMaterial roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color="#e2c58a" />
      </mesh>
      <mesh position={[0, 1.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.045, 8, 20]} />
        <meshStandardMaterial color="#d4b66c" emissive="#7a5a18" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function Wall({ shared, kind, seed }: { shared: Shared; kind: TerrainKind; seed: number }) {
  const segs = useRef<THREE.Group>(null)
  const N = 11
  useFrame(() => {
    const w = shared.getFrame().wall
    if (!segs.current) return
    segs.current.visible = !!w
    if (!w) return
    segs.current.children.forEach((c, i) => {
      const z = (i - (N - 1) / 2) * 2
      const k = 1 - 0.85 * w.breach * Math.exp(-Math.pow(z / 4.2, 2))
      const h = 2.6 * k
      const base = terrainHeight(w.x, z, kind, seed)
      c.position.set(w.x, base + h / 2, z)
      c.scale.set(1, k, 1)
      c.rotation.z = (1 - k) * 0.35 * (z > 0 ? 1 : -1) * 0
    })
  })
  return (
    <group ref={segs}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.9, 2.6, 2.05]} />
          <meshStandardMaterial color="#8c8573" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function Towers({ shared, kind, seed }: { shared: Shared; kind: TerrainKind; seed: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const w = shared.getFrame().wall
    if (!ref.current) return
    ref.current.visible = !!w
    if (!w) return
    ref.current.children.forEach((c, i) => {
      const z = (i === 0 ? -1 : 1) * (w.length / 2 + 0.5)
      c.position.set(w.x, terrainHeight(w.x, z, kind, seed) + 2, z)
    })
  })
  return (
    <group ref={ref}>
      {[0, 1].map((i) => (
        <mesh key={i}>
          <boxGeometry args={[1.8, 4, 1.8]} />
          <meshStandardMaterial color="#7c7563" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function Cannon({ shared, kind, seed }: { shared: Shared; kind: TerrainKind; seed: number }) {
  const grp = useRef<THREE.Group>(null)
  const flash = useRef<THREE.PointLight>(null)
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const c = shared.getFrame().cannon
    if (!grp.current) return
    grp.current.visible = !!c
    if (!c) return
    grp.current.position.set(c.x - c.fire * 0.35, terrainHeight(c.x, c.z, kind, seed) + 0.55, c.z)
    if (flash.current) flash.current.intensity = c.fire * 14
    if (ball.current) ball.current.scale.setScalar(0.001 + c.fire * 1.3)
  })
  return (
    <group ref={grp}>
      <mesh rotation={[0, 0, Math.PI / 2 - 0.12]}>
        <cylinderGeometry args={[0.3, 0.42, 2.6, 10]} />
        <meshStandardMaterial color="#2b2b2e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.2, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.14, 12]} />
        <meshStandardMaterial color="#4a3320" />
      </mesh>
      <mesh position={[0, -0.2, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.14, 12]} />
        <meshStandardMaterial color="#4a3320" />
      </mesh>
      <mesh ref={ball} position={[1.6, 0.2, 0]}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshBasicMaterial color="#ffd48a" transparent opacity={0.85} />
      </mesh>
      <pointLight ref={flash} position={[1.8, 0.4, 0]} color="#ffb454" distance={22} intensity={0} />
    </group>
  )
}

function Dust({ shared, kind, seed }: { shared: Shared; kind: TerrainKind; seed: number }) {
  const N = 90
  const pts = useRef<THREE.Points>(null)
  const sprite = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [])
  const base = useMemo(() => {
    const r = mulberry(99)
    return Array.from({ length: N }, () => ({ a: r() * 6.283, d: r(), s: 0.3 + r() * 0.7, ph: r() }))
  }, [])
  useFrame(() => {
    const f = shared.getFrame()
    const arr = geo.attributes.position as THREE.BufferAttribute
    const t = shared.localT.current
    base.forEach((b, i) => {
      const life = (t * 0.35 * b.s + b.ph) % 1
      const x = f.dust.x + Math.cos(b.a) * b.d * 8
      const z = f.dust.z + Math.sin(b.a) * b.d * 8
      arr.setXYZ(i, x, terrainHeight(x, z, kind, seed) + 0.2 + life * 3, z)
    })
    arr.needsUpdate = true
    if (pts.current) (pts.current.material as THREE.PointsMaterial).opacity = Math.min(0.55, f.dust.intensity * 0.6)
  })
  return (
    <points ref={pts} geometry={geo} frustumCulled={false}>
      <pointsMaterial map={sprite} alphaTest={0.01} color="#c7b48a" size={2.2} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  )
}

function CameraDriver({ shared }: { shared: Shared }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!shared.active.current) return
    const f = shared.getFrame()
    const t = shared.localT.current
    const sh = f.shake
    camera.position.set(f.camera.pos[0] + Math.sin(t * 47) * sh * 0.12, f.camera.pos[1] + Math.cos(t * 53) * sh * 0.1, f.camera.pos[2])
    camera.lookAt(f.camera.look[0], f.camera.look[1], f.camera.look[2])
  })
  return null
}

export default function Diorama({ spec, localT, active }: { spec: CinematicSpec; localT: MutableRefObject<number>; active: MutableRefObject<boolean> }) {
  const cache = useRef<{ t: number; f: SceneFrame } | null>(null)
  const shared = useMemo<Shared>(
    () => ({
      spec,
      localT,
      active,
      getFrame: () => {
        const t = localT.current
        if (cache.current && cache.current.t === t) return cache.current.f
        const f = sceneFrame(spec, t)
        cache.current = { t, f }
        return f
      },
    }),
    [spec, localT, active],
  )
  const ids = useMemo(() => sceneFrame(spec, 0).groups.map((g) => ({ id: g.id, role: g.role })), [spec])
  // Re-derive when the spec changes; also reference ease so tree-shaking keeps shared helpers consistent.
  void ease
  return (
    <group>
      <hemisphereLight args={['#c9d4ff', '#3a2f1a', 0.75]} />
      <directionalLight position={[16, 24, 10]} intensity={1.7} color="#ffe2a8" />
      <ambientLight intensity={0.25} />
      <Terrain kind={spec.terrain} seed={spec.seed} />
      {spec.terrain === 'coast' && <Sea shared={shared} />}
      <Wall shared={shared} kind={spec.terrain} seed={spec.seed} />
      <Towers shared={shared} kind={spec.terrain} seed={spec.seed} />
      <Cannon shared={shared} kind={spec.terrain} seed={spec.seed} />
      {ids.map((g) =>
        g.role === 'leader' ? <Leader key={g.id} id={g.id} shared={shared} kind={spec.terrain} seed={spec.seed} /> : <Army key={g.id} id={g.id} shared={shared} kind={spec.terrain} seed={spec.seed} />,
      )}
      <Dust shared={shared} kind={spec.terrain} seed={spec.seed} />
      <CameraDriver shared={shared} />
    </group>
  )
}
