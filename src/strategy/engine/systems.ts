// Interconnected domestic systems updated every simulated month:
// economy → food → population → health → technology → stability → military.
import type { BudgetKey, Country, MapStatic, Province, World } from '../types/game';
import { TECH_BY_ID, TECHS, techAvailable, techLevel } from '../data/technologies';
import { GOVERNMENTS } from '../data/eras';
import { addTimeline, clamp, log, modifierSum, peekRelation } from './util';
import { byOwner, tradePartners } from './cache';

const ownedProvinces = (w: World, c: Country): Province[] => (byOwner(w).get(c.id) ?? []).map((i) => w.provinces[i]).filter((p) => p.owner === c.id);
import { chance, rand } from './rng';

const DEFAULT_SHARE: Record<BudgetKey, number> = { military: 0.3, infrastructure: 0.15, research: 0.12, health: 0.1, agriculture: 0.15, administration: 0.18 };
const REF_SPEND_FRACTION = 0.12 * 0.6 * 0.85; // reference fraction of monthly GDP spent at default settings

export interface CountryCalc {
  tl: number; gdp: number; taxEff: number; spend: Record<BudgetKey, number>; mult: Record<BudgetKey, number>;
  upkeep: number; overextension: number; tradePartners: number; foodMod: number;
}

export function provinceProductivity(p: Province, tl: number): number {
  return 0.9 * Math.pow(1.55, tl) * (1 + p.dev * 0.035) * (1 + p.market * 0.06 + p.roads * 0.03 + p.port * 0.04 + p.buildings * 0.03);
}
export function foodMultiplier(w: World, c: Country, p: Province, agriMult = 1, foodMod?: number): number {
  const occupied = p.controller !== p.owner ? 0.55 : 1;
  return (1 + 0.12 * p.farms + (p.river ? 0.05 : 0)) * (1 + (foodMod ?? modifierSum(w, c, 'foodProduction'))) * (1 + 0.12 * (agriMult - 1)) * c.food.weather * occupied;
}
export function provinceFood(w: World, c: Country, p: Province, agriMult = 1, foodMod?: number): number {
  const cap = p.baseCap * foodMultiplier(w, c, p, agriMult, foodMod);
  if (cap <= 0) return 0;
  return cap * (1 - Math.exp((-2.5 * p.pop) / cap));
}

/** Calibrate province carrying capacity so that every starting country begins with a modest food surplus. */
export function calibrateFood(w: World): void {
  for (const p of w.provinces) {
    const c = p.owner ? w.countries[p.owner] : null;
    if (!c || p.pop <= 0) continue;
    p.baseCap = (p.pop * 1.35) / foodMultiplier(w, c, p, 1);
  }
}

export function computeCalc(w: World, c: Country): CountryCalc {
  const tl = techLevel(c.tech.known);
  let gdp = 0, core = 0, nonCore = 0;
  for (const p of ownedProvinces(w, c)) {
    gdp += (p.pop / 1000) * provinceProductivity(p, tl) * (p.controller !== p.owner ? 0.4 : 1);
    const v = 1 + p.pop / 2e5;
    if (p.originalOwner === c.id) core += v; else nonCore += v;
  }
  const monthlyGdp = Math.max(1, gdp / 12);
  const adminShare = c.economy.budget.administration / (Object.values(c.economy.budget).reduce((a, b) => a + b, 0) || 1);
  const overextension = Math.max(0, nonCore / Math.max(1, core) - (0.25 + tl * 0.05 + c.ruler.skill.admin * 0.02 + adminShare * 0.5));
  const budgetSum = Object.values(c.economy.budget).reduce((a, b) => a + b, 0) || 1;
  const est = estimateIncome(w, c, gdp, tl);
  const totalSpend = est.income * c.economy.spendingRate;
  const spend = {} as Record<BudgetKey, number>;
  const mult = {} as Record<BudgetKey, number>;
  for (const k of Object.keys(DEFAULT_SHARE) as BudgetKey[]) {
    spend[k] = (totalSpend * c.economy.budget[k]) / budgetSum;
    mult[k] = clamp(Math.sqrt(spend[k] / monthlyGdp / (REF_SPEND_FRACTION * DEFAULT_SHARE[k])), 0, 2.2);
  }
  const upkeep = c.military.regiments * 0.9 * (1 + tl * 0.3);
  return { tl, gdp, taxEff: est.taxEff, spend, mult, upkeep, overextension, tradePartners: est.partners, foodMod: modifierSum(w, c, 'foodProduction') };
}

