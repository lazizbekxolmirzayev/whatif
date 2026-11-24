// Internal politics: succession, rebellions, breakaway states and country creation.
import type { Character, Country, CountryId, GovernmentId, MapStatic, Province, World } from '../types/game';
import { addTimeline, clamp, getRelation, log, uid } from './util';
import { chance, rand } from './rng';
import { colorFor, generatedFlag, generatedRulerName, hashString } from '../data/polities';
import { techLevel } from '../data/technologies';
import { declareWar } from './military';
import { invalidate } from './cache';

export function newCountry(w: World, name: string, provinces: number[], template: Country | null, origin: Country['origin']): Country {
  const id = `c${w.countryOrder.length + 1}x${w.uidCounter++}`;
  const year = w.date.y;
  const tlv = template ? techLevel(template.tech.known) : 1;
  const gov: GovernmentId = template?.tribal ? 'tribal' : tlv >= 4.2 ? 'republic' : template?.government === 'khaganate' ? 'khaganate' : 'monarchy';
  const pop = provinces.reduce((s, p) => s + w.provinces[p].pop, 0);
  const region = w.provinces[provinces[0]].region;
  const h = hashString(name + year);
  const c: Country = {
    id, name, color: colorFor(name), flag: generatedFlag(name), capital: provinces.reduce((a, b) => (w.provinces[b].pop > w.provinces[a].pop ? b : a), provinces[0]),
    government: gov, tribal: !!template?.tribal, alive: true, founded: { ...w.date }, collapsed: null, historical: false, origin,
    ruler: { name: generatedRulerName(region, h), title: gov === 'republic' ? 'Head of State' : 'Ruler', born: year - 35, health: 80, skill: { admin: 3 + (h % 6), diplomacy: 3 + ((h >>> 4) % 6), military: 3 + ((h >>> 8) % 6) }, traits: ['founder'] },
    heir: null,
    economy: { treasury: 0, taxRate: 0.1, budget: { military: 0.4, infrastructure: 0.12, research: 0.1, health: 0.08, agriculture: 0.15, administration: 0.15 }, spendingRate: 0.95, gdp: 0, income: 0, expenses: 0, tradeIncome: 0, inflation: 0.01, debt: 0, interestRate: 0.06, lastBalance: 0 },
    food: { stock: pop * 2, production: 0, consumption: pop, storageMonths: 3, famineMonths: 0, imports: 0, weather: 1, shortage: 0 },
    pop: { total: pop, births: 0, deaths: 0, migration: 0, urbanization: template?.pop.urbanization ?? 0.05, growthRate: 0, famineDeaths: 0, epidemicDeaths: 0, warDeaths: 0 },
    health: { care: template?.health.care ?? 10, sanitation: template?.health.sanitation ?? 10, medicine: template?.health.medicine ?? 5, epidemic: null },
    tech: { points: 0, known: [...(template?.tech.known ?? [])], researching: null, education: template?.tech.education ?? 5, institutions: 0, lastOutput: 0 },
    stability: { value: 50, satisfaction: 60, legitimacy: 45, unrest: 15, rebellion: 0, warExhaustion: 0 },
    military: { regiments: (pop / 1000) * 0.009, manpower: (pop / 1000) * 0.02, maxManpower: (pop / 1000) * 0.03, quality: template?.military.quality ?? 1, morale: 0.85, supply: 0.8, forts: 1, losses: 0, doctrine: 'defensive' },
    modifiers: [], ai: { personality: { aggression: 0.4, diplomacy: 0.6, economy: 0.5, expansion: 0.3 }, goals: ['survive'], decisions: [], nextThink: 0 },
    overlord: null, provinceCount: provinces.length, area: provinces.reduce((s, p) => s + w.provinces[p].area, 0),
  };
  w.countries[id] = c;
  w.countryOrder.push(id);
  for (const pid of provinces) { const p = w.provinces[pid]; p.owner = id; p.controller = id; p.siege = 0; p.unrest = Math.max(0, p.unrest - 30); }
  c.economy.treasury = (pop / 1000) * 0.05;
  invalidate(w);
  return c;
}

function cluster(w: World, owner: CountryId, start: number, st: MapStatic, maxSize: number, pred: (p: Province) => boolean): number[] {
  const out: number[] = [start];
  const seen = new Set<number>([start]);
  for (let i = 0; i < out.length && out.length < maxSize; i++) {
    for (const j of st.adjacency[out[i]] ?? []) {
      if (seen.has(j)) continue;
      seen.add(j);
      const q = w.provinces[j];
      if (q.owner === owner && pred(q) && j !== w.countries[owner].capital) { out.push(j); if (out.length >= maxSize) break; }
    }
  }
  return out;
}

