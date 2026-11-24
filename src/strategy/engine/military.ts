// Wars, battles, occupation and peace. Outcomes depend on troops, quality (technology),
// morale, supply & logistics (distance, roads, naval tech), terrain and fortifications.
import type { AcceptanceBreakdown, Country, CountryId, MapStatic, Province, War, World } from '../types/game';
import { addModifier, addTimeline, allies, clamp, distanceKm, getRelation, isAtWar, log, now, peekRelation, uid } from './util';
import { rand, randRange } from './rng';
import { techLevel } from '../data/technologies';
import { fmtDate } from './date';

export function provinceValue(p: Province): number { return 1 + p.pop / 2e5 + p.dev * 0.4; }

/** Land border or naval reach between two countries' controlled territory. */
export function canReach(w: World, a: CountryId, b: CountryId, st: MapStatic): boolean {
  const ca = w.countries[a];
  const naval = ca.tech.known.includes('navigation');
  for (const p of w.provinces) {
    if (p.controller !== a) continue;
    for (const j of st.adjacency[p.id] ?? []) if (w.provinces[j].controller === b) return true;
    if (p.coastal && p.port > 0) for (const j of st.seaLinks[p.id] ?? []) {
      const q = w.provinces[j];
      if (q.controller === b) return true;
      if (naval) for (const k of st.seaLinks[j] ?? []) if (w.provinces[k].controller === b) return true;
    }
  }
  return false;
}

const GENERIC = /^(empire|kingdom|kingdoms|sultanate|caliphate|khanate|dynasty|republic|emirate|emirates|union|minor|states|state|and|the|great|principality|tsardom|viceroyalty|confederation|chiefdoms|city-states|islamic|hindu|buddhist|united)$/i;
export function shortName(name: string): string {
  const of = name.match(/ of (?:the )?([^()]+)/);
  if (of) return of[1].trim().split(' ')[0];
  const words = name.replace(/\(.*?\)/g, '').split(/\s+/).filter((x) => x && !GENERIC.test(x));
  return words[0] ?? name;
}
export function warName(w: World, a: Country, d: Country, goal: War['goal']): string {
  if (goal === 'independence') return `${shortName(a.name)} War of Independence`;
  const n = w.wars.filter((x) => (x.attackers[0] === a.id && x.defenders[0] === d.id)).length;
  const ord = ['', 'Second ', 'Third ', 'Fourth ', 'Fifth '][Math.min(4, n)];
  return `${ord}${shortName(a.name)}–${shortName(d.name)} War`;
}

