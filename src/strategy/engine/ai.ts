// AI decision engine. Each AI country "thinks" every few months, derives goals from its
// situation, and takes economic, military and diplomatic actions. Every action is logged
// with the reason that produced it so players (and the AI Historian) can explain behaviour.
import type { Country, CountryId, DiploAction, MapStatic, World } from '../types/game';
import { addTimeline, allies, clamp, getRelation, isAtWar, log, militaryPower, now, peekRelation, uid, warsOf } from './util';
import { chance, rand } from './rng';
import { techLevel } from '../data/technologies';
import { neighbours } from './cache';
import { canReach, declareWar } from './military';
import { evaluateProposal, recordTreaty, setTreaty, threatOf } from './diplomacy';
import { computeCalc } from './systems';

function decide(w: World, c: Country, kind: string, summary: string, reason: string): void {
  c.ai.decisions.unshift({ date: { ...w.date }, kind, summary, reason });
  if (c.ai.decisions.length > 20) c.ai.decisions.pop();
}

function sidePower(w: World, id: CountryId): number {
  let p = militaryPower(w.countries[id]);
  for (const a of allies(w, id)) p += militaryPower(w.countries[a]) * 0.5;
  for (const v of Object.values(w.countries)) if (v.alive && v.overlord === id) p += militaryPower(v) * 0.6;
  return p;
}

export function runAI(w: World, st: MapStatic): void {
  const t = now(w);
  for (const id of w.countryOrder) {
    const c = w.countries[id];
    if (!c?.alive || id === w.player || Object.values(w.players).includes(id)) continue;
    if (c.ai.nextThink > t) continue;
    c.ai.nextThink = t + (c.tribal ? 12 : 3 + Math.floor(rand(w) * 3));
    think(w, c, st);
  }
}