export function spawnBreakaway(w: World, parent: Country, province: number, st: MapStatic, mode: 'rebel' | 'autonomy' | 'release' | 'pretender', nameOverride?: string): Country | null {
  const p = w.provinces[province];
  if (p.owner !== parent.id || province === parent.capital) return null;
  const all = w.provinces.filter((x) => x.owner === parent.id).length;
  if (all < 2) return null;
  const max = Math.max(1, Math.floor(all * (mode === 'pretender' ? 0.35 : 0.2)));
  const origin = p.originalOwner && p.originalOwner !== parent.id ? w.countries[p.originalOwner] : null;
  const ids = cluster(w, parent.id, province, st, max, (q) => (origin ? q.originalOwner === origin.id : q.unrest > 30 || mode === 'pretender'));
  let name: string;
  let revived: Country | null = null;
  if (origin && !origin.alive) {
    revived = origin;
    origin.alive = true; origin.collapsed = null; origin.founded = { ...w.date };
    for (const pid of ids) { const q = w.provinces[pid]; q.owner = origin.id; q.controller = origin.id; q.unrest = Math.max(0, q.unrest - 30); }
    origin.capital = ids[0]; origin.stability.value = 50; origin.stability.rebellion = 0; origin.overlord = null;
    origin.military.regiments = (ids.reduce((s, x) => s + w.provinces[x].pop, 0) / 1000) * 0.009;
    origin.tech.known = [...parent.tech.known];
    invalidate(w);
    name = origin.name;
  } else {
    const era = techLevel(parent.tech.known);
    name = mode === 'pretender' ? `${parent.name.replace(/^(Kingdom|Empire|Sultanate) of /, '')} (${p.name} claimant)` : era >= 4 ? `Republic of ${p.name}` : mode === 'rebel' ? `Free ${p.name}` : `${p.name}`;
  }
  if (nameOverride && !revived) name = nameOverride;
  const c = revived ?? newCountry(w, name, ids, parent, mode === 'rebel' ? 'rebel' : 'dataset');
  const verb = mode === 'release' ? 'is granted independence by' : mode === 'autonomy' ? 'becomes autonomous within' : mode === 'pretender' ? 'is seized by a rival claimant from' : 'rises in revolt against';
  log(w, `${c.name} ${verb} ${parent.name}.`, 'politics', c.id);
  addTimeline(w, mode === 'release' || mode === 'autonomy' ? 'founding' : 'rebellion', revived ? `${c.name} restored` : `Founding of ${c.name}`, `${c.name} (${ids.length} province${ids.length > 1 ? 's' : ''}) ${verb} ${parent.name}.`, [c.id, parent.id], parent.pop.total > 1e7 || parent.id === w.player ? 3 : 2);
  return c;
}

function makeCharacter(w: World, c: Country, title: string, ageMin: number, ageMax: number): Character {
  const h = Math.floor(rand(w) * 1e9);
  const region = w.provinces[c.capital]?.region ?? 'europe';
  return { name: generatedRulerName(region, h), title, born: w.date.y - (ageMin + (h % (ageMax - ageMin + 1))), health: 60 + (h % 40), skill: { admin: 1 + (h % 9), diplomacy: 1 + ((h >>> 4) % 9), military: 1 + ((h >>> 8) % 9) }, traits: [] };
}

export function rulerDeathChance(c: Country, year: number): number {
  const age = year - c.ruler.born;
  return clamp(0.00025 * Math.exp((age - 30) / 11) * (1.6 - c.ruler.health / 100), 0, 0.5);
}

/** Monthly: aging, deaths, heirs, rebellions. Returns countries whose ruler died without heir (for crisis events). */
export function internalPolitics(w: World, c: Country, st: MapStatic): void {
  // health declines with age
  const age = w.date.y - c.ruler.born;
  if (age > 50 && chance(w, 0.02)) c.ruler.health = Math.max(5, c.ruler.health - 3);
  const forcedDeath = c.ruler.health <= 0;
  if (forcedDeath || chance(w, rulerDeathChance(c, w.date.y))) succession(w, c, st);
  if (!c.heir && age > 18 && chance(w, 1 / 40)) c.heir = makeCharacter(w, c, 'Heir', 5, 25);
  if (c.heir && chance(w, 0.0008)) c.heir = null;
  // rebellion
  if (c.stability.rebellion >= 100 && c.provinceCount > 1) {
    c.stability.rebellion = 30;
    const ps = w.provinces.filter((p) => p.owner === c.id && p.id !== c.capital).sort((a, b) => b.unrest - a.unrest);
    if (ps.length) {
      const rebel = spawnBreakaway(w, c, ps[0].id, st, 'rebel');
      if (rebel) {
        rebel.military.regiments = Math.max(rebel.military.regiments, c.military.regiments * 0.25);
        c.military.regiments *= 0.85;
        declareWar(w, rebel.id, c.id, 'independence', st);
      }
    }
  }
}