export function declareWar(w: World, attacker: CountryId, defender: CountryId, goal: War['goal'], st: MapStatic, opts: { silentAllies?: boolean } = {}): War | null {
  const a = w.countries[attacker], d = w.countries[defender];
  if (!a?.alive || !d?.alive || attacker === defender || isAtWar(w, attacker, defender)) return null;
  const rel = getRelation(w, attacker, defender);
  // breaking treaties has consequences
  if (rel.treaties.alliance) delete rel.treaties.alliance;
  if (rel.treaties.nap) {
    delete rel.treaties.nap;
    addModifier(w, a, { id: 'treaty_breaker', label: 'Broke a non-aggression pact', months: 120, effects: { legitimacy: -12, stability: -5 }, source: 'diplomacy' });
    for (const o of w.countryOrder) { const r = peekRelation(w, attacker, o); if (r && o !== defender) r.trust = clamp(r.trust - 15, 0, 100); }
  }
  delete rel.treaties.trade;
  const justified = goal === 'independence' || goal === 'liberation' || rel.opinion < -25 || w.provinces.some((p) => p.owner === defender && p.originalOwner === attacker);
  if (!justified) addModifier(w, a, { id: 'aggressor', label: 'Unjustified aggression', months: 60, effects: { stability: -8, legitimacy: -6 }, source: 'war' });
  rel.opinion = Math.min(rel.opinion, -100);
  rel.trust = 0;
  const targets = w.provinces.filter((p) => p.owner === defender).map((p) => p.id);
  const war: War = {
    id: uid(w, 'war'), name: warName(w, a, d, goal), attackers: [attacker], defenders: [defender], start: { ...w.date },
    goal, targetProvinces: targets, score: 0, battles: [], ended: null,
  };
  w.wars.push(war);
  // vassals and allies are called in
  for (const v of Object.values(w.countries)) if (v.alive && v.overlord === defender && v.id !== attacker) war.defenders.push(v.id);
  for (const v of Object.values(w.countries)) if (v.alive && v.overlord === attacker && v.id !== defender && goal !== 'independence') war.attackers.push(v.id);
  for (const ally of allies(w, defender)) {
    if (war.attackers.includes(ally) || war.defenders.includes(ally)) continue;
    const r = getRelation(w, ally, defender);
    if (r.trust >= 35 || ally === w.player) { war.defenders.push(ally); getRelation(w, ally, attacker).opinion -= 60; }
    else { delete r.treaties.alliance; r.trust = clamp(r.trust - 25, 0, 100); log(w, `${w.countries[ally].name} refuses the call to arms of ${d.name}; the alliance dissolves.`, 'diplomacy', ally); }
  }
  for (const ally of allies(w, attacker)) {
    if (war.attackers.includes(ally) || war.defenders.includes(ally)) continue;
    const r = getRelation(w, ally, attacker);
    const vsTarget = getRelation(w, ally, defender).opinion;
    if (r.trust >= 55 && vsTarget < 0) war.attackers.push(ally);
  }
  const text = `${a.name} declares war on ${d.name} (${goal}).${justified ? '' : ' The war is widely seen as unjustified.'} ${war.defenders.length > 1 ? `Joined by: ${war.defenders.slice(1).map((x) => w.countries[x].name).join(', ')}.` : ''}`;
  log(w, text, 'war', attacker);
  addTimeline(w, 'war', war.name, text, [...war.attackers, ...war.defenders], a.pop.total + d.pop.total > 1e7 || attacker === w.player || defender === w.player ? 3 : 2);
  if (!opts.silentAllies) void st;
  return war;
}

function committed(w: World, c: Country, war: War): number {
  const leader = war.attackers[0] === c.id || war.defenders[0] === c.id;
  const doctrine = c.military.doctrine === 'offensive' ? 1.1 : c.military.doctrine === 'defensive' ? 0.9 : 1;
  const otherWars = w.wars.filter((x) => !x.ended && x !== war && (x.attackers.includes(c.id) || x.defenders.includes(c.id))).length;
  return c.military.regiments * (leader ? 0.85 : 0.5) * doctrine / (1 + otherWars);
}

function logistics(w: World, c: Country, target: Province): { factor: number; dist: number } {
  const cap = w.provinces[c.capital] ?? target;
  const dist = distanceKm(cap.lon, cap.lat, target.lon, target.lat);
  const tl = techLevel(c.tech.known);
  let roads = 0, n = 0;
  for (const p of w.provinces) if (p.owner === c.id) { roads += p.roads; n++; }
  const reach = 1200 + (roads / Math.max(1, n)) * 350 + tl * 450 + (c.tech.known.includes('navigation') ? 1200 : 0) + (c.government === 'khaganate' ? 900 : 0);
  return { factor: clamp(1.15 - dist / reach, 0.22, 1.05), dist };
}

/** Pick a contested province: enemy-controlled, adjacent (or sea-linked) to territory controlled by `side`. */
function frontProvince(w: World, side: CountryId[], enemy: CountryId[], st: MapStatic): Province | null {
  const mine = new Set(side), theirs = new Set(enemy);
  const cands: Province[] = [];
  for (const p of w.provinces) {
    if (!p.controller || !theirs.has(p.controller)) continue;
    let ok = false;
    for (const j of st.adjacency[p.id] ?? []) { const c = w.provinces[j].controller; if (c && mine.has(c)) { ok = true; break; } }
    if (!ok && p.coastal) for (const j of st.seaLinks[p.id] ?? []) { const c = w.provinces[j].controller; if (c && mine.has(c) && w.provinces[j].port > 0) { ok = true; break; } }
    if (ok) cands.push(p);
  }
  if (!cands.length) return null;
  // prefer valuable, weakly defended targets and enemy capitals
  cands.sort((a, b) => provinceValue(b) / (1 + b.fort) - provinceValue(a) / (1 + a.fort));
  const top = cands.slice(0, Math.min(5, cands.length));
  return top[Math.floor(rand(w) * top.length)];
}

