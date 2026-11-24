import type { FeatureCollection, Geometry } from 'geojson'

export const MAP_W = 1000
export const MAP_H = 500

export type LandData = FeatureCollection<Geometry>

let landPromise: Promise<LandData> | null = null

/** Lazily loads Natural Earth land polygons shipped with the `world-atlas` package (no network needed). */
export function loadLand(): Promise<LandData> {
  if (!landPromise) {
    landPromise = (async () => {
      const [{ feature }, topo] = await Promise.all([
        import('topojson-client'),
        import('world-atlas/land-110m.json'),
      ])
      const t = (topo as unknown as { default: unknown }).default ?? topo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const land = feature(t as any, (t as any).objects.land)
      return land as unknown as LandData
    })().catch((e) => {
      landPromise = null
      throw e
    })
  }
  return landPromise
}

export function project(lat: number, lng: number, w = MAP_W, h = MAP_H): [number, number] {
  return [((lng + 180) / 360) * w, ((90 - lat) / 180) * h]
}

type Ring = number[][]

function polygonsOf(g: Geometry): Ring[][] {
  if (g.type === 'Polygon') return [g.coordinates as Ring[]]
  if (g.type === 'MultiPolygon') return g.coordinates as Ring[][]
  return []
}

/** SVG path data for all land, equirectangular. */
export function landToPath(land: LandData, w = MAP_W, h = MAP_H): string {
  let d = ''
  for (const f of land.features) {
    for (const poly of polygonsOf(f.geometry)) {
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const [x, y] = project(lat, lng, w, h)
          d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        d += 'Z'
      }
    }
  }
  return d
}

/** Paints a stylised globe texture (dark ocean, charcoal land, gold coastline) to a canvas. */
export function paintGlobeTexture(canvas: HTMLCanvasElement, land: LandData) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0b1020')
  g.addColorStop(0.5, '#0e1527')
  g.addColorStop(1, '#0b1020')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(193,154,74,0.10)'
  ctx.lineWidth = 1
  for (let lng = -180; lng <= 180; lng += 30) {
    const [x] = project(0, lng, w, h)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(lat, 0, w, h)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#2f3445'
  ctx.strokeStyle = 'rgba(212,182,108,0.7)'
  ctx.lineWidth = 1.4
  for (const f of land.features) {
    for (const poly of polygonsOf(f.geometry)) {
      ctx.beginPath()
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const [x, y] = project(lat, lng, w, h)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
      }
      ctx.fill('evenodd')
      ctx.stroke()
    }
  }
}

/** Unit vector on a three.js SphereGeometry for the given lat/lng. */
export function latLngToVec3(lat: number, lng: number, r = 1): [number, number, number] {
  const la = (lat * Math.PI) / 180
  const lo = (lng * Math.PI) / 180
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)]
}
