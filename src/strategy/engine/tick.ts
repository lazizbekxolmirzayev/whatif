import type { MapStatic, World, YearSnapshot } from '../types/game';
import { updateCountry } from './systems';
import { internalPolitics } from './internal';
import { runEvents } from './events';
import { runAI } from './ai';
import { updateRelations } from './diplomacy';
import { aiPeace, resolveWars } from './military';
import { runScenarioSchedule } from './scenario';
import { addMonths } from './date';
import { alive, now } from './util';
import { techLevel } from '../data/technologies';
import { checkAchievements } from './achievements';
import { invalidate } from './cache';

/** One deterministic simulation step (one month). All randomness comes from world.rng. */
export function advanceMonth(w: World, st: MapStatic): string[] {
  w.stats.ticks++;
  invalidate(w);
  runScenarioSchedule(w, st);
  for (const c of alive(w)) {
    updateCountry(w, c, st);
    internalPolitics(w, c, st);
  }
  runEvents(w, st);
  runAI(w, st);
  updateRelations(w, st);
  resolveWars(w, st);
  aiPeace(w);
  // AI answers stale offers addressed to it; offers to players expire after 12 months
  const t = now(w);
  w.offers = w.offers.filter((o) => t - (o.date.y * 12 + o.date.m) < 12 && w.countries[o.from]?.alive && w.countries[o.to]?.alive);
  for (const c of alive(w)) c.modifiers = c.modifiers.filter((m) => m.until > t);
  if (w.player) {
    const pc = w.provinces.filter((p) => p.owner === w.player).length;
    if (pc > w.stats.maxProvinces) w.stats.maxProvinces = pc;
  }
  w.date = addMonths(w.date, 1);
  if (w.date.m === 0) yearlySnapshot(w);
  if (w.date.m === 0 && (w.date.y - w.startDate.y) % 5 === 0) ownershipSnapshot(w);
  return checkAchievements(w);
}

export function yearlySnapshot(w: World): void {
  const snap: YearSnapshot = { year: w.date.y, countries: {}, world: { pop: 0, gdp: 0, countries: 0, wars: w.wars.filter((x) => !x.ended).length } };
  const list = alive(w);
  for (const c of list) { snap.world.pop += c.pop.total; snap.world.gdp += c.economy.gdp; snap.world.countries++; }
  const top = list.filter((c) => !c.tribal).sort((a, b) => b.pop.total - a.pop.total).slice(0, 60);
  if (w.player && !top.some((c) => c.id === w.player) && w.countries[w.player]?.alive) top.push(w.countries[w.player]);
  for (const c of top) {
    snap.countries[c.id] = {
      pop: Math.round(c.pop.total), gdp: Math.round(c.economy.gdp), provinces: c.provinceCount, stability: Math.round(c.stability.value),
      tech: Math.round(techLevel(c.tech.known) * 100) / 100, military: Math.round(c.military.regiments * 10) / 10, treasury: Math.round(c.economy.treasury),
    };
  }
  w.history.push(snap);
  if (w.history.length > 600) w.history.splice(0, w.history.length - 600);
}

export function encodeOwners(w: World): string {
  const idx = new Map<string, number>();
  w.countryOrder.forEach((id, i) => idx.set(id, i));
  return w.provinces.map((p) => (p.owner ? idx.get(p.owner)!.toString(36) : '')).join(',');
}
export function decodeOwners(w: World, s: string): (string | null)[] {
  return s.split(',').map((x) => (x ? w.countryOrder[parseInt(x, 36)] ?? null : null));
}
export function ownershipSnapshot(w: World): void {
  if (w.ownership.some((o) => o.year === w.date.y)) return;
  w.ownership.push({ year: w.date.y, owners: encodeOwners(w) });
}

/** Called once after creation: baseline snapshots so comparisons always have a starting point. */
export function initialSnapshots(w: World): void {
  yearlySnapshot(w);
  ownershipSnapshot(w);
}