export function resolveWars(w: World, st: MapStatic): void {
  for (const war of w.wars) {
    if (war.ended) continue;
    war.attackers = war.attackers.filter((id) => w.countries[id]?.alive);
    war.defenders = war.defenders.filter((id) => w.countries[id]?.alive);
    if (!war.attackers.length || !war.defenders.length) { endWar(w, war, 'white', 'One side ceased to exist.'); continue; }
    // each month one or two engagements happen, alternating initiative by relative strength
    const engagements = 1 + (rand(w) < 0.35 ? 1 : 0);
    for (let e = 0; e < engagements; e++) battle(w, war, st);
    updateScore(w, war);
    for (const id of [...war.attackers, ...war.defenders]) {
      const c = w.countries[id];
      c.stability.warExhaustion = clamp(c.stability.warExhaustion + 0.3, 0, 100);
    }
  }
  w.wars = w.wars.filter((x) => !x.ended || now(w) - (x.ended.y * 12 + x.ended.m) < 1200);
}

function sideStrength(w: World, ids: CountryId[], war: War, target: Province, defending: boolean): { s: number; factors: string[] } {
  let s = 0;
  const factors: string[] = [];
  for (const id of ids) {
    const c = w.countries[id];
    const troops = committed(w, c, war);
    const log_ = logistics(w, c, target);
    let v = troops * c.military.quality * (0.5 + c.military.morale) * (0.55 + 0.45 * c.military.supply) * log_.factor * (1 + c.ruler.skill.military * 0.03);
    if (defending && target.owner === id) {
      const terr = (target.mountain ? 1.35 : 1) * (target.river ? 1.12 : 1) * (1 + target.fort * 0.12);
      v *= terr * 1.1;
      if (terr > 1.2) factors.push(`${c.name}: terrain & forts ×${terr.toFixed(2)}`);
    }
    if (!defending && target.desert && c.government !== 'khaganate') v *= 0.8;
    if (log_.factor < 0.6) factors.push(`${c.name}: overstretched supply (${Math.round(log_.dist)} km from capital, ×${log_.factor.toFixed(2)})`);
    s += v;
  }
  return { s, factors };
}

function battle(w: World, war: War, st: MapStatic): void {
  // the side with more effective power tends to hold the initiative
  const powA = war.attackers.reduce((s, id) => s + committed(w, w.countries[id], war) * w.countries[id].military.quality, 0);
  const powD = war.defenders.reduce((s, id) => s + committed(w, w.countries[id], war) * w.countries[id].military.quality, 0);
  const attackersMove = rand(w) < clamp(powA / Math.max(1e-6, powA + powD) + 0.1, 0.15, 0.9);
  const mover = attackersMove ? war.attackers : war.defenders;
  const other = attackersMove ? war.defenders : war.attackers;
  const target = frontProvince(w, mover, other, st);
  if (!target) return;
  const off = sideStrength(w, mover, war, target, false);
  const def = sideStrength(w, other, war, target, true);
  const sa = off.s * randRange(w, 0.8, 1.2), sd = def.s * randRange(w, 0.8, 1.2);
  if (sa + sd <= 0) return;
  const ratio = sa / Math.max(1e-6, sd);
  const moverWins = ratio > 1;
  const scale = Math.min(1, (sa + sd) / 200);
  const loserLoss = 0.05 + Math.min(0.1, Math.abs(Math.log(ratio)) * 0.05);
  const winnerLoss = 0.025 + rand(w) * 0.025;
  const applyLoss = (ids: CountryId[], frac: number) => {
    let total = 0;
    for (const id of ids) {
      const c = w.countries[id];
      const loss = committed(w, c, war) * frac * scale;
      c.military.regiments = Math.max(0, c.military.regiments - loss);
      c.military.losses += loss;
      c.military.morale = clamp(c.military.morale + (frac > 0.05 ? -0.08 : 0.02), 0.05, 1);
      c.pop.warDeaths += loss * 1000 * 0.6;
      c.stability.warExhaustion = clamp(c.stability.warExhaustion + frac * 20, 0, 100);
      total += loss;
    }
    return total;
  };
  const lossMover = applyLoss(mover, moverWins ? winnerLoss : loserLoss);
  const lossOther = applyLoss(other, moverWins ? loserLoss : winnerLoss);
  const winner = moverWins ? mover[0] : other[0];
  const factors = [...off.factors, ...def.factors, `Effective strength ${sa.toFixed(0)} vs ${sd.toFixed(0)}`];
  war.battles.push({ date: { ...w.date }, province: target.id, attacker: mover[0], defender: other[0], winner, aLoss: Math.round(lossMover * 1000), dLoss: Math.round(lossOther * 1000), factors });
  if (war.battles.length > 60) war.battles.shift();
  w.stats.battles++;
  if (moverWins) {
    target.siege = clamp(target.siege + (0.4 * Math.min(3, ratio)) / (1 + target.fort * 0.45), 0, 1);
    if (target.siege >= 1) {
      // occupation: returns to owner if a co-belligerent of the owner liberates it
      const occupier = mover.includes(target.owner!) ? target.owner! : mover[0];
      target.controller = occupier;
      target.siege = 0;
      const txt = `${w.countries[occupier].name} takes ${target.name}.`;
      log(w, txt, 'war', occupier);
      if (w.player && (mover.includes(w.player) || other.includes(w.player))) addTimeline(w, 'war', `Fall of ${target.name}`, `${txt} (${war.name})`, [occupier, other[0]], 1);
    }
  } else target.siege = Math.max(0, target.siege - 0.3);
  if (w.player && [...mover, ...other].includes(w.player) && Math.max(lossMover, lossOther) > 3) {
    log(w, `Battle of ${target.name}: ${w.countries[winner].name} victorious (${Math.round(lossMover)}k vs ${Math.round(lossOther)}k losses).`, 'battle', winner);
  }
}

