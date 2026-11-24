// Dynamic event engine. Every event has trigger conditions evaluated against the live
// simulation state, a monthly probability, player/AI decisions and concrete effects.
import type { Country, CustomEventDef, EventEffect, GovernmentId, MapStatic, PendingEvent, World } from '../types/game';
import { addModifier, addTimeline, alive, clamp, fmtNum, getRelation, log, now, uid } from './util';
import { chance, pick, rand, weightedPick } from './rng';
import { techLevel } from '../data/technologies';
import { GOVERNMENTS, eraIndex, eraForYear } from '../data/eras';
import { byOwner, neighbours } from './cache';
const owned = (w: World, c: Country) => (byOwner(w).get(c.id) ?? []).map((i) => w.provinces[i]).filter((p) => p.owner === c.id);
import { declareWar, endWar, transferProvince } from './military';
import { resolveSuccessionChoice, spawnBreakaway } from './internal';

type Data = Record<string, number | string>;
export interface EventOption {
  id: string; label: string; hint: string;
  ai: (w: World, c: Country, d: Data) => number;
  apply: (w: World, c: Country, d: Data, st: MapStatic) => string;
}
export interface EventDef {
  id: string; title: string; category: 'disaster' | 'economy' | 'politics' | 'science' | 'diplomacy' | 'health' | 'military' | 'society';
  cooldown: number; // months before it can fire again for the same country
  probability: (w: World, c: Country, st: MapStatic) => number; // monthly, 0 when conditions unmet
  setup?: (w: World, c: Country, st: MapStatic) => Data | null;
  immediate?: (w: World, c: Country, d: Data, st: MapStatic) => void;
  body: (w: World, c: Country, d: Data) => string;
  options: EventOption[];
  timeline?: boolean;
}

const tl = (c: Country) => techLevel(c.tech.known);
const yearOf = (w: World) => w.date.y;
const randomProvince = (w: World, c: Country) => { const ps = owned(w, c); return ps.length ? ps[Math.floor(rand(w) * ps.length)] : null; };
const gold = (c: Country, months: number) => Math.max(5, c.economy.income * months);