function estimateIncome(w: World, c: Country, gdp: number, tl: number) {
  const adminShare = c.economy.budget.administration / (Object.values(c.economy.budget).reduce((a, b) => a + b, 0) || 1);
  const taxEff = clamp(0.5 + (adminShare - 0.18) * 0.8 + (c.stability.value - 50) / 250 + modifierSum(w, c, 'taxEfficiency') + c.ruler.skill.admin * 0.012 - c.economy.inflation * 2, 0.1, 1.15);
  const tax = (gdp / 12) * c.economy.taxRate * taxEff;
  const partners = tradePartners(w).get(c.id) ?? 0;
  const trade = (gdp / 12) * 0.018 * (1 + modifierSum(w, c, 'tradeIncome') + partners * 0.07) * (1 + tl * 0.05);
  return { income: tax + trade, tax, trade, taxEff, partners };
}

export function updateCountry(w: World, c: Country, st: MapStatic): void {
  const calc = computeCalc(w, c);
  const provs = ownedProvinces(w, c);
  if (!provs.length) return;
  economy(w, c, calc);
  food(w, c, calc, provs);
  population(w, c, calc, provs, st);
  health(w, c, calc, st, provs);
  technology(w, c, calc, st);
  stability(w, c, calc, provs);
  military(w, c, calc, provs);
  infrastructure(w, c, calc, provs);
  c.provinceCount = provs.length;
}

// ---------------- ECONOMY ----------------
function economy(w: World, c: Country, k: CountryCalc): void {
  const e = c.economy;
  const est = estimateIncome(w, c, k.gdp, k.tl);
  let tribute = 0;
  if (c.overlord && w.countries[c.overlord]?.alive) {
    tribute = est.tax * 0.12;
    w.countries[c.overlord].economy.treasury += tribute;
  }
  e.gdp = k.gdp;
  e.tradeIncome = est.trade;
  e.income = est.income - tribute;
  const spending = Object.values(k.spend).reduce((a, b) => a + b, 0);
  const interest = (e.debt * e.interestRate) / 12;
  e.expenses = spending + interest;
  e.lastBalance = e.income - e.expenses;
  e.treasury += e.lastBalance;
  if (e.treasury < 0) {
    e.debt += -e.treasury * 1.02;
    e.treasury = 0;
  }
  // repay debt automatically from large surpluses
  if (e.debt > 0 && e.treasury > e.income * 6) { const pay = Math.min(e.debt, e.treasury - e.income * 6); e.debt -= pay; e.treasury -= pay; }
  const annualIncome = Math.max(1, e.income * 12);
  const debtRatio = e.debt / annualIncome;
  e.interestRate = clamp(0.04 + debtRatio * 0.03 - (c.tech.known.includes('banking') ? 0.01 : 0), 0.02, 0.25);
  const targetInfl = 0.008 + debtRatio * 0.015 + Math.max(0, c.economy.spendingRate - 1) * 0.05 + modifierSum(w, c, 'inflation') + (c.stability.value < 25 ? 0.02 : 0);
  e.inflation = clamp(e.inflation + (targetInfl - e.inflation) * 0.04, -0.02, 0.6);
  if (k.gdp > w.stats.peakGdp && c.id === w.player) w.stats.peakGdp = k.gdp;
}

