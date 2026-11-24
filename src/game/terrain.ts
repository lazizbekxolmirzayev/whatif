/** Deterministic procedural terrain (seeded value noise). Pure functions, shared by renderer and tests. */
export type TerrainKind = 'steppe' | 'plain' | 'coast'

function hash(ix: number, iz: number, seed: number) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return ((h >>> 0) % 100000) / 100000
}
const smooth = (t: number) => t * t * (3 - 2 * t)

function valueNoise(x: number, z: number, seed: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash(ix, iz, seed)
  const b = hash(ix + 1, iz, seed)
  const c = hash(ix, iz + 1, seed)
  const d = hash(ix + 1, iz + 1, seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

export function fbm(x: number, z: number, seed: number) {
  return valueNoise(x * 0.09, z * 0.09, seed) * 0.6 + valueNoise(x * 0.21, z * 0.21, seed + 7) * 0.3 + valueNoise(x * 0.5, z * 0.5, seed + 13) * 0.1
}

export const SEA_LEVEL = -0.55

/** Ground height at (x,z). The battlefield around the origin is kept fairly flat so units sit well. */
export function terrainHeight(x: number, z: number, kind: TerrainKind, seed: number) {
  const flat = 1 - 0.85 * Math.exp(-(x * x + z * z * 1.6) / 260)
  let h = (fbm(x, z, seed) - 0.45) * (kind === 'steppe' ? 7 : kind === 'plain' ? 3.2 : 4.5) * flat
  if (kind === 'coast') {
    const t = Math.min(1, Math.max(0, (z - 13) / 9))
    h -= t * t * (3 - 2 * t) * 4.5
  }
  return h
}

export const PALETTES: Record<TerrainKind, [string, string, string]> = {
  steppe: ['#5d5a34', '#8a8150', '#b3a671'],
  plain: ['#3f5a34', '#62803f', '#8e9a58'],
  coast: ['#6b6a45', '#9a8f5a', '#c7b47d'],
}