export const EVENT_DEFS: EventDef[] = [
  {
    id: 'epidemic', title: 'Outbreak of Disease', category: 'health', cooldown: 120, timeline: true,
    probability: (w, c) => (c.health.epidemic ? 0 : 0.0016 * (1 + c.pop.urbanization * 4) * (1 - c.health.sanitation / 130) * (c.pop.total > 1e6 ? 1.4 : 0.6)),
    setup: (w, c) => { const p = randomProvince(w, c); if (!p) return null; const era = eraIndex(eraForYear(yearOf(w))); const names = ['plague', 'smallpox epidemic', 'fever', 'cholera epidemic', 'influenza pandemic', 'typhus outbreak']; return { province: p.id, name: names[Math.min(names.length - 1, era < 3 ? Math.floor(rand(w) * 3) : 2 + Math.floor(rand(w) * 4))], severity: Math.round((0.35 + rand(w) * 0.5) * 100) / 100 }; },
    immediate: (w, c, d) => { c.health.epidemic = { name: String(d.name), severity: Number(d.severity), monthsLeft: 12 + Math.floor(rand(w) * 18), origin: Number(d.province) }; },
    body: (w, c, d) => `A ${d.name} has broken out in ${w.provinces[Number(d.province)].name}. Physicians estimate its severity at ${Math.round(Number(d.severity) * 100)}%. Current sanitation: ${Math.round(c.health.sanitation)}/100.`,
    options: [
      { id: 'quarantine', label: 'Impose quarantine', hint: 'Severity −40%, trade income −20% for 12 months.', ai: (w, c) => c.tech.known.includes('quarantine') ? 3 : 1.5,
        apply: (w, c) => { if (c.health.epidemic) c.health.epidemic.severity *= 0.6; addModifier(w, c, { id: 'quarantine', label: 'Quarantine', months: 12, effects: { tradeIncome: -0.2 } }); return 'Quarantine imposed; trade suffers but the disease slows.'; } },
      { id: 'physicians', label: 'Fund physicians and hospitals', hint: 'Costs 4 months of income. Severity −25%, healthcare +8.', ai: (w, c) => c.economy.treasury > gold(c, 4) ? 2 : 0.2,
        apply: (w, c) => { c.economy.treasury -= gold(c, 4); if (c.health.epidemic) c.health.epidemic.severity *= 0.75; c.health.care = clamp(c.health.care + 8, 0, 100); return 'Physicians are dispatched.'; } },
      { id: 'endure', label: 'Let it run its course', hint: 'No cost now; full mortality and unrest.', ai: () => 0.7,
        apply: (w, c) => { addModifier(w, c, { id: 'neglect', label: 'Neglected epidemic', months: 18, effects: { stability: -4 } }); return 'The authorities do nothing.'; } },
    ],
  },
  {
    id: 'famine', title: 'Famine', category: 'disaster', cooldown: 36, timeline: true,
    probability: (w, c) => (c.food.famineMonths >= 2 && c.food.shortage > 0.05 ? 0.5 : 0),
    body: (w, c) => `Granaries are empty. ${Math.round(c.food.shortage * 100)}% of the population's needs go unmet; ${fmtNum(c.pop.famineDeaths)} have already died of hunger in this realm's history. Food production ${fmtNum(c.food.production)} vs consumption ${fmtNum(c.food.consumption)} per month.`,
    options: [
      { id: 'buy', label: 'Buy grain abroad', hint: 'Costs 6 months of income: +3 months of food stock.', ai: (w, c) => (c.economy.treasury > gold(c, 6) ? 3 : 0.1),
        apply: (w, c) => { c.economy.treasury -= gold(c, 6); c.food.stock += c.food.consumption * 3; return 'Grain ships arrive.'; } },
      { id: 'requisition', label: 'Requisition from nobles and monasteries', hint: '+1.5 months of food, legitimacy −10.', ai: () => 1.2,
        apply: (w, c) => { c.food.stock += c.food.consumption * 1.5; c.stability.legitimacy = clamp(c.stability.legitimacy - 10, 0, 100); return 'Stores are seized by force.'; } },
      { id: 'relief', label: 'Tax relief for farmers', hint: 'Tax rate −5 points, farms improved in 3 provinces, satisfaction +8.', ai: () => 1,
        apply: (w, c) => { c.economy.taxRate = Math.max(0, c.economy.taxRate - 0.05); for (let i = 0; i < 3; i++) { const p = randomProvince(w, c); if (p) p.farms = Math.min(5, p.farms + 1); } c.stability.satisfaction = clamp(c.stability.satisfaction + 8, 0, 100); return 'Taxes are cut and farms rebuilt.'; } },
    ],
  },
  {
    id: 'drought', title: 'Drought', category: 'disaster', cooldown: 60,
    probability: (w, c) => (c.food.weather > 0.95 ? 0.0025 * (c.provinceCount > 3 ? 1 : 0.5) : 0),
    immediate: (w, c) => { c.food.weather = 0.72; },
    body: (w, c) => `Rains have failed across ${c.name}. Harvests will fall by roughly a quarter this season. Food stock: ${(c.food.stock / Math.max(1, c.food.consumption)).toFixed(1)} months.`,
    options: [
      { id: 'irrigate', label: 'Emergency irrigation works', hint: 'Costs 5 months of income; harvest penalty halved, +1 farms in 2 provinces.', ai: (w, c) => (c.economy.treasury > gold(c, 5) ? 2 : 0.1),
        apply: (w, c) => { c.economy.treasury -= gold(c, 5); c.food.weather = 0.86; for (let i = 0; i < 2; i++) { const p = randomProvince(w, c); if (p) p.farms = Math.min(5, p.farms + 1); } return 'Canals are dug.'; } },
      { id: 'ration', label: 'Ration grain', hint: 'Stability −3, food consumption effectively reduced via stock +1 month.', ai: () => 1,
        apply: (w, c) => { c.food.stock += c.food.consumption; addModifier(w, c, { id: 'rationing', label: 'Rationing', months: 12, effects: { stability: -3 } }); return 'Rationing begins.'; } },
      { id: 'pray', label: 'Hope for rain', hint: 'No cost. Full harvest losses.', ai: () => 0.5, apply: () => 'The court waits for rain.' },
    ],
  },
  {
    id: 'good_harvest', title: 'Bountiful Harvest', category: 'society', cooldown: 48,
    probability: (w, c) => (c.food.weather >= 0.98 ? 0.002 : 0),
    immediate: (w, c) => { c.food.weather = 1.18; },
    body: (w, c) => `Exceptional weather has produced a bumper harvest throughout ${c.name}.`,
    options: [
      { id: 'store', label: 'Fill the state granaries', hint: '+2 months of food stock.', ai: (w, c) => (c.food.shortage > 0 ? 3 : 1), apply: (w, c) => { c.food.stock += c.food.consumption * 2; return 'Granaries are filled.'; } },
      { id: 'sell', label: 'Export the surplus', hint: '+3 months of income.', ai: () => 1.2, apply: (w, c) => { c.economy.treasury += gold(c, 3); return 'Merchants profit.'; } },
    ],
  },
  {
    id: 'earthquake', title: 'Natural Disaster', category: 'disaster', cooldown: 120, timeline: true,
    probability: (w, c) => 0.0009 * Math.min(3, c.provinceCount / 15 + 0.3),
    setup: (w, c) => { const p = randomProvince(w, c); if (!p) return null; const kind = p.mountain ? 'earthquake' : p.coastal ? 'great flood' : p.river ? 'river flood' : 'great fire'; return { province: p.id, kind }; },
    immediate: (w, c, d) => { const p = w.provinces[Number(d.province)]; const loss = p.pop * (0.01 + rand(w) * 0.03); p.pop -= loss; d.loss = Math.round(loss); p.buildings = Math.max(0, p.buildings - 1); p.roads = Math.max(0, p.roads - 1); },
    body: (w, c, d) => `A ${d.kind} strikes ${w.provinces[Number(d.province)].name}, killing an estimated ${fmtNum(Number(d.loss))} people and destroying buildings and roads.`,
    options: [
      { id: 'rebuild', label: 'Rebuild at state expense', hint: 'Costs 4 months of income; restores buildings, satisfaction +6.', ai: (w, c) => (c.economy.treasury > gold(c, 4) ? 2 : 0.1),
        apply: (w, c, d) => { c.economy.treasury -= gold(c, 4); const p = w.provinces[Number(d.province)]; p.buildings = Math.min(5, p.buildings + 1); p.roads = Math.min(5, p.roads + 1); c.stability.satisfaction = clamp(c.stability.satisfaction + 6, 0, 100); return 'Reconstruction begins.'; } },
      { id: 'local', label: 'Leave it to local lords', hint: 'No cost; unrest +15 in the province.', ai: () => 1, apply: (w, c, d) => { w.provinces[Number(d.province)].unrest += 15; return 'Locals are left to fend for themselves.'; } },
    ],
  },
  {
    id: 'debt_crisis', title: 'Fiscal Crisis', category: 'economy', cooldown: 60, timeline: true,
    probability: (w, c) => (c.economy.debt > Math.max(50, c.economy.income * 30) || c.economy.inflation > 0.12 ? 0.08 : 0),
    body: (w, c) => `Creditors are alarmed: debt stands at ${fmtNum(c.economy.debt)} (≈${(c.economy.debt / Math.max(1, c.economy.income)).toFixed(0)} months of income) with interest at ${(c.economy.interestRate * 100).toFixed(1)}% and inflation at ${(c.economy.inflation * 100).toFixed(1)}%.`,
    options: [
      { id: 'austerity', label: 'Austerity', hint: 'Spending rate −25 points for 2 years, stability −8, inflation −3%.', ai: (w, c) => c.ai.personality.economy * 3,
        apply: (w, c) => { c.economy.spendingRate = Math.max(0.4, c.economy.spendingRate - 0.25); c.economy.inflation = Math.max(0, c.economy.inflation - 0.03); addModifier(w, c, { id: 'austerity', label: 'Austerity', months: 24, effects: { stability: -8 } }); w.stats.crisesSurvived += c.id === w.player ? 1 : 0; return 'Budgets are slashed.'; } },
      { id: 'default', label: 'Default on the debt', hint: 'Debt erased; trust of all countries −25, legitimacy −15, trade −20% for 5 years.', ai: (w, c) => (c.economy.debt > c.economy.income * 50 ? 2 : 0.4),
        apply: (w, c) => { c.economy.debt = 0; c.stability.legitimacy = clamp(c.stability.legitimacy - 15, 0, 100); for (const o of w.countryOrder) { const r = w.relations[[c.id, o].sort().join('|')]; if (r) r.trust = clamp(r.trust - 25, 0, 100); } addModifier(w, c, { id: 'defaulted', label: 'Sovereign default', months: 60, effects: { tradeIncome: -0.2 } }); w.stats.crisesSurvived += c.id === w.player ? 1 : 0; return 'The crown repudiates its debts.'; } },
      { id: 'debase', label: 'Debase the currency', hint: 'Treasury +8 months of income; inflation +6%.', ai: () => 0.8,
        apply: (w, c) => { c.economy.treasury += gold(c, 8); c.economy.inflation += 0.06; w.stats.crisesSurvived += c.id === w.player ? 1 : 0; return 'Coins are clipped and new money printed.'; } },
    ],
  },
  {
    id: 'peasant_revolt', title: 'Uprising', category: 'politics', cooldown: 36, timeline: true,
    probability: (w, c) => (c.stability.value < 35 && (c.economy.taxRate > 0.18 || c.food.shortage > 0.05) ? 0.03 : 0),
    setup: (w, c) => { const ps = w.provinces.filter((p) => p.owner === c.id).sort((a, b) => b.unrest - a.unrest); return ps.length ? { province: ps[0].id } : null; },
    body: (w, c, d) => `Commoners in ${w.provinces[Number(d.province)].name} have risen against tax collectors and officials. Unrest there: ${Math.round(w.provinces[Number(d.province)].unrest)}%.`,
    options: [
      { id: 'concede', label: 'Grant concessions', hint: 'Tax rate −4 points; unrest −20 in the province; legitimacy −4.', ai: (w, c) => 1 + (1 - c.ai.personality.aggression),
        apply: (w, c, d) => { c.economy.taxRate = Math.max(0, c.economy.taxRate - 0.04); w.provinces[Number(d.province)].unrest = Math.max(0, w.provinces[Number(d.province)].unrest - 20); c.stability.legitimacy -= 4; return 'Grievances are addressed.'; } },
      { id: 'suppress', label: 'Send troops', hint: 'Costs 3% of the army; unrest −30 there for now; satisfaction −6.', ai: (w, c) => c.ai.personality.aggression * 2,
        apply: (w, c, d) => { c.military.regiments *= 0.97; w.provinces[Number(d.province)].unrest = Math.max(0, w.provinces[Number(d.province)].unrest - 30); c.stability.satisfaction -= 6; return 'The revolt is put down by force, leaving lasting resentment.'; } },
    ],
  },
  {
    id: 'revolution', title: 'Revolutionary Crisis', category: 'politics', cooldown: 180, timeline: true,
    probability: (w, c) => (c.stability.value < 22 && tl(c) >= 3 && !c.tribal ? 0.025 : 0),
    body: (w, c) => `Radical clubs, pamphlets and mutinous soldiers threaten the ${GOVERNMENTS[c.government].name.toLowerCase()} of ${c.name}. Stability ${Math.round(c.stability.value)}, legitimacy ${Math.round(c.stability.legitimacy)}.`,
    options: [
      { id: 'reform', label: 'Embrace reform', hint: 'Government becomes more representative; stability +15, legitimacy reset.', ai: (w, c) => 1.5 + c.ai.personality.diplomacy,
        apply: (w, c) => { const next: GovernmentId = tl(c) >= 4.5 ? 'democracy' : tl(c) >= 3.5 ? 'constitutional_monarchy' : 'republic'; const old = c.government; c.government = next; c.stability.value = clamp(c.stability.value + 15, 0, 100); c.stability.legitimacy = 60; c.stability.rebellion = 0; addTimeline(w, 'event', `${c.name} reforms`, `${GOVERNMENTS[old].name} → ${GOVERNMENTS[next].name}.`, [c.id], 2); return `The state becomes a ${GOVERNMENTS[next].name}.`; } },
      { id: 'crackdown', label: 'Crack down', hint: 'Unrest suppressed short-term; legitimacy −15, satisfaction −10, risk of later revolt. Repression causes real human harm.', ai: (w, c) => c.ai.personality.aggression * 2,
        apply: (w, c) => { for (const p of w.provinces) if (p.owner === c.id) p.unrest *= 0.6; c.stability.legitimacy -= 15; c.stability.satisfaction -= 10; addModifier(w, c, { id: 'repression', label: 'Repression', months: 60, effects: { unrest: -5, research: -0.1, legitimacy: -5 } }); return 'Arrests and censorship silence dissent — for now.'; } },
      { id: 'collapse', label: 'Let the regime fall', hint: 'A new government takes over (random); stability resets to 45; ruler replaced.', ai: () => 0.4,
        apply: (w, c) => { const govs: GovernmentId[] = tl(c) >= 4 ? ['democracy', 'one_party_state', 'military_junta', 'republic'] : ['republic', 'monarchy', 'theocracy']; c.government = pick(w, govs); c.stability.value = 45; c.stability.rebellion = 0; c.ruler = { ...c.ruler, name: `${c.ruler.name.split(' ')[0]} the Younger`, title: 'Leader', traits: ['revolutionary'] }; addTimeline(w, 'rebellion', `Revolution in ${c.name}`, `The old regime collapses; a ${GOVERNMENTS[c.government].name} takes power.`, [c.id], 3); return `Revolution: a ${GOVERNMENTS[c.government].name} takes power.`; } },
    ],
  },
  {
    id: 'independence_movement', title: 'Independence Movement', category: 'politics', cooldown: 120, timeline: true,
    probability: (w, c) => { const n = owned(w, c).filter((p) => p.originalOwner && p.originalOwner !== c.id && p.unrest > 45).length; return n >= 1 && c.provinceCount > 2 ? 0.01 * Math.min(4, n) : 0; },
    setup: (w, c) => { const ps = w.provinces.filter((p) => p.owner === c.id && p.originalOwner && p.originalOwner !== c.id && p.unrest > 45); if (!ps.length) return null; const p = ps.sort((a, b) => b.unrest - a.unrest)[0]; return { province: p.id, origin: p.originalOwner ?? '' }; },
    body: (w, c, d) => `Leaders in ${w.provinces[Number(d.province)].name}, once part of ${w.countries[String(d.origin)]?.name ?? 'another realm'}, demand self-rule.`,
    options: [
      { id: 'autonomy', label: 'Grant autonomy as a vassal', hint: 'The region becomes a vassal state (tributary). Unrest falls.', ai: (w, c) => 1 + c.ai.personality.diplomacy,
        apply: (w, c, d, st) => { const nc = spawnBreakaway(w, c, Number(d.province), st, 'autonomy'); if (nc) { nc.overlord = c.id; return `${nc.name} becomes an autonomous vassal.`; } return 'Autonomy granted locally.'; } },
      { id: 'suppress', label: 'Suppress the movement', hint: 'Unrest −25 in the region now; legitimacy −6; may provoke a war of independence later.', ai: (w, c) => 1 + c.ai.personality.aggression,
        apply: (w, c, d) => { const p = w.provinces[Number(d.province)]; p.unrest = Math.max(0, p.unrest - 25); c.stability.legitimacy -= 6; return 'Leaders are arrested.'; } },
      { id: 'release', label: 'Grant full independence', hint: 'The region becomes a sovereign state; stability +5, opinion +50.', ai: () => 0.3,
        apply: (w, c, d, st) => { const nc = spawnBreakaway(w, c, Number(d.province), st, 'release'); if (nc) { getRelation(w, c.id, nc.id).opinion = 50; c.stability.value += 5; return `${nc.name} becomes independent peacefully.`; } return 'Nothing changes.'; } },
    ],
  },
  {
    id: 'discovery', title: 'Scientific Discovery', category: 'science', cooldown: 60, timeline: true,
    probability: (w, c) => (c.tech.education > 20 ? 0.002 * (c.tech.education / 30) * (1 + c.tech.institutions * 0.2) : 0),
    body: (w, c) => `Scholars in ${w.provinces[c.capital]?.name ?? c.name} announce a remarkable discovery. Education level: ${Math.round(c.tech.education)}/100, institutions: ${c.tech.institutions}.`,
    options: [
      { id: 'academy', label: 'Found an academy', hint: 'Costs 6 months of income: +1 institution, research +200 points.', ai: (w, c) => (c.economy.treasury > gold(c, 6) ? 2 : 0.2),
        apply: (w, c) => { c.economy.treasury -= gold(c, 6); c.tech.institutions++; c.tech.points += 200; return 'A royal academy is established.'; } },
      { id: 'publish', label: 'Publish freely', hint: 'Research +120; opinion +10 with all trade partners.', ai: () => 1,
        apply: (w, c) => { c.tech.points += 120; for (const [k, r] of Object.entries(w.relations)) if (r.treaties.trade && k.includes(c.id)) r.opinion += 10; return 'Knowledge spreads abroad.'; } },
      { id: 'secret', label: 'Keep it a state secret', hint: 'Research +160; military quality +5% for 5 years.', ai: (w, c) => c.ai.personality.aggression * 1.5,
        apply: (w, c) => { c.tech.points += 160; addModifier(w, c, { id: 'secret_tech', label: 'Secret knowledge', months: 60, effects: { militaryQuality: 0.05 } }); return 'The discovery is classified.'; } },
    ],
  },
  {
    id: 'trade_boom', title: 'Trade Expansion', category: 'economy', cooldown: 72,
    probability: (w, c) => { const partners = Object.entries(w.relations).filter(([k, r]) => r.treaties.trade && k.includes(c.id)).length; return partners >= 2 || c.tech.known.includes('navigation') ? 0.0025 : 0; },
    body: (w, c) => `Merchants report booming demand for ${c.name}'s goods along new routes.`,
    options: [
      { id: 'charter', label: 'Charter a trading company', hint: 'Costs 4 months of income: trade income +20% for 10 years.', ai: (w, c) => c.ai.personality.economy * 3,
        apply: (w, c) => { c.economy.treasury -= gold(c, 4); addModifier(w, c, { id: 'charter', label: 'Chartered company', months: 120, effects: { tradeIncome: 0.2 } }); return 'A chartered company is founded.'; } },
      { id: 'tax', label: 'Tax the merchants', hint: 'Treasury +5 months of income.', ai: () => 1, apply: (w, c) => { c.economy.treasury += gold(c, 5); return 'Customs duties are raised.'; } },
    ],
  },
  {
    id: 'reform_movement', title: 'Calls for Government Reform', category: 'politics', cooldown: 240,
    probability: (w, c) => (!c.tribal && c.stability.value > 40 && rand(w) < 0.5 ? 0.0007 : 0),
    body: (w, c) => `Thinkers and officials in ${c.name} propose reorganising the state. Current system: ${GOVERNMENTS[c.government].name}.`,
    options: [
      { id: 'centralise', label: 'Centralise authority', hint: 'Tax efficiency +10% for 20 years; unrest +3.', ai: (w, c) => c.ai.personality.expansion * 2,
        apply: (w, c) => { addModifier(w, c, { id: 'centralisation', label: 'Centralisation', months: 240, effects: { taxEfficiency: 0.1, unrest: 3 } }); return 'Power is concentrated in the capital.'; } },
      { id: 'councils', label: 'Strengthen councils and courts', hint: 'Legitimacy +10, stability +3 for 20 years.', ai: (w, c) => c.ai.personality.diplomacy * 2,
        apply: (w, c) => { addModifier(w, c, { id: 'councils', label: 'Rule of law', months: 240, effects: { legitimacy: 10, stability: 3 } }); return 'Courts and councils gain authority.'; } },
      { id: 'status_quo', label: 'Preserve tradition', hint: 'No change.', ai: () => 1, apply: () => 'Tradition prevails.' },
    ],
  },
  {
    id: 'border_incident', title: 'Border Incident', category: 'diplomacy', cooldown: 48,
    probability: (w, c, st) => (neighbours(w, st).get(c.id)?.size ? 0.002 : 0),
    setup: (w, c, st) => { const n = Array.from(neighbours(w, st).get(c.id) ?? []).filter((x) => w.countries[x]?.alive && !w.countries[x].tribal); return n.length ? { other: pick(w, n) } : null; },
    body: (w, c, d) => `Soldiers of ${c.name} and ${w.countries[String(d.other)].name} clashed in a border skirmish. Current opinion: ${Math.round(getRelation(w, c.id, String(d.other)).opinion)}.`,
    options: [
      { id: 'apologise', label: 'Apologise', hint: 'Opinion +25; legitimacy −3.', ai: (w, c) => c.ai.personality.diplomacy * 2, apply: (w, c, d) => { getRelation(w, c.id, String(d.other)).opinion += 25; c.stability.legitimacy -= 3; return 'An apology is sent.'; } },
      { id: 'demand', label: 'Demand reparations', hint: 'Opinion −40; treasury +2 months of their income if they are weaker.', ai: (w, c) => c.ai.personality.aggression * 2,
        apply: (w, c, d) => { const o = w.countries[String(d.other)]; getRelation(w, c.id, o.id).opinion -= 40; if (c.military.regiments > o.military.regiments) { const amt = gold(o, 2); o.economy.treasury -= amt; c.economy.treasury += amt; return 'Reparations are paid under protest.'; } return 'The demand is refused.'; } },
      { id: 'ignore', label: 'Ignore it', hint: 'Opinion −10.', ai: () => 1, apply: (w, c, d) => { getRelation(w, c.id, String(d.other)).opinion -= 10; return 'The incident is ignored.'; } },
    ],
  },
  {
    id: 'golden_age', title: 'Golden Age', category: 'society', cooldown: 360, timeline: true,
    probability: (w, c) => (c.stability.value > 72 && c.pop.growthRate > 0.002 && c.economy.lastBalance > 0 ? 0.003 : 0),
    body: (w, c) => `Prosperity, peace and patronage have ushered in a golden age of art and learning in ${c.name}.`,
    options: [
      { id: 'patronage', label: 'Patronise the arts and sciences', hint: 'Research +15%, stability +5 for 15 years.', ai: () => 2, apply: (w, c) => { addModifier(w, c, { id: 'golden_age', label: 'Golden Age', months: 180, effects: { research: 0.15, stability: 5 } }); return 'Patronage flourishes.'; } },
      { id: 'monuments', label: 'Build monuments', hint: 'Costs 6 months of income: legitimacy +15 for 30 years.', ai: () => 1, apply: (w, c) => { c.economy.treasury -= gold(c, 6); addModifier(w, c, { id: 'monuments', label: 'Great monuments', months: 360, effects: { legitimacy: 15 } }); return 'Great monuments rise.'; } },
    ],
  },
  {
    id: 'military_reform', title: 'Military Reform', category: 'military', cooldown: 180,
    probability: (w, c) => (c.military.losses > c.military.regiments * 0.5 && c.stability.warExhaustion < 40 ? 0.004 : 0),
    body: (w, c) => `Veteran officers urge reform after heavy losses (${fmtNum(c.military.losses * 1000)} soldiers lost so far).`,
    options: [
      { id: 'drill', label: 'Professionalise the army', hint: 'Costs 5 months of income: quality +10% for 25 years.', ai: () => 2, apply: (w, c) => { c.economy.treasury -= gold(c, 5); addModifier(w, c, { id: 'mil_reform', label: 'Professional army', months: 300, effects: { militaryQuality: 0.1, morale: 0.05 } }); return 'Drill and discipline improve.'; } },
      { id: 'levy', label: 'Expand conscription', hint: 'Manpower +20% for 25 years; satisfaction −4.', ai: (w, c) => c.ai.personality.aggression * 2, apply: (w, c) => { addModifier(w, c, { id: 'conscription', label: 'Conscription', months: 300, effects: { manpower: 0.2 } }); c.stability.satisfaction -= 4; return 'Conscription is extended.'; } },
    ],
  },
  {
    id: 'noble_conspiracy', title: 'Conspiracy at Court', category: 'politics', cooldown: 120,
    probability: (w, c) => (c.stability.legitimacy < 35 && !c.tribal ? 0.01 : 0),
    body: (w, c) => `Powerful factions plot against ${c.ruler.name}. Legitimacy has fallen to ${Math.round(c.stability.legitimacy)}.`,
    options: [
      { id: 'purge', label: 'Purge the conspirators', hint: 'Legitimacy +8; stability −6; admin efficiency −5% for 5 years.', ai: (w, c) => c.ai.personality.aggression * 2, apply: (w, c) => { c.stability.legitimacy += 8; c.stability.value -= 6; addModifier(w, c, { id: 'purge', label: 'Purged officials', months: 60, effects: { taxEfficiency: -0.05 } }); return 'The plotters are removed from office.'; } },
      { id: 'buy', label: 'Buy their loyalty', hint: 'Costs 4 months of income; legitimacy +10.', ai: (w, c) => (c.economy.treasury > gold(c, 4) ? 2 : 0.1), apply: (w, c) => { c.economy.treasury -= gold(c, 4); c.stability.legitimacy += 10; return 'Titles and gold change hands.'; } },
      { id: 'abdicate', label: 'The ruler abdicates', hint: 'The heir (if any) takes over; legitimacy resets to 55.', ai: () => 0.3, apply: (w, c) => { if (c.heir) { c.ruler = { ...c.heir, title: c.ruler.title }; c.heir = null; } c.stability.legitimacy = 55; return 'The ruler steps down.'; } },
    ],
  },
  {
    id: 'migration_wave', title: 'Wave of Migrants', category: 'society', cooldown: 120,
    probability: (w, c, st) => { const n = neighbours(w, st).get(c.id); if (!n) return 0; for (const o of n) { const oc = w.countries[o]; if (oc?.alive && (oc.food.shortage > 0.1 || oc.stability.value < 18)) return 0.02; } return 0; },
    setup: (w, c, st) => { const n = Array.from(neighbours(w, st).get(c.id) ?? []).filter((o) => w.countries[o]?.alive && (w.countries[o].food.shortage > 0.1 || w.countries[o].stability.value < 18)); return n.length ? { from: n[0], amount: Math.round(w.countries[n[0]].pop.total * 0.01) } : null; },
    body: (w, c, d) => `About ${fmtNum(Number(d.amount))} people fleeing hunger and disorder in ${w.countries[String(d.from)].name} arrive at the border.`,
    options: [
      { id: 'welcome', label: 'Welcome and settle them', hint: 'Population grows; food consumption rises; satisfaction −2.', ai: (w, c) => (c.food.shortage === 0 ? 2 : 0.2),
        apply: (w, c, d) => { const from = w.countries[String(d.from)]; const amt = Number(d.amount); const src = w.provinces.filter((p) => p.owner === from.id); const dst = w.provinces.filter((p) => p.owner === c.id); for (const p of src) p.pop -= amt / src.length; for (const p of dst) p.pop += amt / dst.length; c.pop.migration += amt; from.pop.migration -= amt; c.stability.satisfaction -= 2; return 'Newcomers settle across the realm.'; } },
      { id: 'close', label: 'Close the border', hint: 'Opinion of their government −15.', ai: () => 1, apply: (w, c, d) => { getRelation(w, c.id, String(d.from)).opinion -= 15; return 'Guards turn people away.'; } },
    ],
  },
];

