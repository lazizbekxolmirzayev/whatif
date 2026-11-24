import type { CountryId, MapStatic, World } from '../types/game';
import { countryNeighbours } from './create';

// Per-tick memoisation of derived data (not saved; recomputed on demand).
const neighCache = new WeakMap<World, { tick: number; map: Map<CountryId, Set<CountryId>> }>();
export function neighbours(w: World, st: MapStatic): Map<CountryId, Set<CountryId>> {
  const hit = neighCache.get(w);
  if (hit && hit.tick === w.stats.ticks) return hit.map;
  const map = countryNeighbours(w, st);
  neighCache.set(w, { tick: w.stats.ticks, map });
  return map;
}
const ownCache = new WeakMap<World, { tick: number; map: Map<CountryId, number[]> }>();
/** Province ids by owner, rebuilt once per tick or after ownership changes. */
export function byOwner(w: World): Map<CountryId, number[]> {
  const hit = ownCache.get(w);
  if (hit && hit.tick === w.stats.ticks) return hit.map;
  const map = new Map<CountryId, number[]>();
  for (const p of w.provinces) if (p.owner) { let l = map.get(p.owner); if (!l) { l = []; map.set(p.owner, l); } l.push(p.id); }
  ownCache.set(w, { tick: w.stats.ticks, map });
  return map;
}
const tradeCache = new WeakMap<World, { tick: number; map: Map<CountryId, number> }>();
export function tradePartners(w: World): Map<CountryId, number> {
  const hit = tradeCache.get(w);
  if (hit && hit.tick === w.stats.ticks) return hit.map;
  const map = new Map<CountryId, number>();
  for (const [k, r] of Object.entries(w.relations)) if (r.treaties.trade) { const [a, b] = k.split('|'); map.set(a, (map.get(a) ?? 0) + 1); map.set(b, (map.get(b) ?? 0) + 1); }
  tradeCache.set(w, { tick: w.stats.ticks, map });
  return map;
}
export function invalidate(w: World): void { neighCache.delete(w); ownCache.delete(w); tradeCache.delete(w); }