function updateScore(w: World, war: War): void {
  const atk = new Set(war.attackers), dfn = new Set(war.defenders);
  let defVal = 0, occByA = 0, atkVal = 0, occByD = 0;
  for (const p of w.provinces) {
    if (p.owner && dfn.has(p.owner)) { defVal += provinceValue(p); if (p.controller && atk.has(p.controller)) occByA += provinceValue(p); }
    if (p.owner && atk.has(p.owner)) { atkVal += provinceValue(p); if (p.controller && dfn.has(p.controller)) occByD += provinceValue(p); }
  }
  let battleBal = 0;
  for (const b of war.battles.slice(-20)) battleBal += atk.has(b.winner) ? 2 : -2;
  let score = (occByA / Math.max(1, defVal)) * 130 - (occByD / Math.max(1, atkVal)) * 130 + clamp(battleBal, -25, 25);
  const dLead = w.countries[war.defenders[0]], aLead = w.countries[war.attackers[0]];
  if (w.provinces[dLead.capital]?.controller && atk.has(w.provinces[dLead.capital].controller!)) score += 15;
  if (w.provinces[aLead.capital]?.controller && dfn.has(w.provinces[aLead.capital].controller!)) score -= 15;
  if (dLead.military.regiments < 1 && occByA > 0) score += 20;
  if (aLead.military.regiments < 1 && occByD > 0) score -= 20;
  war.score = clamp(score, -100, 100);
}

export interface PeaceTerms { type: 'white' | 'conquest' | 'vassalize' | 'independence'; provinces: number[] }

/** Provinces the winning side could annex given the current score. */
export function demandableProvinces(w: World, war: War, forAttackers: boolean): number[] {
  const winners = new Set(forAttackers ? war.attackers : war.defenders);
  const losers = new Set(forAttackers ? war.defenders : war.attackers);
  const score = forAttackers ? war.score : -war.score;
  let loserVal = 0;
  const occupied: Province[] = [];
  for (const p of w.provinces) if (p.owner && losers.has(p.owner)) { loserVal += provinceValue(p); if (p.controller && winners.has(p.controller)) occupied.push(p); }
  occupied.sort((a, b) => provinceValue(b) - provinceValue(a));
  const budget = (Math.max(0, score) / 100) * loserVal;
  const out: number[] = [];
  let used = 0;
  for (const p of occupied) { if (used + provinceValue(p) > budget * 1.05) continue; used += provinceValue(p); out.push(p.id); }
  return out;
}