function think(w: World, c: Country, st: MapStatic): void {
  const calc = computeCalc(w, c);
  const p = c.ai.personality;
  const wars = warsOf(w, c.id);
  const neigh = Array.from(neighbours(w, st).get(c.id) ?? []).filter((x) => w.countries[x]?.alive);
  let topThreat: { id: CountryId; v: number } | null = null;
  for (const n of neigh) { const v = threatOf(w, c, w.countries[n]); if (!topThreat || v > topThreat.v) topThreat = { id: n, v }; }

  // ---- goals ----
  const goals: string[] = [];
  if (c.food.shortage > 0 || c.food.production < c.food.consumption) goals.push('feed the population');
  if (c.stability.value < 40) goals.push('restore order');
  if (c.economy.debt > c.economy.income * 12) goals.push('reduce debt');
  if (wars.length) goals.push('win the war');
  else if (topThreat && topThreat.v > 45) goals.push(`deter ${w.countries[topThreat.id].name}`);
  if (!wars.length && p.expansion > 0.55 && c.stability.value > 50) goals.push('expand');
  if (!goals.length) goals.push('develop the economy');
  c.ai.goals = goals;
  if (c.tribal) return; // tribal societies are modelled as passive polities

  // ---- budget & taxes ----
  const b = { military: 0.18 + p.aggression * 0.2, infrastructure: 0.12 + p.economy * 0.08, research: 0.08 + p.economy * 0.06, health: 0.08, agriculture: 0.12, administration: 0.14 };
  if (goals.includes('feed the population')) b.agriculture += 0.15;
  if (c.health.epidemic) b.health += 0.1;
  if (wars.length || (topThreat && topThreat.v > 45)) b.military += 0.2;
  if (c.stability.value < 40) b.administration += 0.1;
  c.economy.budget = b;
  const prevTax = c.economy.taxRate;
  const maxTax = techLevel(c.tech.known) >= 4.5 ? 0.45 : 0.3;
  if (c.stability.value < 35) c.economy.taxRate = Math.max(0.05, c.economy.taxRate - 0.02);
  else if (c.economy.lastBalance < 0 && c.stability.value > 55) c.economy.taxRate = Math.min(maxTax, c.economy.taxRate + 0.01);
  else if (c.economy.treasury > c.economy.income * 24 && c.stability.value < 60) c.economy.taxRate = Math.max(0.05, c.economy.taxRate - 0.01);
  c.economy.spendingRate = goals.includes('reduce debt') ? 0.75 : c.economy.treasury > c.economy.income * 18 ? 1.05 : 0.9;
  if (Math.abs(prevTax - c.economy.taxRate) > 0.005) decide(w, c, 'economy', `Tax rate ${Math.round(prevTax * 100)}% → ${Math.round(c.economy.taxRate * 100)}%`, c.economy.taxRate < prevTax ? `Stability ${Math.round(c.stability.value)} is low` : `Budget deficit of ${Math.round(-c.economy.lastBalance)} per month`);

  // ---- army size ----
  const threatLvl = topThreat ? topThreat.v : 0;
  const desired = (c.pop.total / 1000) * (0.004 + p.aggression * 0.005 + threatLvl * 0.00005) * (wars.length ? 1.6 : 1);
  const recruitCost = 2 * (1 + calc.tl * 0.3);
  if (c.military.regiments < desired * 0.9 && c.military.manpower > 1) {
    const amount = Math.min(desired - c.military.regiments, c.military.manpower * 0.5, c.economy.treasury / recruitCost);
    if (amount > 0.5) {
      c.military.regiments += amount; c.military.manpower -= amount; c.economy.treasury -= amount * recruitCost;
      decide(w, c, 'military', `Recruited ${amount.toFixed(1)}k soldiers`, wars.length ? 'At war' : topThreat ? `Threat from ${w.countries[topThreat.id].name} (${Math.round(threatLvl)})` : 'Army below target');
    }
  } else if (c.military.regiments > desired * 1.4 && !wars.length && c.economy.lastBalance < 0) {
    const cut = (c.military.regiments - desired) * 0.3;
    c.military.regiments -= cut; c.military.manpower += cut * 0.8;
    decide(w, c, 'military', `Demobilised ${cut.toFixed(1)}k soldiers`, 'Army exceeds needs while the budget is in deficit');
  }

  // ---- construction ----
  if (c.economy.treasury > c.economy.income * 10) {
    const provs = w.provinces.filter((x) => x.owner === c.id && x.controller === c.id);
    const key: 'farms' | 'market' | 'fort' | 'roads' = goals.includes('feed the population') ? 'farms' : threatLvl > 50 ? 'fort' : p.economy > 0.5 ? 'market' : 'roads';
    const cand = provs.filter((x) => x[key] < 5).sort((a, b) => b.pop - a.pop)[0];
    if (cand) {
      const cost = buildCost(w, c, cand[key]);
      if (c.economy.treasury > cost * 2) {
        c.economy.treasury -= cost; cand[key]++;
        decide(w, c, 'build', `Built ${key} (level ${cand[key]}) in ${cand.name}`, key === 'farms' ? 'Food deficit' : key === 'fort' ? 'Border threat' : 'Economic development');
      }
    }
  }

  // ---- diplomacy ----
  diplomacy(w, c, st, neigh, topThreat);

  // ---- war ----
  if (!wars.length) considerWar(w, c, st, neigh);
  // vassals seek freedom when strong and resentful
  if (c.overlord) {
    const ov = w.countries[c.overlord];
    const r = getRelation(w, c.id, ov.id);
    if (ov?.alive && militaryPower(c) > sidePower(w, ov.id) * 0.7 && r.opinion < 0 && chance(w, 0.2)) {
      decide(w, c, 'war', `Declared independence from ${ov.name}`, `Own strength ${militaryPower(c).toFixed(0)} vs overlord ${sidePower(w, ov.id).toFixed(0)}; opinion ${Math.round(r.opinion)}`);
      c.overlord = null;
      declareWar(w, c.id, ov.id, 'independence', st);
    }
  }
}

export function buildCost(w: World, c: Country, level: number): number {
  return Math.max(10, (c.economy.gdp / 12) * 0.08 * (1 + level * 0.6));
}

function propose(w: World, c: Country, target: Country, action: DiploAction, st: MapStatic, reason: string): boolean {
  if (target.id === w.player || Object.values(w.players).includes(target.id)) {
    if (w.offers.some((o) => o.from === c.id && o.to === target.id)) return false;
    const kind = action === 'trade' ? 'trade' : action === 'nap' ? 'nap' : 'alliance';
    w.offers.push({ uid: uid(w, 'o'), from: c.id, to: target.id, kind, date: { ...w.date }, reason: `${c.name} proposes a ${kind === 'nap' ? 'non-aggression pact' : kind === 'trade' ? 'trade agreement' : 'defensive alliance'}: ${reason}` });
    decide(w, c, 'diplomacy', `Proposed ${kind} to ${target.name}`, reason);
    return false;
  }
  const ev = evaluateProposal(w, c, target, action, st);
  const ok = ev.total >= ev.threshold;
  if (ok) {
    const t = action === 'alliance' ? 'alliance' : action === 'trade' ? 'trade' : 'nap';
    setTreaty(w, c.id, target.id, t, true);
    recordTreaty(w, c, target, t);
    decide(w, c, 'diplomacy', `${t} with ${target.name}`, `${reason} (acceptance ${ev.total} ≥ ${ev.threshold})`);
  }
  return ok;
}