// ---------------- Historical world events (fire only when conditions & dates fit) ----------------
interface WorldEvent { id: string; from: number; to: number; probability: number; apply: (w: World, st: MapStatic) => void }
const WORLD_EVENTS: WorldEvent[] = [
  {
    id: 'black_death', from: 1346, to: 1352, probability: 0.15,
    apply: (w) => {
      const cands = alive(w).filter((c) => ['centralasia', 'mena', 'europe', 'russia'].includes(w.provinces[c.capital]?.region ?? ''));
      for (const c of cands.slice(0, 6)) c.health.epidemic = { name: 'Black Death', severity: 0.9, monthsLeft: 30, origin: c.capital };
      addTimeline(w, 'historical', 'The Black Death', 'Historical pandemic (1346–1353) — in this timeline it arrives as conditions allow; its course depends on trade links, sanitation and quarantine.', cands.slice(0, 6).map((c) => c.id), 3, false);
    },
  },
];

function playerControlled(w: World, id: string): boolean { return id === w.player || Object.values(w.players).includes(id); }

export function fireEvent(w: World, def: EventDef, c: Country, st: MapStatic, data?: Data): void {
  const d: Data = data ?? (def.setup ? def.setup(w, c, st) ?? {} : {});
  if (def.setup && !data && Object.keys(d).length === 0) return;
  def.immediate?.(w, c, d, st);
  w.events.fired[`${def.id}|${c.id}`] = now(w);
  if (playerControlled(w, c.id)) {
    const pe: PendingEvent = { uid: uid(w, 'e'), eventId: def.id, country: c.id, date: { ...w.date }, title: def.title, body: def.body(w, c, d), options: def.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint })), data: d };
    w.events.pending.push(pe);
  } else {
    const opt = weightedPick(w, def.options.map((o) => ({ item: o, weight: o.ai(w, c, d) }))) ?? def.options[0];
    const result = opt.apply(w, c, d, st);
    log(w, `${c.name} — ${def.title}: ${opt.label}. ${result}`, 'event', c.id);
    c.ai.decisions.unshift({ date: { ...w.date }, kind: 'event', summary: `${def.title}: ${opt.label}`, reason: `Chosen by AI weighting (${opt.hint})` });
    if (c.ai.decisions.length > 20) c.ai.decisions.pop();
    if (def.timeline && c.pop.total > 1.5e7) addTimeline(w, def.category === 'disaster' || def.category === 'health' ? 'disaster' : 'event', `${def.title} in ${c.name}`, `${def.body(w, c, d)} Response: ${opt.label}.`, [c.id], 1);
  }
}