export function evaluatePeace(w: World, war: War, proposerIsAttacker: boolean, terms: PeaceTerms): AcceptanceBreakdown {
  const receiver = w.countries[proposerIsAttacker ? war.defenders[0] : war.attackers[0]];
  const scoreForProposer = proposerIsAttacker ? war.score : -war.score;
  const factors: { label: string; value: number }[] = [];
  factors.push({ label: 'War score', value: Math.round(scoreForProposer) });
  factors.push({ label: 'War exhaustion', value: Math.round(receiver.stability.warExhaustion * 0.4) });
  const months = now(w) - (war.start.y * 12 + war.start.m);
  factors.push({ label: 'War duration', value: Math.min(20, Math.round(months / 6)) });
  if (receiver.military.regiments < receiver.military.maxManpower * 0.05) factors.push({ label: 'Army destroyed', value: 25 });
  let threshold = 0;
  if (terms.type === 'white') threshold = 0;
  else if (terms.type === 'conquest') {
    let val = 0, total = 0;
    for (const p of w.provinces) if (p.owner === receiver.id) total += provinceValue(p);
    for (const id of terms.provinces) val += provinceValue(w.provinces[id]);
    threshold = 10 + (val / Math.max(1, total)) * 100;
    factors.push({ label: 'Territory demanded', value: -Math.round((val / Math.max(1, total)) * 100) });
  } else if (terms.type === 'vassalize') threshold = 70;
  else if (terms.type === 'independence') threshold = 45;
  if (receiver.id === w.player) threshold += 0; // player decides themselves
  const total = factors.reduce((s, f) => s + f.value, 0);
  return { total, threshold: Math.round(threshold), factors };
}

export function transferProvince(w: World, pid: number, to: CountryId): void {
  const p = w.provinces[pid];
  const from = p.owner;
  p.owner = to; p.controller = to; p.siege = 0; p.unrest = Math.max(p.unrest, 35);
  if (from) checkCollapse(w, from, `lost its last territory to ${w.countries[to]?.name ?? 'rivals'}`);
}

export function checkCollapse(w: World, id: CountryId, reason: string): void {
  const c = w.countries[id];
  if (!c?.alive) return;
  if (w.provinces.some((p) => p.owner === id)) return;
  c.alive = false;
  c.collapsed = { ...w.date };
  for (const v of Object.values(w.countries)) if (v.overlord === id) v.overlord = null;
  for (const war of w.wars) if (!war.ended && (war.attackers.includes(id) || war.defenders.includes(id))) {
    war.attackers = war.attackers.filter((x) => x !== id); war.defenders = war.defenders.filter((x) => x !== id);
  }
  log(w, `${c.name} has ceased to exist: ${reason}.`, 'collapse', id);
  addTimeline(w, 'collapse', `Collapse of ${c.name}`, `${c.name} ${reason}. It existed in this timeline from ${fmtDate(c.founded)} to ${fmtDate(w.date)}.`, [id], c.pop.total > 5e6 || id === w.player ? 3 : 2);
}

