import type { World } from '../types/game';

/** Deterministic PRNG (mulberry32). State lives in world.rng so saves resume identically. */
export function rand(w: World): number {
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(w: World, a: number, b: number): number { return a + (b - a) * rand(w); }
export function randInt(w: World, a: number, b: number): number { return Math.floor(randRange(w, a, b + 1)); }
export function chance(w: World, p: number): boolean { return rand(w) < p; }
export function pick<T>(w: World, arr: T[]): T { return arr[Math.floor(rand(w) * arr.length)]; }
export function weightedPick<T>(w: World, items: { item: T; weight: number }[]): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return null;
  let r = rand(w) * total;
  for (const i of items) { r -= Math.max(0, i.weight); if (r <= 0) return i.item; }
  return items[items.length - 1].item;
}
export function seedFrom(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