// ---------------- FOOD ----------------
function food(w: World, c: Country, k: CountryCalc, provs: Province[]): void {
  const f = c.food;
  let prod = 0, cons = 0;
  for (const p of provs) { prod += provinceFood(w, c, p, k.mult.agriculture, k.foodMod); cons += p.pop; }
  // trade agreements smooth shortages through imports (bounded by trade capacity & treasury)
  f.imports = 0;
  if (prod < cons && k.tradePartners > 0 && c.economy.treasury > 0) {
    const need = cons - prod;
    const capacity = cons * 0.04 * Math.min(4, k.tradePartners);
    const price = 0.0009 * (1 + k.tl * 0.2);
    const buy = Math.min(need, capacity, c.economy.treasury / price);
    f.imports = buy; prod += buy; c.economy.treasury -= buy * price;
  }
  f.production = prod; f.consumption = cons;
  const avgBuild = provs.reduce((s, p) => s + p.buildings, 0) / provs.length;
  f.storageMonths = 2 + avgBuild * 0.6 + k.tl * 0.5;
  f.stock += prod - cons;
  const cap = cons * f.storageMonths;
  if (f.stock > cap) {
    const excess = Math.min(f.stock - cap, cons * 0.05 * (1 + k.tradePartners * 0.2));
    c.economy.treasury += excess * (k.gdp / 12 / Math.max(1, cons)) * 0.1;
    f.stock = cap;
  }
  if (f.stock < 0) {
    f.famineMonths++;
    const shortage = clamp(-f.stock / Math.max(1, cons), 0, 1);
    f.stock = 0;
    f.shortage = shortage;
  } else {
    f.famineMonths = Math.max(0, f.famineMonths - 1);
    f.shortage = 0;
  }
  // weather recovers toward normal
  f.weather += (1 - f.weather) * 0.08;
}

// ---------------- POPULATION ----------------
function population(w: World, c: Country, k: CountryCalc, provs: Province[], st: MapStatic): void {
  const shortage = c.food.shortage;
  const tl = k.tl;
  const birth = clamp(0.042 - 0.0025 * tl - 0.006 * Math.max(0, tl - 4.5), 0.011, 0.043) * (1 + modifierSum(w, c, 'popGrowth'));
  const protection = Math.min(0.65, c.health.care / 300 + c.health.sanitation / 300);
  let death = 0.042 * (1 - protection) * (1 + modifierSum(w, c, 'deathRate'));
  death = Math.max(0.007, death);
  const famineRate = shortage * 0.25; // annual
  const epi = c.health.epidemic ? c.health.epidemic.severity * 0.22 * (1 - c.health.care / 220) : 0;
  const warRate = (w.wars.some((x) => !x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id))) ? 0.002 : 0);
  let births = 0, deaths = 0, famineD = 0, epiD = 0;
  for (const p of provs) {
    const cap = p.baseCap * foodMultiplier(w, c, p, k.mult.agriculture, k.foodMod);
    const pressure = cap > 0 ? p.pop / (cap * 0.8) : 2;
    const b = (birth * clamp(1.9 - pressure, 0.25, 1.35)) / 12;
    const d = (death + famineRate + epi + warRate + (p.controller !== p.owner ? 0.01 : 0)) / 12;
    const nb = p.pop * b, nd = p.pop * d;
    births += nb; deaths += nd;
    famineD += (p.pop * famineRate) / 12; epiD += (p.pop * epi) / 12;
    p.pop = Math.max(0, p.pop + nb - nd);
  }
  // internal migration toward less crowded, developed provinces (one hop per month)
  for (const p of provs) {
    const cap = p.baseCap * foodMultiplier(w, c, p, k.mult.agriculture, k.foodMod);
    if (cap <= 0 || p.pop / cap < 0.95) continue;
    for (const j of st.adjacency[p.id] ?? []) {
      const q = w.provinces[j];
      if (q.owner !== c.id) continue;
      const qc = q.baseCap * foodMultiplier(w, c, q, k.mult.agriculture, k.foodMod);
      if (qc > 0 && q.pop / qc < 0.7) { const mv = p.pop * 0.002; p.pop -= mv; q.pop += mv; }
    }
  }
  // emigration under famine / collapse
  let migration = 0;
  if (shortage > 0.05 || c.stability.value < 20) {
    const rate = 0.0008 + shortage * 0.004;
    for (const p of provs) { const mv = p.pop * rate; p.pop -= mv; migration -= mv; }
  }
  c.pop.births = births; c.pop.deaths = deaths; c.pop.migration = migration;
  c.pop.famineDeaths += famineD; c.pop.epidemicDeaths += epiD;
  const before = c.pop.total;
  c.pop.total = provs.reduce((s, p) => s + p.pop, 0);
  c.pop.growthRate = before > 0 ? ((c.pop.total - before) / before) * 12 : 0;
  const avgMarket = provs.reduce((s, p) => s + p.market, 0) / provs.length;
  const urbTarget = clamp(0.04 + tl * 0.1 + avgMarket * 0.02 + (tl > 4 ? (tl - 4) * 0.12 : 0), 0.02, 0.9);
  c.pop.urbanization += (urbTarget - c.pop.urbanization) * 0.005;
}

