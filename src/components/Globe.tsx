'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EVENTS } from '@/data/events'
import { loadLand, paintGlobeTexture, latLngToVec3 } from '@/lib/geo'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  onFail: (reason: string) => void
  visited?: string[]
}

function GlobeBody({ selectedId, onSelect, onFail, visited = [] }: Props) {
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  const [hover, setHover] = useState<string | null>(null)

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
        setTex(t)
      })
      .catch(() => onFail('Globe data could not be loaded.'))
    return () => {
      alive = false
    }
  }, [onFail])

  const target = useMemo(() => {
    const e = EVENTS.find((x) => x.id === selectedId)
    return e ? new THREE.Vector3(...latLngToVec3(e.lat, e.lng)) : null
  }, [selectedId])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    if (target) {
      const cam = camera.position.clone().normalize()
      const want = new THREE.Quaternion().setFromUnitVectors(target, cam)
      g.quaternion.slerp(want, Math.min(1, dt * 3))
    } else {
      g.rotation.y += dt * 0.06
    }
  })

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 2, 4]} intensity={1.4} color="#ffe9b8" />
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial key={tex ? 'textured' : 'plain'} map={tex ?? undefined} color={tex ? '#ffffff' : '#101522'} roughness={0.9} metalness={0.05} />
        </mesh>
        {EVENTS.map((e) => {
          const p = latLngToVec3(e.lat, e.lng, 1.012)
          const active = e.id === selectedId
          const seen = visited.includes(e.id)
          return (
            <mesh
              key={e.id}
              position={p}
              scale={active || hover === e.id ? 1.8 : 1}
              onClick={(ev) => {
                ev.stopPropagation()
                onSelect(e.id)
              }}
              onPointerOver={(ev) => {
                ev.stopPropagation()
                setHover(e.id)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHover(null)
                document.body.style.cursor = ''
              }}
            >
              <sphereGeometry args={[0.022, 16, 16]} />
              <meshBasicMaterial color={active ? '#f3e2b0' : seen ? '#7ee0b0' : '#d4b66c'} />
            </mesh>
          )
        })}
      </group>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#c19a4a" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
      <OrbitControls enablePan={false} minDistance={1.8} maxDistance={4.5} enableDamping />
    </>
  )
}

export default function Globe(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 2.9], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => props.onFail('WebGL context was lost.'))
      }}
    >
      <GlobeBody {...props} />
    </Canvas>
  )
}