function diplomacy(w: World, c: Country, st: MapStatic, neigh: CountryId[], topThreat: { id: CountryId; v: number } | null): void {
  const p = c.ai.personality;
  // alliances against the main threat
  if (topThreat && topThreat.v > 40 && allies(w, c.id).length < 3 && chance(w, 0.3 + p.diplomacy * 0.4)) {
    const threat = w.countries[topThreat.id];
    const cands = Object.values(w.countries).filter((o) => o.alive && !o.tribal && o.id !== c.id && o.id !== threat.id && !peekRelation(w, c.id, o.id)?.treaties.alliance && (peekRelation(w, o.id, threat.id)?.opinion ?? 0) < -20);
    cands.sort((a, b) => militaryPower(b) - militaryPower(a));
    for (const o of cands.slice(0, 3)) if (propose(w, c, o, 'alliance', st, `Common threat: ${threat.name}`)) break;
  }
  // trade with friendly neighbours
  if (chance(w, 0.25 + p.economy * 0.3)) {
    const cands = neigh.map((x) => w.countries[x]).filter((o) => !o.tribal && !isAtWar(w, c.id, o.id) && !peekRelation(w, c.id, o.id)?.treaties.trade && (peekRelation(w, c.id, o.id)?.opinion ?? 0) > -10);
    if (cands.length) propose(w, c, cands[Math.floor(rand(w) * cands.length)], 'trade', st, 'Mutual commercial benefit');
  }
  // non-aggression with a dangerous neighbour
  if (topThreat && topThreat.v > 55 && chance(w, p.diplomacy * 0.4)) {
    const t = w.countries[topThreat.id];
    if (!peekRelation(w, c.id, t.id)?.treaties.nap && !isAtWar(w, c.id, t.id)) propose(w, c, t, 'nap', st, `Avoid war with stronger ${t.name}`);
  }
  // improve relations
  if (topThreat && p.diplomacy > 0.55 && chance(w, 0.3)) {
    const r = getRelation(w, c.id, topThreat.id);
    r.opinion = clamp(r.opinion + 8, -200, 200);
  }
}

function considerWar(w: World, c: Country, st: MapStatic, neigh: CountryId[]): void {
  const p = c.ai.personality;
  if (c.stability.value < 45 || c.stability.warExhaustion > 20 || c.military.regiments < 1) return;
  const appetite = p.aggression * p.expansion * w.settings.aiAggression;
  if (!chance(w, appetite * 0.06)) return;
  const myPower = sidePower(w, c.id);
  let best: { id: CountryId; score: number; why: string } | null = null;
  for (const n of neigh) {
    const t = w.countries[n];
    if (!t?.alive || t.overlord === c.id || c.overlord === t.id) continue;
    if (t.modifiers.some((m) => m.id === 'newly_founded' && m.until > now(w))) continue;
    const r = getRelation(w, c.id, n);
    if (r.treaties.alliance || r.treaties.nap || r.truceUntil > now(w) || isAtWar(w, c.id, n)) continue;
    if (!canReach(w, c.id, n, st)) continue;
    const theirPower = sidePower(w, n);
    const ratio = myPower / Math.max(1, theirPower);
    if (ratio < 1.8) continue;
    if (r.opinion > 20) continue;
    const humanTarget = n === w.player || Object.values(w.players).includes(n);
    let score = ratio * 10 - r.opinion * 0.1 + Math.log10(Math.max(10, t.pop.total)) * 2 + (t.tribal ? 6 : 0) - (humanTarget && w.settings.difficulty === 'story' ? 25 : 0);
    if (w.provinces.some((p2) => p2.owner === n && p2.originalOwner === c.id)) score += 12;
    if (!best || score > best.score) best = { id: n, score, why: `${ratio.toFixed(1)}× stronger (incl. allies), opinion ${Math.round(r.opinion)}${t.tribal ? ', weakly organised target' : ''}` };
  }
  if (!best) return;
  const target = w.countries[best.id];
  const goal = target.military.regiments < c.military.regiments * 0.15 && !target.tribal && chance(w, 0.3) ? 'subjugation' : 'conquest';
  decide(w, c, 'war', `Declared war on ${target.name} (${goal})`, best.why);
  const war = declareWar(w, c.id, target.id, goal, st);
  if (war && (c.pop.total > 2e7 || target.id === w.player)) addTimeline(w, 'war', `AI decision: ${c.name} attacks`, `${c.name}'s government chose war: ${best.why}.`, [c.id, target.id], 1);
  log(w, `${c.name}'s war council: ${best.why}.`, 'ai', c.id);
}