export function succession(w: World, c: Country, st: MapStatic): void {
  const old = c.ruler;
  const major = c.pop.total > 8e6 || c.id === w.player;
  if (c.heir) {
    const heir = c.heir;
    c.ruler = { ...heir, title: old.title };
    c.heir = null;
    c.stability.legitimacy = clamp(c.stability.legitimacy - 6, 0, 100);
    log(w, `${old.name} of ${c.name} dies; ${c.ruler.name} succeeds.`, 'succession', c.id);
    if (major) addTimeline(w, 'succession', `${c.ruler.name} succeeds in ${c.name}`, `${old.name}${old.historical ? ' (historical figure)' : ''} dies aged ${w.date.y - old.born}. ${c.ruler.name} inherits the throne.`, [c.id], c.id === w.player ? 2 : 1);
    return;
  }
  // succession crisis
  c.ruler = makeCharacter(w, c, old.title, 25, 50);
  c.ruler.traits = ['contested'];
  c.stability.legitimacy = clamp(c.stability.legitimacy - 25, 0, 100);
  c.stability.value = clamp(c.stability.value - 12, 0, 100);
  log(w, `${old.name} of ${c.name} dies without a designated heir. A succession crisis erupts.`, 'succession', c.id);
  if (major) addTimeline(w, 'succession', `Succession crisis in ${c.name}`, `${old.name}${old.historical ? ' (historical figure)' : ''} dies without an heir; rival claimants contest the throne.`, [c.id], 3);
  const isPlayer = c.id === w.player || Object.values(w.players).includes(c.id);
  if (isPlayer) {
    w.events.pending.push({ uid: uid(w, 'e'), eventId: 'succession_crisis', country: c.id, date: { ...w.date }, title: 'Succession Crisis',
      body: `${old.name} has died without a designated heir. ${c.ruler.name} claims the throne, but other factions refuse to recognise the claim. Legitimacy has fallen to ${Math.round(c.stability.legitimacy)}.`,
      options: [
        { id: 'council', label: 'Convene a council of notables', hint: 'Legitimacy +15; costs 3 months of income.' },
        { id: 'force', label: 'Back the claimant with the army', hint: 'Legitimacy +5; stability −5; 35% chance a rival seizes part of the realm.' },
        { id: 'divide', label: 'Divide the realm among claimants', hint: 'A large region breaks away peacefully as a friendly state; stability +10.' },
      ] });
  } else if (c.provinceCount > 6 && chance(w, 0.35 + (c.government === 'khaganate' ? 0.3 : 0))) {
    const ps = w.provinces.filter((p) => p.owner === c.id && p.id !== c.capital);
    const far = ps.sort((a, b) => Math.hypot(b.lon - w.provinces[c.capital].lon, b.lat - w.provinces[c.capital].lat) - Math.hypot(a.lon - w.provinces[c.capital].lon, a.lat - w.provinces[c.capital].lat))[0];
    if (far) {
      const rival = spawnBreakaway(w, c, far.id, st, 'pretender');
      if (rival) { getRelation(w, rival.id, c.id).opinion = -80; if (chance(w, 0.5)) declareWar(w, c.id, rival.id, 'conquest', st); }
    }
  }
}

export function resolveSuccessionChoice(w: World, c: Country, option: string, st: MapStatic): string {
  if (option === 'council') { c.economy.treasury -= Math.max(5, c.economy.income * 3); c.stability.legitimacy += 15; return 'The council confirms the new ruler.'; }
  if (option === 'force') {
    c.stability.legitimacy += 5; c.stability.value -= 5;
    if (chance(w, 0.35)) { const ps = w.provinces.filter((p) => p.owner === c.id && p.id !== c.capital); if (ps.length) { const r = spawnBreakaway(w, c, ps[Math.floor(rand(w) * ps.length)].id, st, 'pretender'); if (r) { declareWar(w, r.id, c.id, 'independence', st); return `A rival claimant seizes ${r.name} and fights on.`; } } }
    return 'The army enforces the succession.';
  }
  const ps = w.provinces.filter((p) => p.owner === c.id && p.id !== c.capital);
  if (ps.length) { const r = spawnBreakaway(w, c, ps[ps.length - 1].id, st, 'release'); if (r) { getRelation(w, r.id, c.id).opinion = 60; c.stability.value += 10; return `${r.name} is granted to a relative as an independent realm.`; } }
  return 'The realm is divided.';
}