// ---------------- HEALTH ----------------
function health(w: World, c: Country, k: CountryCalc, st: MapStatic, owned: Province[]): void {
  const h = c.health;
  const provs = c.provinceCount || 1;
  let build = 0, roads = 0;
  for (const p of owned) { build += p.buildings; roads += p.roads; }
  const careTarget = clamp(k.tl * k.tl * 2.5 * (0.5 + 0.5 * k.mult.health) + (build / provs) * 2, 0, 100);
  const sanTarget = clamp(k.tl * k.tl * 2.3 + (build / provs) * 4 + (roads / provs) * 1.5 + (k.mult.health - 1) * 8, 0, 100);
  h.care += (careTarget - h.care) * 0.02;
  h.sanitation += (sanTarget - h.sanitation) * 0.015;
  h.medicine = clamp(TECHS.filter((t) => t.category === 'medicine' && c.tech.known.includes(t.id)).length * 15 + c.tech.education * 0.1, 0, 100);
  if (h.epidemic) {
    h.epidemic.monthsLeft--;
    h.epidemic.severity *= 0.97 - h.care / 3000;
    if (h.epidemic.monthsLeft <= 0 || h.epidemic.severity < 0.03) {
      log(w, `The ${h.epidemic.name} in ${c.name} has subsided.`, 'health', c.id);
      h.epidemic = null;
    } else {
      // spread through land borders and trade partners
      const seen = new Set<string>();
      for (const p of owned) for (const j of st.adjacency[p.id] ?? []) {
        const o = w.provinces[j].owner;
        if (o && o !== c.id) seen.add(o);
      }
      for (const o of seen) {
        const t = w.countries[o];
        if (!t?.alive || t.health.epidemic) continue;
        const trade = peekRelation(w, c.id, o)?.treaties.trade ? 1.6 : 1;
        const p = 0.035 * h.epidemic.severity * trade * (1 - t.health.sanitation / 140) * (t.tech.known.includes('quarantine') ? 0.6 : 1);
        if (chance(w, p)) {
          t.health.epidemic = { name: h.epidemic.name, severity: h.epidemic.severity * 0.85, monthsLeft: 10 + Math.floor(rand(w) * 14), origin: h.epidemic.origin };
          log(w, `The ${h.epidemic.name} spreads from ${c.name} to ${t.name}.`, 'health', o);
          if (t.id === w.player) addTimeline(w, 'disaster', `${h.epidemic.name} reaches ${t.name}`, `Spread from ${c.name}.`, [t.id, c.id], 2);
        }
      }
    }
  }
}

