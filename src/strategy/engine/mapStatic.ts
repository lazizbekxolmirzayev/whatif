import type { Topology, GeometryCollection } from 'topojson-specification';
import { neighbors } from 'topojson-client';
import type { MapStatic } from '../types/game';
import type { ProvinceMeta } from './create';
import { distanceKm } from './util';

/** Derives land adjacency (shared arcs) and sea links (coastal provinces within sailing range). */
export function buildMapStatic(key: string, topo: Topology, meta: ProvinceMeta[]): { st: MapStatic; drawn: boolean[] } {
  const obj = topo.objects.prov as GeometryCollection<{ i: number }>;
  const n = meta.length;
  const adjacency: number[][] = Array.from({ length: n }, () => []);
  const drawn = new Array<boolean>(n).fill(false);
  const geomIds = obj.geometries.map((g) => (g.properties as { i: number }).i);
  for (const id of geomIds) drawn[id] = true;
  const nb = neighbors(obj.geometries as never);
  nb.forEach((list, gi) => { const a = geomIds[gi]; for (const j of list) adjacency[a].push(geomIds[j]); });
  const seaLinks: number[][] = Array.from({ length: n }, () => []);
  const grid = new Map<string, number[]>();
  const cell = (lon: number, lat: number) => `${Math.floor(lon / 8)}:${Math.floor(lat / 8)}`;
  meta.forEach((m, i) => { if (!m.c || !drawn[i]) return; const k = cell(m.x, m.y); if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(i); });
  meta.forEach((m, i) => {
    if (!m.c || !drawn[i]) return;
    const cx = Math.floor(m.x / 8), cy = Math.floor(m.y / 8);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
        if (j === i || adjacency[i].includes(j)) continue;
        if (distanceKm(m.x, m.y, meta[j].x, meta[j].y) < 700) seaLinks[i].push(j);
      }
    }
  });
  return { st: { key, adjacency, seaLinks }, drawn };
}
