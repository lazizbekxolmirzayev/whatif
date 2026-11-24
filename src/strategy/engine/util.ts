import type { Country, CountryId, GameDate, LogEntry, Modifier, ModifierKey, Relation, TimelineEntry, TimelineKind, World } from '../types/game';
import { monthIndex } from './date';
import { GOVERNMENTS } from '../data/eras';
import { TECH_BY_ID } from '../data/technologies';

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const relKey = (a: CountryId, b: CountryId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function getRelation(w: World, a: CountryId, b: CountryId): Relation {
  const k = relKey(a, b);
  let r = w.relations[k];
  if (!r) { r = { opinion: 0, trust: 30, treaties: {}, recognized: true, truceUntil: 0 }; w.relations[k] = r; }
  return r;
}
export function peekRelation(w: World, a: CountryId, b: CountryId): Relation | undefined { return w.relations[relKey(a, b)]; }

export function uid(w: World, prefix: string): string { w.uidCounter += 1; return `${prefix}${w.uidCounter.toString(36)}`; }

export const now = (w: World): number => monthIndex(w.date);

const LOG_CAP = 4000;
export function log(w: World, text: string, kind = 'info', country?: CountryId): void {
  const e: LogEntry = { date: { ...w.date }, text, kind, country };
  w.log.push(e);
  if (w.log.length > LOG_CAP) w.log.splice(0, w.log.length - LOG_CAP);
}
export function addTimeline(w: World, kind: TimelineKind, title: string, text: string, countries: CountryId[], importance: 1 | 2 | 3 = 2, factual = false, date?: GameDate): TimelineEntry {
  const t: TimelineEntry = { id: uid(w, 't'), date: date ?? { ...w.date }, kind, title, text, countries, factual, importance };
  w.timeline.push(t);
  return t;
}

export function modifierSum(w: World, c: Country, key: ModifierKey): number {
  let s = 0;
  const t = now(w);
  for (const m of c.modifiers) if (m.until > t && m.effects[key]) s += m.effects[key]!;
  const g = GOVERNMENTS[c.government]?.effects[key];
  if (g) s += g;
  for (const id of c.tech.known) { const e = TECH_BY_ID[id]?.effects[key]; if (e) s += e; }
  return s;
}
export function addModifier(w: World, c: Country, m: Omit<Modifier, 'until'> & { months: number }): void {
  c.modifiers = c.modifiers.filter((x) => x.id !== m.id);
  c.modifiers.push({ id: m.id, label: m.label, effects: m.effects, source: m.source, until: m.months >= 1e6 ? 1e9 : now(w) + m.months });
}

export function alive(w: World): Country[] { return w.countryOrder.map((id) => w.countries[id]).filter((c) => c && c.alive); }
export function majorCountries(w: World, n = 40): Country[] {
  return alive(w).filter((c) => !c.tribal).sort((a, b) => b.pop.total - a.pop.total).slice(0, n);
}
export function provincesOf(w: World, id: CountryId): number[] {
  const out: number[] = [];
  for (const p of w.provinces) if (p.owner === id) out.push(p.id);
  return out;
}
export function isAtWar(w: World, a: CountryId, b?: CountryId): boolean {
  return w.wars.some((x) => !x.ended && (b === undefined
    ? x.attackers.includes(a) || x.defenders.includes(a)
    : (x.attackers.includes(a) && x.defenders.includes(b)) || (x.defenders.includes(a) && x.attackers.includes(b))));
}
export function warsOf(w: World, id: CountryId) { return w.wars.filter((x) => !x.ended && (x.attackers.includes(id) || x.defenders.includes(id))); }
export function allies(w: World, id: CountryId): CountryId[] {
  const out: CountryId[] = [];
  for (const [k, r] of Object.entries(w.relations)) {
    if (!r.treaties.alliance) continue;
    const [a, b] = k.split('|');
    if (a === id && w.countries[b]?.alive) out.push(b); else if (b === id && w.countries[a]?.alive) out.push(a);
  }
  return out;
}
export function vassalsOf(w: World, id: CountryId): Country[] { return alive(w).filter((c) => c.overlord === id); }

export function militaryPower(c: Country): number {
  return c.military.regiments * c.military.quality * (0.5 + c.military.morale) * (0.6 + 0.4 * c.military.supply);
}
export function fmtNum(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
export function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