// ---------------- TECHNOLOGY ----------------
export function techCost(w: World, c: Country, id: string, st?: MapStatic): number {
  const t = TECH_BY_ID[id];
  let cost = t.cost;
  // knowledge diffusion: cheaper if neighbours or trade partners already know it
  let known = 0, total = 0;
  for (const o of w.countryOrder) {
    if (o === c.id) continue;
    const r = peekRelation(w, c.id, o);
    if (!r) continue;
    const other = w.countries[o];
    if (!other?.alive) continue;
    total++;
    if (other.tech.known.includes(id)) known += r.treaties.trade ? 2 : 1;
  }
  if (total) cost *= 1 - 0.4 * Math.min(1, known / Math.max(3, total * 0.5));
  return Math.round(cost);
}
function technology(w: World, c: Country, k: CountryCalc, st: MapStatic): void {
  const t = c.tech;
  const out = (k.gdp / 12) * 0.0045 * k.mult.research * (1 + t.education / 90) * (1 + modifierSum(w, c, 'research')) + t.institutions * 1.5 + c.ruler.skill.admin * 0.2;
  t.lastOutput = out;
  t.points += out;
  if (!t.researching || !techAvailable(t.known, t.researching)) {
    t.researching = c.id === w.player ? (t.researching && techAvailable(t.known, t.researching) ? t.researching : null) : chooseResearch(w, c);
  }
  if (t.researching) {
    const cost = techCost(w, c, t.researching, st);
    if (t.points >= cost) {
      t.points -= cost;
      t.known.push(t.researching);
      const def = TECH_BY_ID[t.researching];
      log(w, `${c.name} discovers ${def.name}.`, 'tech', c.id);
      if (c.id === w.player || def.era >= 4 || c.pop.total > 2e7) addTimeline(w, 'technology', `${c.name}: ${def.name}`, def.description, [c.id], c.id === w.player ? 2 : 1);
      if (def.category === 'administration' && def.era >= 3) t.institutions++;
      t.researching = c.id === w.player ? null : chooseResearch(w, c);
    }
  } else {
    // unspent research is capped so the player does not bank unlimited points
    t.points = Math.min(t.points, 4000);
  }
  const eduTarget = clamp(k.tl * 13 + t.institutions * 3 + (k.mult.research - 1) * 10 + (c.tribal ? -5 : 0), 1, 100);
  t.education += (eduTarget - t.education) * 0.01;
}
export function chooseResearch(w: World, c: Country): string | null {
  const opts = TECHS.filter((t) => techAvailable(c.tech.known, t.id));
  if (!opts.length) return null;
  const needFood = c.food.production < c.food.consumption * 1.03;
  const atWar = w.wars.some((x) => !x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id)));
  let best = opts[0], bestScore = -Infinity;
  for (const t of opts) {
    let s = -t.era * 10;
    if (t.category === 'agriculture' && needFood) s += 12;
    if (t.category === 'military') s += atWar ? 10 : c.ai.personality.aggression * 6;
    if (t.category === 'commerce') s += c.ai.personality.economy * 6;
    if (t.category === 'medicine' && c.health.epidemic) s += 8;
    if (t.category === 'administration' && c.stability.value < 40) s += 6;
    s += (t.id.charCodeAt(0) % 3);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  return best.id;
}

// ---------------- STABILITY ----------------
function stability(w: World, c: Country, k: CountryCalc, provs: Province[]): void {
  const s = c.stability;
  const shortage = c.food.shortage;
  const atWar = w.wars.some((x) => !x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id)));
  const capital = w.provinces[c.capital];
  // province unrest
  let unrestSum = 0;
  for (const p of provs) {
    let target = 5 + Math.max(0, c.economy.taxRate - 0.12) * 120 + shortage * 60 + k.overextension * 25 + modifierSum(w, c, 'unrest');
    if (p.originalOwner && p.originalOwner !== c.id) target += 12;
    if (p.controller !== p.owner) target += 20;
    if (capital) target += Math.min(15, Math.hypot(p.lon - capital.lon, p.lat - capital.lat) / 4 - k.tl);
    target -= (k.mult.administration - 1) * 8 + p.buildings * 1.5;
    if (c.health.epidemic) target += 6;
    p.unrest += (clamp(target, 0, 100) - p.unrest) * 0.06;
    unrestSum += p.unrest * p.pop;
  }
  s.unrest = c.pop.total > 0 ? unrestSum / c.pop.total : 0;
  for (const p of provs) if (p.originalOwner !== c.id && p.controller === c.id && p.unrest < 30 && rand(w) < 1 / 300) p.originalOwner = c.id;
  const satTarget = clamp(62 - (c.economy.taxRate - 0.12) * 140 - shortage * 45 - (c.health.epidemic ? 10 : 0) + (k.mult.health - 1) * 6 - c.economy.inflation * 250 + Math.min(8, c.pop.growthRate * 300) - (atWar ? s.warExhaustion * 0.25 : 0), 0, 100);
  s.satisfaction += (satTarget - s.satisfaction) * 0.06;
  const gov = GOVERNMENTS[c.government];
  const legTarget = clamp(55 + (gov.effects.legitimacy ?? 0) + c.ruler.skill.admin * 2 + c.ruler.skill.diplomacy - (c.ruler.traits.includes('usurper') ? 20 : 0) + modifierSum(w, c, 'legitimacy') - (c.overlord ? 8 : 0), 0, 100);
  s.legitimacy += (legTarget - s.legitimacy) * 0.03;
  const target = clamp(50 + (s.legitimacy - 50) * 0.35 + (s.satisfaction - 50) * 0.6 + modifierSum(w, c, 'stability') - s.warExhaustion * 0.3 - s.unrest * 0.35 - k.overextension * 10 + (c.economy.debt > c.economy.income * 36 ? -8 : 0), 0, 100);
  s.value += (target - s.value) * 0.05;
  if (atWar) s.warExhaustion = clamp(s.warExhaustion + 0.25, 0, 100); else s.warExhaustion = Math.max(0, s.warExhaustion - 0.8);
  if (s.value < 25) s.rebellion = clamp(s.rebellion + (25 - s.value) * 0.18 + (c.tribal ? 0 : 0.2), 0, 100);
  else s.rebellion = Math.max(0, s.rebellion - 1.5);
  if (c.id === w.player) { if (s.value >= 60) w.stats.stableMonths++; else w.stats.stableMonths = 0; }
}

