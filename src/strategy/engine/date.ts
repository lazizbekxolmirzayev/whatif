import type { GameDate } from '../types/game';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthIndex = (d: GameDate): number => d.y * 12 + d.m;
export const fromIndex = (i: number): GameDate => ({ y: Math.floor(i / 12), m: ((i % 12) + 12) % 12 });
export const addMonths = (d: GameDate, n: number): GameDate => fromIndex(monthIndex(d) + n);
export const cmpDate = (a: GameDate, b: GameDate): number => monthIndex(a) - monthIndex(b);
export function fmtYear(y: number): string { return y < 0 ? `${-y} BC` : `${y}`; }
export function fmtDate(d: GameDate, short = false): string {
  return short ? `${MONTHS[d.m].slice(0, 3)} ${fmtYear(d.y)}` : `${MONTHS[d.m]} ${fmtYear(d.y)}`;
}