export function resolvePlayerEvent(w: World, uidStr: string, optionId: string, st: MapStatic): string {
  const idx = w.events.pending.findIndex((e) => e.uid === uidStr);
  if (idx < 0) return 'Event no longer pending.';
  const pe = w.events.pending[idx];
  const c = w.countries[pe.country];
  w.events.pending.splice(idx, 1);
  let result = '';
  const def = EVENT_DEFS.find((e) => e.id === pe.eventId);
  if (pe.eventId === 'succession_crisis') {
    result = resolveSuccessionChoice(w, c, optionId, st);
    const label = pe.options.find((o) => o.id === optionId)?.label ?? optionId;
    w.events.history.push({ eventId: pe.eventId, title: pe.title, choice: label, country: c.id, date: { ...w.date } });
    addTimeline(w, 'player', 'Succession crisis resolved', `${label}. ${result}`, [c.id], 2);
  } else if (def) {
    const opt = def.options.find((o) => o.id === optionId) ?? def.options[0];
    result = opt.apply(w, c, pe.data ?? {}, st);
    w.events.history.push({ eventId: pe.eventId, title: pe.title, choice: opt.label, country: c.id, date: { ...w.date } });
    if (def.timeline) addTimeline(w, 'player', `${pe.title}`, `${pe.body} Decision: ${opt.label}. ${result}`, [c.id], 2);
  } else {
    const custom = w.events.custom.find((e) => e.id === pe.eventId);
    if (custom) {
      const opt = custom.options.find((o) => o.id === optionId) ?? custom.options[0];
      result = applyCustomEffects(w, opt.effects, st);
      w.events.history.push({ eventId: pe.eventId, title: pe.title, choice: opt.label, country: c.id, date: { ...w.date } });
      addTimeline(w, 'event', pe.title, `${pe.body} Decision: ${opt.label}.`, [c.id], 2);
    } else {
      const sc = SCENARIO_HANDLERS.resolve?.(w, pe, optionId, st);
      result = sc ?? '';
    }
  }
  w.stats.eventsResolved++;
  log(w, `${pe.title}: ${result}`, 'event', c.id);
  return result;
}

