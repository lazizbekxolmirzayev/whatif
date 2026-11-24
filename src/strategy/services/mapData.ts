import type { Topology } from 'topojson-specification';
import type { MapBundle, OwnersFile, ProvinceMeta } from '../engine/create';
import { buildMapStatic } from '../engine/mapStatic';
import type { MapStatic } from '../types/game';

// Lazy-loaded, cached geographic data. Province geometry is shared by all eras;
// each historical dataset only ships a compact owner table (~20 KB).
let topoP: Promise<Topology> | null = null;
let metaP: Promise<ProvinceMeta[]> | null = null;
let physP: Promise<Topology> | null = null;
let staticP: Promise<{ st: MapStatic; drawn: boolean[] }> | null = null;
const ownersCache = new Map<string, Promise<OwnersFile>>();

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
  return r.json() as Promise<T>;
}
/** Map data is served by the WHATIF site from public/strategy-data/maps/. */
const base = '/strategy-data/';
export const loadTopology = () => (topoP ??= json<Topology>(`${base}maps/provinces.topo.json`));
export const loadMeta = () => (metaP ??= json<ProvinceMeta[]>(`${base}maps/provinces_meta.json`));
export const loadPhysical = () => (physP ??= json<Topology>(`${base}maps/physical.topo.json`));
export function loadOwners(key: string): Promise<OwnersFile> {
  if (!ownersCache.has(key)) ownersCache.set(key, json<OwnersFile>(`${base}maps/owners_${key}.json`));
  return ownersCache.get(key)!;
}
export async function loadStatic(): Promise<{ st: MapStatic; drawn: boolean[] }> {
  if (!staticP) staticP = Promise.all([loadTopology(), loadMeta()]).then(([t, m]) => buildMapStatic('world', t, m));
  return staticP;
}
export async function loadBundle(key: string): Promise<{ bundle: MapBundle; st: MapStatic }> {
  const [meta, owners, s] = await Promise.all([loadMeta(), loadOwners(key), loadStatic()]);
  return { bundle: { key, meta, owners, static: s.st, drawn: s.drawn }, st: s.st };
}
