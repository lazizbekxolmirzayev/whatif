import type { Country, CountryId, Difficulty, FlagDesign, GameDate, GovernmentId, MapStatic, Province, World } from '../types/game';
import { regionOf, regionShares, regionTechFactor, worldPopulation } from '../data/regions';
import { CORRECTIONS, PROFILES, colorFor, generatedFlag, generatedRulerName, guessGovernment, hashString } from '../data/polities';
import { TECHS, TECH_BY_ID, techLevel } from '../data/technologies';
import { CITIES } from '../data/cities';
import { clamp, distanceKm, getRelation, addTimeline } from './util';
import { rand, randRange, seedFrom } from './rng';

export interface ProvinceMeta { n: string; m: string; x: number; y: number; a: number; c: number; r: number; d: number; t: number }
export interface OwnersFile { year: number; polities: { name: string; subjectOf: string | null; tribal: boolean; precision: number }[]; owner: number[] }
export interface MapBundle { key: string; meta: ProvinceMeta[]; owners: OwnersFile; static: MapStatic; drawn: boolean[] }

export interface SandboxEmpire {
  name: string; flag: FlagDesign; color: string; government: GovernmentId;
  capital: number; provinces: number[]; population: number;
  resources: 'scarce' | 'standard' | 'abundant'; techEra: number; rulerName: string;
}
export interface CreateOptions {
  name: string; seed?: number; start: GameDate; mode: World['mode'];
  scenarioId?: string | null; decisions?: Record<string, string>;
  player?: string | null; // polity name
  difficulty?: Difficulty;
  sandbox?: SandboxEmpire | null;
  politicalSetting?: 'historical' | 'empty';
}

const SUBJECT_ALIAS: Record<string, string> = { USA: 'United States', Netherlands: 'Netherlands', Papu: '' };

export const DIFFICULTY_FACTOR: Record<Difficulty, number> = { story: 1.35, normal: 1, hard: 0.82, ironman: 0.75 };

function blankCountry(id: CountryId, name: string, year: number, start: GameDate): Country {
  return {
    id, name, color: colorFor(name), flag: PROFILES[name]?.flag ?? generatedFlag(name), capital: -1,
    government: 'monarchy', tribal: false, alive: true, founded: { ...start }, collapsed: null, historical: true, origin: 'dataset',
    ruler: { name: '', title: 'Ruler', born: year - 40, health: 80, skill: { admin: 5, diplomacy: 5, military: 5 }, traits: [] },
    heir: null,
    economy: { treasury: 0, taxRate: 0.12, budget: { military: 0.3, infrastructure: 0.15, research: 0.12, health: 0.1, agriculture: 0.15, administration: 0.18 }, spendingRate: 0.95, gdp: 0, income: 0, expenses: 0, tradeIncome: 0, inflation: 0.01, debt: 0, interestRate: 0.06, lastBalance: 0 },
    food: { stock: 0, production: 0, consumption: 0, storageMonths: 4, famineMonths: 0, imports: 0, weather: 1, shortage: 0 },
    pop: { total: 0, births: 0, deaths: 0, migration: 0, urbanization: 0.05, growthRate: 0, famineDeaths: 0, epidemicDeaths: 0, warDeaths: 0 },
    health: { care: 10, sanitation: 10, medicine: 5, epidemic: null },
    tech: { points: 0, known: [], researching: null, education: 5, institutions: 0, lastOutput: 0 },
    stability: { value: 55, satisfaction: 55, legitimacy: 60, unrest: 10, rebellion: 0, warExhaustion: 0 },
    military: { regiments: 0, manpower: 0, maxManpower: 0, quality: 1, morale: 0.75, supply: 0.8, forts: 1, losses: 0, doctrine: 'balanced' },
    modifiers: [],
    ai: { personality: { aggression: 0.4, diplomacy: 0.5, economy: 0.5, expansion: 0.4 }, goals: [], decisions: [], nextThink: 0 },
    overlord: null, provinceCount: 0, area: 0,
  };
}