// late-bound hook so scenario.ts can register scenario event resolution without a cycle
export const SCENARIO_HANDLERS: { resolve?: (w: World, pe: PendingEvent, option: string, st: MapStatic) => string } = {};

export function runEvents(w: World, st: MapStatic): void {
  const t = now(w);
  const freq = w.settings.eventsFrequency;
  for (const c of alive(w)) {
    if (c.tribal && c.id !== w.player) continue;
    for (const def of EVENT_DEFS) {
      const last = w.events.fired[`${def.id}|${c.id}`];
      if (last !== undefined && t - last < def.cooldown) continue;
      const p = def.probability(w, c, st) * freq;
      if (p > 0 && rand(w) < p) fireEvent(w, def, c, st);
    }
  }
  for (const we of WORLD_EVENTS) {
    if (w.date.y < we.from || w.date.y > we.to || w.events.scheduledDone.includes(we.id)) continue;
    if (w.startDate.y >= we.from) continue; // only when the timeline reaches it naturally
    if (chance(w, we.probability)) { w.events.scheduledDone.push(we.id); we.apply(w, st); }
  }
  runCustomEvents(w, st);
}

// ---------------- Custom (Scenario Editor) events ----------------
function resolveCountry(w: World, ref: string): Country | null {
  if (ref === 'player') return w.player ? w.countries[w.player] : null;
  if (w.countries[ref]) return w.countries[ref];
  return Object.values(w.countries).find((c) => c.name === ref) ?? null;
}
export function checkConditions(w: World, def: CustomEventDef): boolean {
  if (def.date && now(w) < def.date.y * 12 + def.date.m) return false;
  for (const cond of def.conditions) {
    const c = resolveCountry(w, cond.country);
    let v: number;
    switch (cond.stat) {
      case 'year': v = w.date.y; break;
      case 'stability': if (!c?.alive) return false; v = c.stability.value; break;
      case 'treasury': if (!c?.alive) return false; v = c.economy.treasury; break;
      case 'population': if (!c?.alive) return false; v = c.pop.total; break;
      case 'provinces': v = c ? w.provinces.filter((p) => p.owner === c.id).length : 0; break;
      case 'atWar': if (!c?.alive) return false; v = w.wars.some((x) => !x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id))) ? 1 : 0; break;
      case 'foodStock': if (!c?.alive) return false; v = c.food.stock / Math.max(1, c.food.consumption); break;
      case 'tech': if (!c?.alive) return false; v = techLevel(c.tech.known); break;
      case 'relation': { const o = cond.other ? resolveCountry(w, cond.other) : null; if (!c || !o) return false; v = getRelation(w, c.id, o.id).opinion; break; }
      default: return false;
    }
    if (cond.op === '<' && !(v < cond.value)) return false;
    if (cond.op === '>' && !(v > cond.value)) return false;
    if (cond.op === '=' && Math.round(v) !== Math.round(cond.value)) return false;
  }
  return true;
}
export function applyCustomEffects(w: World, effects: EventEffect[], st: MapStatic): string {
  const out: string[] = [];
  for (const e of effects) {
    const c = resolveCountry(w, e.country);
    if (!c?.alive) continue;
    const o = e.other ? resolveCountry(w, e.other) : null;
    switch (e.kind) {
      case 'treasury': c.economy.treasury += e.value; out.push(`${c.name} treasury ${e.value >= 0 ? '+' : ''}${fmtNum(e.value)}`); break;
      case 'stability': c.stability.value = clamp(c.stability.value + e.value, 0, 100); out.push(`${c.name} stability ${e.value >= 0 ? '+' : ''}${e.value}`); break;
      case 'population': for (const p of w.provinces) if (p.owner === c.id) p.pop *= 1 + e.value / 100; out.push(`${c.name} population ${e.value}%`); break;
      case 'foodStock': c.food.stock = Math.max(0, c.food.stock + c.food.consumption * e.value); out.push(`${c.name} food ${e.value} months`); break;
      case 'research': c.tech.points += e.value; out.push(`${c.name} research +${e.value}`); break;
      case 'manpower': c.military.regiments = Math.max(0, c.military.regiments + e.value); out.push(`${c.name} army ${e.value >= 0 ? '+' : ''}${e.value}k`); break;
      case 'opinion': if (o) { getRelation(w, c.id, o.id).opinion += e.value; out.push(`${c.name}–${o.name} opinion ${e.value}`); } break;
      case 'war': if (o) { declareWar(w, c.id, o.id, 'conquest', st); out.push(`${c.name} declares war on ${o.name}`); } break;
      case 'peace': if (o) { const war = w.wars.find((x) => !x.ended && ((x.attackers.includes(c.id) && x.defenders.includes(o.id)) || (x.attackers.includes(o.id) && x.defenders.includes(c.id)))); if (war) { endWar(w, war, 'white', `Peace between ${c.name} and ${o.name}.`); out.push('Peace signed'); } } break;
      case 'transferProvinces': if (o) { const ps = w.provinces.filter((p) => p.owner === c.id).sort((a, b) => b.pop - a.pop).slice(0, Math.max(1, Math.round(e.value))); for (const p of ps) transferProvince(w, p.id, o.id); out.push(`${ps.length} provinces → ${o.name}`); } break;
      case 'killRuler': c.ruler.health = 0; out.push(`${c.ruler.name} dies`); break;
    }
  }
  return out.join('; ');
}
function runCustomEvents(w: World, st: MapStatic): void {
  for (const def of w.events.custom) {
    if (def.once && w.events.scheduledDone.includes(def.id)) continue;
    if (!checkConditions(w, def)) continue;
    if (!chance(w, def.probability)) continue;
    w.events.scheduledDone.push(def.id);
    const target = resolveCountry(w, def.conditions[0]?.country ?? 'player') ?? (w.player ? w.countries[w.player] : null);
    if (target && playerControlled(w, target.id)) {
      w.events.pending.push({ uid: uid(w, 'e'), eventId: def.id, country: target.id, date: { ...w.date }, title: def.title, body: def.description, options: def.options.map((o) => ({ id: o.id, label: o.label, hint: o.effects.map((e) => `${e.kind} ${e.value}`).join(', ') })) });
    } else {
      const res = applyCustomEffects(w, def.options[0]?.effects ?? [], st);
      addTimeline(w, 'event', def.title, `${def.description} ${res}`, target ? [target.id] : [], 2);
    }
  }
}