// ---------------- MILITARY ----------------
function military(w: World, c: Country, k: CountryCalc, owned: Province[]): void {
  const m = c.military;
  m.maxManpower = (c.pop.total / 1000) * (c.tribal ? 0.06 : 0.03) * (1 + modifierSum(w, c, 'manpower'));
  m.manpower = Math.min(m.maxManpower, m.manpower + m.maxManpower / 100);
  const coverage = k.upkeep > 0 ? k.spend.military / k.upkeep : 2;
  if (coverage < 1) {
    m.morale = clamp(m.morale - (1 - coverage) * 0.04, 0.1, 1);
    const desert = m.regiments * (1 - coverage) * 0.015;
    m.regiments = Math.max(0, m.regiments - desert);
  } else {
    m.morale = clamp(m.morale + 0.02 * Math.min(1, coverage - 0.9) + modifierSum(w, c, 'morale') * 0.01, 0.1, 0.95 + modifierSum(w, c, 'morale'));
  }
  m.quality = 1 + k.tl * 0.35 + modifierSum(w, c, 'militaryQuality') + c.ruler.skill.military * 0.02 + (k.mult.military > 1.2 ? 0.05 : 0);
  const foodMonths = c.food.consumption > 0 ? c.food.stock / c.food.consumption : 0;
  let roads = 0, forts = 0;
  for (const p of owned) { roads += p.roads; forts += p.fort; }
  m.supply = clamp(0.35 + Math.min(1, foodMonths / 3) * 0.3 + (roads / Math.max(1, c.provinceCount)) * 0.06 + (c.economy.treasury > 0 ? 0.1 : -0.1), 0.1, 1);
  m.forts = forts / Math.max(1, c.provinceCount);
}

// ---------------- INFRASTRUCTURE (budget-driven maintenance & growth) ----------------
function infrastructure(w: World, c: Country, k: CountryCalc, provs: Province[]): void {
  const p = provs[Math.floor(rand(w) * provs.length)];
  const prob = 0.04 * k.mult.infrastructure * Math.min(3, 1 + provs.length / 40);
  if (chance(w, prob)) {
    const maxLvl = Math.min(5, 1 + Math.floor(k.tl) + (k.tl >= 3 ? 1 : 0));
    const order: ('roads' | 'farms' | 'market' | 'buildings' | 'port')[] = ['farms', 'roads', 'market', 'buildings', 'port'];
    for (const key of order) {
      if (key === 'port' && !p.coastal) continue;
      if (p[key] < maxLvl) { p[key]++; break; }
    }
  }
  // development rises slowly in peaceful, well-connected provinces
  if (chance(w, 0.02 * (1 + k.mult.infrastructure))) {
    const q = provs[Math.floor(rand(w) * provs.length)];
    if (q.controller === q.owner && q.unrest < 40) q.dev = Math.min(30, q.dev + 1);
  }
  if (k.mult.infrastructure < 0.3 && chance(w, 0.03)) {
    const q = provs[Math.floor(rand(w) * provs.length)];
    if (q.roads > 0) q.roads--;
  }
}