function knownTechsFor(year: number, factor: number, tribal: boolean): string[] {
  let eff = year - (1 - factor) * (year < 1500 ? 700 : 260);
  if (tribal) eff -= 1800;
  const known = new Set<string>();
  for (const t of TECHS) if (t.year <= eff) known.add(t.id);
  // close over prerequisites so the tree stays consistent
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Array.from(known)) for (const r of TECH_BY_ID[id].requires) if (!known.has(r)) { known.add(r); changed = true; }
  }
  return TECHS.filter((t) => known.has(t.id)).map((t) => t.id);
}

export function techForEra(era: number): string[] {
  return TECHS.filter((t) => t.era < era).map((t) => t.id);
}

/** Builds a fresh deterministic world from a historical dataset. */
export function createWorld(bundle: MapBundle, opts: CreateOptions): World {
  const year = opts.start.y;
  const seed = opts.seed ?? seedFrom(`${opts.name}|${bundle.key}|${year}`);
  const w: World = {
    version: 1, id: `w${seed.toString(36)}${Date.now().toString(36)}`, name: opts.name, seed, rng: seed,
    date: { ...opts.start }, startDate: { ...opts.start }, mapKey: bundle.key, mode: opts.mode,
    scenarioId: opts.scenarioId ?? null, decisions: { ...(opts.decisions ?? {}) },
    provinces: [], countries: {}, countryOrder: [], relations: {}, wars: [],
    events: { pending: [], fired: {}, history: [], scheduledDone: [], custom: [] },
    offers: [], timeline: [], log: [], history: [], ownership: [],
    player: null, players: {},
    settings: { difficulty: opts.difficulty ?? 'normal', eventsFrequency: 1, aiAggression: 1, fogOfHistory: false },
    stats: { ticks: 0, battles: 0, eventsResolved: 0, crisesSurvived: 0, maxProvinces: 0, stableMonths: 0, peakGdp: 0 },
    achievements: [], uidCounter: 0,
  };
  // w.id must be deterministic for multiplayer/server re-creation; Date.now only suffixes local ids.
  if (opts.mode === 'multiplayer') w.id = `w${seed.toString(36)}`;

  // ---- resolve polity name per province (with editorial corrections) ----
  const { polities, owner } = bundle.owners;
  const corr = CORRECTIONS.filter((c) => c.key === bundle.key);
  const provPolity: (string | null)[] = bundle.meta.map((m, i) => {
    if (!bundle.drawn[i]) return null;
    const o = owner[i];
    if (o < 0) return null;
    let nm = polities[o].name;
    for (const c of corr) if (c.from === nm && (c.modern === '*' || c.modern.includes(m.m))) { nm = c.to; break; }
    return nm;
  });
  const polityInfo = new Map<string, { tribal: boolean; subjectOf: string | null }>();
  polities.forEach((p) => polityInfo.set(p.name, { tribal: p.tribal, subjectOf: p.subjectOf }));
  for (const c of corr) polityInfo.set(c.to, { tribal: false, subjectOf: c.subjectOf ?? null });

  // ---- countries ----
  const nameToId = new Map<string, CountryId>();
  const empty = opts.politicalSetting === 'empty';
  provPolity.forEach((nm) => {
    if (!nm || nameToId.has(nm) || empty) return;
    const id = `c${nameToId.size + 1}`;
    nameToId.set(nm, id);
    const c = blankCountry(id, nm, year, opts.start);
    const info = polityInfo.get(nm)!;
    c.tribal = info.tribal || /farmers|nomads|tribes|hunters|pastoral|chiefdoms|gatherers|foragers/i.test(nm);
    c.government = PROFILES[nm]?.government ?? guessGovernment(nm, c.tribal, year);
    if (PROFILES[nm]?.personality) c.ai.personality = { ...PROFILES[nm]!.personality! };
    else {
      const h = hashString(nm);
      c.ai.personality = { aggression: 0.2 + ((h & 255) / 255) * 0.6, diplomacy: 0.2 + (((h >>> 8) & 255) / 255) * 0.6, economy: 0.3 + (((h >>> 16) & 255) / 255) * 0.5, expansion: 0.2 + (((h >>> 24) & 255) / 255) * 0.6 };
    }
    w.countries[id] = c;
    w.countryOrder.push(id);
  });

  // ---- provinces with population ----
  const shares = regionShares(year);
  const total = worldPopulation(year);
  const weights: number[] = [];
  const regionWeight: Record<string, number> = {};
  // historical urban centres (curated cities existing in this year) concentrate population
  const cityBoost = new Map<number, number>();
  for (const city of CITIES) {
    if (city.founded > year || (city.abandoned !== undefined && city.abandoned <= year)) continue;
    let best = -1, bd = 260;
    bundle.meta.forEach((m, i) => { if (!bundle.drawn[i]) return; const d = distanceKm(m.x, m.y, city.lon, city.lat); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) cityBoost.set(best, (cityBoost.get(best) ?? 1) * 2.5);
  }
  bundle.meta.forEach((m, i) => {
    const region = regionOf(m.m, m.x, m.y);
    const nm = provPolity[i];
    const tribal = nm ? polityInfo.get(nm)?.tribal : true;
    let fert = 1;
    if (m.r) fert *= 1.7;
    if (m.c) fert *= 1.25;
    if (m.d) fert *= m.r ? 0.55 : 0.12; // river oases vs open desert
    const reg0 = regionOf(m.m, m.x, m.y);
    if ((reg0 === 'centralasia' || reg0 === 'russia') && !m.r && m.a > 60000) fert *= 0.3; // dry steppe & taiga
    if (m.t) fert *= 0.55;
    const lat = Math.abs(m.y);
    if (lat > 62) fert *= 0.06; else if (lat > 55) fert *= 0.45; else if (lat < 12) fert *= 0.85;
    let wgt = Math.pow(Math.max(m.a, 50), 0.72) * fert * (nm ? (tribal ? 0.2 : 1) : 0.05) * (cityBoost.get(i) ?? 1);
    if (!bundle.drawn[i]) wgt = 0;
    weights.push(wgt);
    regionWeight[region] = (regionWeight[region] ?? 0) + wgt;
    const p: Province = {
      id: i, name: m.n, modern: m.m, lon: m.x, lat: m.y, area: m.a, region,
      coastal: !!m.c, river: !!m.r, desert: !!m.d, mountain: !!m.t,
      owner: nm && !empty ? nameToId.get(nm)! : null, controller: null, originalOwner: null,
      pop: 0, baseCap: 0, dev: 1, roads: 0, port: 0, farms: 0, market: 0, buildings: 0, fort: 0, unrest: 0, siege: 0,
    };
    p.controller = p.owner; p.originalOwner = p.owner;
    w.provinces.push(p);
  });
  for (const p of w.provinces) {
    const rw = regionWeight[p.region] || 1;
    p.pop = Math.round((weights[p.id] / rw) * shares[p.region] * total);
  }

  // ---- tech, infrastructure & economy per country ----
  for (const c of Object.values(w.countries)) {
    const provs = w.provinces.filter((p) => p.owner === c.id);
    const cap = provs.reduce((a, b) => (b.pop > a.pop ? b : a), provs[0]);
    const f = regionTechFactor(cap.region, year);
    c.tech.known = knownTechsFor(year, f, c.tribal);
  }
  if (opts.sandbox) applySandbox(w, opts.sandbox, year);
  for (const c of Object.values(w.countries)) initCountry(w, c, year);
  for (const p of w.provinces) {
    if (p.pop > 0 && !p.baseCap) p.baseCap = Math.max(p.pop * 1.35, p.area * 2);
    if (!p.owner) { p.baseCap = Math.max(p.pop * 1.35, p.area * (p.desert ? 0.5 : 6)); p.dev = 1; }
  }

  // ---- overlords & initial relations ----
  for (const [nm, id] of nameToId) {
    let sub = polityInfo.get(nm)?.subjectOf ?? null;
    if (sub && SUBJECT_ALIAS[sub] !== undefined) sub = SUBJECT_ALIAS[sub] || null;
    const ov = sub ? nameToId.get(sub) : undefined;
    if (ov && ov !== id) {
      w.countries[id].overlord = ov;
      const r = getRelation(w, id, ov);
      r.opinion = 40; r.trust = 60;
    }
  }
  const neighbours = countryNeighbours(w, bundle.static);
  for (const [a, set] of neighbours) for (const b of set) if (a < b) {
    const r = getRelation(w, a, b);
    if (r.opinion === 0) r.opinion = Math.round(randRange(w, -35, 25));
  }

  // ---- player ----
  if (opts.sandbox) w.player = w.countryOrder[w.countryOrder.length - 1];
  else if (opts.player) w.player = nameToId.get(opts.player) ?? null;
  if (w.player) w.countries[w.player].ai.goals = ['player'];

  addTimeline(w, 'start', `${opts.name}`, `The simulation begins in ${year < 0 ? `${-year} BC` : year}. Borders follow the historical-basemaps dataset (${bundle.key}).`, w.player ? [w.player] : [], 3, false);
  return w;
}

function applySandbox(w: World, s: SandboxEmpire, year: number): void {
  const id = `c${w.countryOrder.length + 1}`;
  const c = blankCountry(id, s.name, year, w.date);
  c.flag = s.flag; c.color = s.color; c.government = s.government; c.historical = false; c.origin = 'player';
  c.tech.known = techForEra(s.techEra);
  w.countries[id] = c; w.countryOrder.push(id);
  const set = new Set(s.provinces.length ? s.provinces : [s.capital]);
  set.add(s.capital);
  let current = 0;
  for (const pid of set) current += w.provinces[pid].pop;
  const scale = current > 0 ? s.population / current : 1;
  for (const pid of set) {
    const p = w.provinces[pid];
    p.owner = id; p.controller = id; p.originalOwner = id;
    p.pop = current > 0 ? Math.round(p.pop * scale) : Math.round(s.population / set.size);
    p.baseCap = p.pop * (s.resources === 'abundant' ? 1.6 : s.resources === 'scarce' ? 1.2 : 1.35);
  }
  c.capital = s.capital;
  c.ruler = { name: s.rulerName || 'The Founder', title: 'Founder', born: year - 35, health: 85, skill: { admin: 6, diplomacy: 6, military: 6 }, traits: ['founder'] };
  c.economy.treasury = s.resources === 'abundant' ? 2.2 : s.resources === 'scarce' ? 0.5 : 1;
  c.modifiers.push({ id: 'newly_founded', label: 'Newly founded nation (others observe before acting)', until: (w.date.y * 12 + w.date.m) + 120, effects: { stability: 5 }, source: 'sandbox' });
  // countries left with no provinces are removed
  for (const other of Object.values(w.countries)) if (other.id !== id && !w.provinces.some((p) => p.owner === other.id)) {
    delete w.countries[other.id];
    w.countryOrder = w.countryOrder.filter((x) => x !== other.id);
  }
}

export function initCountry(w: World, c: Country, year: number): void {
  const provs = w.provinces.filter((p) => p.owner === c.id);
  if (!provs.length) { c.alive = false; return; }
  const tl = techLevel(c.tech.known);
  for (const p of provs) {
    p.dev = clamp(Math.round(2 + tl * 2.2 + (p.river ? 2 : 0) + (p.coastal ? 1 : 0) + rand(w) * 3 - (c.tribal ? 2 : 0)), 1, 30);
    p.roads = clamp(Math.floor(tl * 0.8 + rand(w)), 0, 5);
    p.farms = clamp(Math.floor(tl * 0.6 + (p.river ? 1 : 0) + rand(w)), 0, 5);
    p.market = clamp(Math.floor(tl * 0.6 + rand(w) * 1.2), 0, 5);
    p.port = p.coastal ? clamp(Math.floor(tl * 0.6 + rand(w)), 0, 5) : 0;
    p.buildings = clamp(Math.floor(tl * 0.5 + rand(w)), 0, 5);
    p.fort = clamp(Math.floor(tl * 0.5 + (p.mountain ? 1 : 0)), 0, 5);
    if (!p.baseCap) p.baseCap = Math.max(p.pop * 1.35, p.area * 2);
  }
  // capital: curated city if available, else most populous province
  const prof = PROFILES[c.name];
  let capital = provs.reduce((a, b) => (b.pop > a.pop ? b : a), provs[0]).id;
  if (c.capital >= 0 && w.provinces[c.capital]?.owner === c.id) capital = c.capital;
  else if (prof?.capital) {
    const city = CITIES.find((x) => x.id === prof.capital);
    if (city) {
      let best = Infinity;
      for (const p of provs) { const d = distanceKm(p.lon, p.lat, city.lon, city.lat); if (d < best) { best = d; if (d < 600) capital = p.id; } }
    }
  }
  c.capital = capital;
  w.provinces[capital].dev = clamp(w.provinces[capital].dev + 4, 1, 30);
  w.provinces[capital].buildings = clamp(w.provinces[capital].buildings + 1, 0, 5);

  const pop = provs.reduce((s, p) => s + p.pop, 0);
  c.pop.total = pop;
  c.provinceCount = provs.length;
  c.area = provs.reduce((s, p) => s + p.area, 0);
  c.pop.urbanization = clamp(0.04 + tl * 0.07, 0.02, 0.8);
  c.health.care = clamp(tl * tl * 2.5, 2, 90);
  c.health.sanitation = clamp(tl * tl * 2.3, 2, 90);
  c.health.medicine = clamp(tl * 14, 0, 90);
  c.tech.education = clamp(3 + tl * 12 + (c.tribal ? -3 : 0), 1, 95);
  c.tech.institutions = Math.floor(tl * 1.5);
  const regionCap = w.provinces[capital].region;
  if (!c.ruler.name) {
    const h = hashString(c.name + year);
    c.ruler = {
      name: generatedRulerName(regionCap, h), title: c.tribal ? 'Chief' : c.government === 'khaganate' ? 'Khan' : c.government === 'empire' ? 'Emperor' : c.government.includes('republic') || c.government === 'democracy' ? 'Head of State' : 'Monarch',
      born: year - 25 - (h % 35), health: 60 + (h % 35), skill: { admin: 2 + (h % 8), diplomacy: 2 + ((h >>> 3) % 8), military: 2 + ((h >>> 6) % 8) }, traits: [],
    };
    c.heir = { name: generatedRulerName(regionCap, h >>> 7), title: 'Heir', born: year - 10 - ((h >>> 9) % 15), health: 75, skill: { admin: 1 + ((h >>> 11) % 9), diplomacy: 1 + ((h >>> 13) % 9), military: 1 + ((h >>> 15) % 9) }, traits: [] };
  }
  // economy seed
  const gdp = estimateGdp(w, c);
  c.economy.gdp = gdp;
  c.economy.taxRate = c.tribal ? 0.06 : c.government === 'one_party_state' ? 0.3 : year > 1900 ? 0.22 : 0.12;
  if (!c.economy.treasury || c.economy.treasury < 10) c.economy.treasury = gdp * c.economy.taxRate * 0.5 * (c.economy.treasury || 1) * DIFFICULTY_FACTOR[c.id === w.player ? w.settings.difficulty : 'normal'];
  c.food.stock = pop * 3;
  c.military.maxManpower = (pop / 1000) * (c.tribal ? 0.06 : 0.03);
  c.military.manpower = c.military.maxManpower * 0.6;
  c.military.regiments = (pop / 1000) * (c.tribal ? 0.012 : 0.006) * (year > 1900 ? 1.8 : 1);
  c.military.quality = 1 + tl * 0.35;
  c.military.forts = provs.reduce((s, p) => s + p.fort, 0) / provs.length;
  c.ai.nextThink = (hashString(c.id) % 6);
}

/** Annual output model: per-capita productivity grows with technology, development and infrastructure. */
export function estimateGdp(w: World, c: Country): number {
  const tl = techLevel(c.tech.known);
  let g = 0;
  for (const p of w.provinces) if (p.owner === c.id) {
    const prod = 0.9 * Math.pow(1.55, tl) * (1 + p.dev * 0.035) * (1 + p.market * 0.06 + p.roads * 0.03 + p.port * 0.04 + p.buildings * 0.03);
    g += (p.pop / 1000) * prod;
  }
  return g;
}

export function countryNeighbours(w: World, st: MapStatic): Map<CountryId, Set<CountryId>> {
  const out = new Map<CountryId, Set<CountryId>>();
  w.provinces.forEach((p, i) => {
    if (!p.owner) return;
    for (const j of st.adjacency[i] ?? []) {
      const o = w.provinces[j].owner;
      if (o && o !== p.owner) {
        if (!out.has(p.owner)) out.set(p.owner, new Set());
        out.get(p.owner)!.add(o);
      }
    }
  });
  return out;
}
