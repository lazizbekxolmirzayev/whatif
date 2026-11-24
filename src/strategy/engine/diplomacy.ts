// Diplomacy: transparent acceptance evaluation, treaty management and relation dynamics.
import type { AcceptanceBreakdown, Country, CountryId, DiploAction, MapStatic, World } from '../types/game';
import { addTimeline, alive, allies, clamp, getRelation, isAtWar, log, militaryPower, now, peekRelation, relKey } from './util';
import { canReach } from './military';
import { countryNeighbours } from './create';

export function threatOf(w: World, to: Country, from: Country): number {
  const r = peekRelation(w, to.id, from.id);
  const ratio = militaryPower(from) / Math.max(1, militaryPower(to));
  return clamp((ratio - 0.8) * 30 + (r ? -r.opinion * 0.15 : 0) + from.ai.personality.aggression * 10, 0, 100);
}

/** Every AI acceptance decision is expressed as labelled factors so the player can see *why*. */
export function evaluateProposal(w: World, from: Country, to: Country, action: DiploAction, st: MapStatic): AcceptanceBreakdown {
  const r = peekRelation(w, from.id, to.id) ?? { opinion: 0, trust: 30, treaties: {}, recognized: true, truceUntil: 0 };
  const f: { label: string; value: number }[] = [];
  const add = (label: string, value: number) => { if (Math.round(value) !== 0) f.push({ label, value: Math.round(value) }); };
  add('Opinion', r.opinion * 0.35);
  add('Trust', (r.trust - 40) * 0.3);
  let threshold = 0;
  const powRatio = militaryPower(from) / Math.max(1, militaryPower(to));
  switch (action) {
    case 'alliance': {
      threshold = 25;
      add('Diplomatic personality', (to.ai.personality.diplomacy - 0.5) * 30);
      // shared threats push countries together
      let sharedThreat = 0;
      for (const o of alive(w)) {
        if (o.id === from.id || o.id === to.id) continue;
        const r1 = peekRelation(w, to.id, o.id), r2 = peekRelation(w, from.id, o.id);
        if (r1 && r2 && r1.opinion < -30 && r2.opinion < -30) sharedThreat += Math.min(25, militaryPower(o) / Math.max(1, militaryPower(to)) * 10);
      }
      add('Common enemies', Math.min(35, sharedThreat));
      add('Relative strength', clamp((powRatio - 1) * 12, -20, 20));
      if (isAtWar(w, from.id)) add('Would be dragged into war', -25);
      if (allies(w, to.id).length >= 3) add('Already has many allies', -15);
      if (from.government === to.government) add('Similar government', 8);
      break;
    }
    case 'trade': {
      threshold = 5;
      add('Economic personality', (to.ai.personality.economy - 0.4) * 30);
      add('Mutual benefit', 15);
      if (from.economy.gdp > to.economy.gdp) add('Access to a larger market', 8);
      break;
    }
    case 'nap': {
      threshold = 10;
      add('Fear of attack', clamp((powRatio - 1) * 15, -10, 25));
      add('Aggressive ambitions', -to.ai.personality.aggression * 20);
      break;
    }
    case 'guarantee': { threshold = -40; add('Protection offered', 20); break; }
    case 'vassalize': {
      threshold = 70;
      add('Military imbalance', clamp((powRatio - 2) * 20, -40, 60));
      add('Stability of target', (40 - to.stability.value) * 0.4);
      add('Size of target', -Math.log10(Math.max(10, to.pop.total)) * 4 + 20);
      if (allies(w, to.id).length) add('Has allies to rely on', -20);
      break;
    }
    case 'releaseVassal':
    case 'recognize':
    case 'gift':
    case 'improve': threshold = -1000; break;
    default: threshold = 0;
  }
  if (!canReach(w, from.id, to.id, st) && (action === 'alliance' || action === 'vassalize')) add('No shared border or sea route', -15);
  if (r.truceUntil > now(w)) add('Recent war (truce)', -20);
  return { total: f.reduce((s, x) => s + x.value, 0), threshold, factors: f };
}

export function setTreaty(w: World, a: CountryId, b: CountryId, t: 'alliance' | 'trade' | 'nap' | 'guarantee', on: boolean): void {
  const r = getRelation(w, a, b);
  if (on) { r.treaties[t] = { since: { ...w.date } }; r.trust = clamp(r.trust + 10, 0, 100); }
  else delete r.treaties[t];
}

export function treatyLabel(t: string): string {
  return ({ alliance: 'Alliance', trade: 'Trade agreement', nap: 'Non-aggression pact', guarantee: 'Guarantee of independence' } as Record<string, string>)[t] ?? t;
}

/** Monthly drift: opinions decay toward a baseline shaped by borders, treaties, government and rivalry. */
export function updateRelations(w: World, st: MapStatic): void {
  const month = now(w);
  if (month % 3 !== 0) return;
  const neigh = countryNeighbours(w, st);
  for (const [k, r] of Object.entries(w.relations)) {
    const [a, b] = k.split('|');
    const ca = w.countries[a], cb = w.countries[b];
    if (!ca?.alive || !cb?.alive) { delete w.relations[k]; continue; }
    let base = 0;
    if (neigh.get(a)?.has(b)) base -= 10;
    if (r.treaties.alliance) base += 60;
    if (r.treaties.trade) base += 25;
    if (r.treaties.nap) base += 15;
    if (ca.overlord === b || cb.overlord === a) base += 30;
    if (ca.government === cb.government) base += 8;
    if (isAtWar(w, a, b)) base = -150;
    r.opinion += (base - r.opinion) * 0.03;
    r.opinion = clamp(r.opinion, -200, 200);
    const trustTarget = 30 + (r.treaties.alliance ? 35 : 0) + (r.treaties.trade ? 10 : 0) - (isAtWar(w, a, b) ? 30 : 0);
    r.trust += (trustTarget - r.trust) * 0.02;
  }
  // make sure neighbours always have a relation record
  for (const [a, set] of neigh) for (const b of set) if (!w.relations[relKey(a, b)]) getRelation(w, a, b);
}

export function recordTreaty(w: World, a: Country, b: Country, kind: string): void {
  log(w, `${a.name} and ${b.name} sign a ${treatyLabel(kind).toLowerCase()}.`, 'diplomacy', a.id);
  const major = a.pop.total + b.pop.total > 3e7 || a.id === w.player || b.id === w.player;
  if (major && (kind === 'alliance' || kind === 'nap')) addTimeline(w, 'treaty', `${treatyLabel(kind)}: ${a.name} & ${b.name}`, `${a.name} and ${b.name} formalise a ${treatyLabel(kind).toLowerCase()}.`, [a.id, b.id], 1);
}
