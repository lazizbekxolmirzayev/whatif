import type { World } from '../types/game';

export function cloneWorld(w: World): World {
  return typeof structuredClone === 'function' ? structuredClone(w) : JSON.parse(JSON.stringify(w));
}
/** Stable FNV-1a hash of the full world state — used to verify determinism & multiplayer sync. */
export function hashWorld(w: World): string {
  const s = JSON.stringify(w);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
/** Migrates older save formats forward. */
export function migrateWorld(w: World): World {
  if (!w.version) w.version = 1;
  for (const c of Object.values(w.countries)) if (c.food.shortage === undefined) c.food.shortage = 0;
  return w;
}