export function endWar(w: World, war: War, type: PeaceTerms['type'] | 'white', summary: string, terms?: PeaceTerms, winnerIsAttacker = true): void {
  const winners = winnerIsAttacker ? war.attackers : war.defenders;
  const losers = winnerIsAttacker ? war.defenders : war.attackers;
  const parts = [...war.attackers, ...war.defenders];
  if (terms?.type === 'conquest') for (const pid of terms.provinces) if (w.provinces[pid].owner && losers.includes(w.provinces[pid].owner!)) transferProvince(w, pid, winners[0]);
  if (terms?.type === 'vassalize' && w.countries[losers[0]]?.alive) w.countries[losers[0]].overlord = winners[0];
  if (terms?.type === 'independence') {
    const rebel = w.countries[war.attackers[0]];
    if (winnerIsAttacker && rebel?.alive) rebel.overlord = null;
  }
  // restore occupation
  const partSet = new Set(parts);
  for (const p of w.provinces) if (p.owner && partSet.has(p.owner) && p.controller !== p.owner) { p.controller = p.owner; p.siege = 0; }
  for (const a of war.attackers) for (const d of war.defenders) {
    const r = getRelation(w, a, d);
    r.truceUntil = now(w) + 60;
    r.opinion = Math.max(-200, r.opinion - 20);
  }
  war.ended = { ...w.date };
  war.result = summary;
  if (type !== 'white') for (const id of winners) { const c = w.countries[id]; if (c?.alive) addModifier(w, c, { id: 'victory', label: 'Recent victory', months: 36, effects: { legitimacy: 6, stability: 4 }, source: 'war' }); }
  for (const id of losers) { const c = w.countries[id]; if (c?.alive && type !== 'white') addModifier(w, c, { id: 'defeat', label: 'Humiliating defeat', months: 60, effects: { legitimacy: -10, stability: -6 }, source: 'war' }); }
  log(w, `Peace: ${war.name} ends. ${summary}`, 'peace', winners[0]);
  addTimeline(w, 'peace', `End of the ${war.name}`, summary, parts, parts.includes(w.player ?? '') ? 3 : 2);
  for (const id of parts) checkCollapse(w, id, 'was dismantled at the peace table');
}

/** AI-side war termination; player-involved wars generate offers instead of auto-peace. */
export function aiPeace(w: World): void {
  for (const war of w.wars) {
    if (war.ended) continue;
    const aLead = war.attackers[0], dLead = war.defenders[0];
    const months = now(w) - (war.start.y * 12 + war.start.m);
    const playerInvolved = w.player && (aLead === w.player || dLead === w.player);
    const attackersWinning = war.score > 0;
    const winnerLead = attackersWinning ? aLead : dLead;
    const loserLead = attackersWinning ? dLead : aLead;
    if (winnerLead === w.player) continue; // the player decides when to demand peace
    const mag = Math.abs(war.score);
    const loser = w.countries[loserLead], winner = w.countries[winnerLead];
    const wantsPeace = mag >= 55 || (months > 30 && mag >= 25) || months > 84 || winner.stability.warExhaustion > 70;
    if (!wantsPeace) continue;
    let terms: PeaceTerms;
    if (war.goal === 'independence') terms = attackersWinning ? { type: 'independence', provinces: [] } : { type: 'conquest', provinces: w.provinces.filter((p) => p.owner === aLead).map((p) => p.id) };
    else if (mag < 15) terms = { type: 'white', provinces: [] };
    else if (war.goal === 'subjugation' && mag >= 70 && attackersWinning) terms = { type: 'vassalize', provinces: [] };
    else terms = { type: 'conquest', provinces: demandableProvinces(w, war, attackersWinning) };
    if (terms.type === 'conquest' && !terms.provinces.length) terms = { type: 'white', provinces: [] };
    if (playerInvolved && loserLead === w.player) {
      if (!w.offers.some((o) => o.kind === 'peace' && o.terms?.warId === war.id)) {
        w.offers.push({ uid: uid(w, 'o'), from: winnerLead, to: w.player!, kind: 'peace', date: { ...w.date }, terms: { warId: war.id, provinces: terms.provinces, type: terms.type }, reason: `${winner.name} offers peace (${terms.type}${terms.provinces.length ? `, ${terms.provinces.length} provinces` : ''}). War score ${Math.round(war.score)}.` });
      }
      continue;
    }
    const desc = describeTerms(w, terms, winner, loser);
    endWar(w, war, terms.type, desc, terms, attackersWinning);
  }
}

export function describeTerms(w: World, t: PeaceTerms, winner: Country, loser: Country): string {
  switch (t.type) {
    case 'white': return `White peace between ${winner.name} and ${loser.name}; pre-war borders restored.`;
    case 'conquest': return `${loser.name} cedes ${t.provinces.length} province${t.provinces.length === 1 ? '' : 's'} (${t.provinces.slice(0, 4).map((p) => w.provinces[p].name).join(', ')}${t.provinces.length > 4 ? '…' : ''}) to ${winner.name}.`;
    case 'vassalize': return `${loser.name} becomes a vassal of ${winner.name}.`;
    case 'independence': return `${winner.name} wins independence from ${loser.name}.`;
  }
}
