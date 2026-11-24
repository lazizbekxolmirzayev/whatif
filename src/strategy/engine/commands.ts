// Player commands: the ONLY way players change the world. The same validation runs in the
// browser (single-player / hot-seat) and in the server-authoritative multiplayer function.
import type { BuildingKind, Command, CommandResult, Country, MapStatic, World } from '../types/game';
import { TECH_BY_ID, techAvailable, techLevel } from '../data/technologies';
import { GOVERNMENTS, eraForYear, eraIndex } from '../data/eras';
import { addModifier, addTimeline, clamp, fmtNum, getRelation, isAtWar, log, now } from './util';
import { canReach, declareWar, demandableProvinces, describeTerms, endWar, evaluatePeace, PeaceTerms } from './military';
import { evaluateProposal, recordTreaty, setTreaty } from './diplomacy';
import { buildCost } from './ai';
import { resolvePlayerEvent } from './events';
import { invalidate } from './cache';

export function maxBuildingLevel(c: Country, kind: BuildingKind): number {
  const tl = techLevel(c.tech.known);
  let m = Math.min(5, 1 + Math.floor(tl) + (tl >= 3 ? 1 : 0));
  if (kind === 'fort') m = c.tech.known.includes('castles') ? 5 : c.tech.known.includes('masonry') ? 3 : 1;
  if (kind === 'roads') m = c.tech.known.includes('railways') ? 5 : c.tech.known.includes('roads_network') ? 3 : 2;
  if (kind === 'port') m = c.tech.known.includes('navigation') ? 5 : 3;
  return m;
}
export const recruitCost = (c: Country): number => 2 * (1 + techLevel(c.tech.known) * 0.3);
export const improveCost = (c: Country): number => Math.max(10, c.economy.income * 1.5);
export const colonizeCost = (c: Country): number => Math.max(30, c.economy.income * 6);

const ok = (message: string): CommandResult => ({ ok: true, message });
const fail = (message: string): CommandResult => ({ ok: false, message });

export function applyCommand(w: World, cmd: Command, st: MapStatic): CommandResult {
  const c = w.countries[cmd.country];
  if (!c?.alive) return fail('Your country no longer exists.');
  switch (cmd.type) {
    case 'setTax': {
      if (!Number.isFinite(cmd.rate)) return fail('Invalid rate.');
      c.economy.taxRate = clamp(cmd.rate, 0, 0.6);
      return ok(`Tax rate set to ${Math.round(c.economy.taxRate * 100)}%.`);
    }
    case 'setBudget': {
      const vals = Object.values(cmd.budget);
      if (vals.some((v) => !Number.isFinite(v) || v < 0)) return fail('Invalid budget.');
      const sum = vals.reduce((a, b) => a + b, 0) || 1;
      c.economy.budget = { military: cmd.budget.military / sum, infrastructure: cmd.budget.infrastructure / sum, research: cmd.budget.research / sum, health: cmd.budget.health / sum, agriculture: cmd.budget.agriculture / sum, administration: cmd.budget.administration / sum };
      c.economy.spendingRate = clamp(cmd.spendingRate, 0.3, 1.5);
      return ok('Budget updated.');
    }
    case 'build': {
      const p = w.provinces[cmd.province];
      if (!p || p.owner !== c.id) return fail('You do not own this province.');
      if (p.controller !== c.id) return fail('The province is occupied.');
      if (cmd.building === 'port' && !p.coastal) return fail('Ports require a coastline.');
      const max = maxBuildingLevel(c, cmd.building);
      if (p[cmd.building] >= max) return fail(`Maximum level ${max} reached for your technology.`);
      const cost = buildCost(w, c, p[cmd.building]);
      if (c.economy.treasury < cost) return fail(`Not enough gold (need ${fmtNum(cost)}).`);
      c.economy.treasury -= cost;
      p[cmd.building]++;
      return ok(`${cmd.building} in ${p.name} upgraded to level ${p[cmd.building]} for ${fmtNum(cost)} gold.`);
    }
    case 'research': {
      if (!TECH_BY_ID[cmd.tech]) return fail('Unknown technology.');
      if (!techAvailable(c.tech.known, cmd.tech)) return fail('Prerequisites missing or already known.');
      c.tech.researching = cmd.tech;
      return ok(`Researching ${TECH_BY_ID[cmd.tech].name}.`);
    }
    case 'recruit': {
      const amt = Math.max(0, cmd.amount);
      if (amt > c.military.manpower) return fail(`Only ${c.military.manpower.toFixed(1)}k manpower available.`);
      const cost = amt * recruitCost(c);
      if (cost > c.economy.treasury) return fail(`Recruiting costs ${fmtNum(cost)} gold.`);
      c.military.regiments += amt; c.military.manpower -= amt; c.economy.treasury -= cost;
      c.military.morale = clamp(c.military.morale - 0.02 * (amt / Math.max(1, c.military.regiments)), 0.1, 1);
      return ok(`${amt.toFixed(1)}k soldiers recruited.`);
    }
    case 'disband': {
      const amt = Math.min(Math.max(0, cmd.amount), c.military.regiments);
      c.military.regiments -= amt; c.military.manpower += amt * 0.8;
      return ok(`${amt.toFixed(1)}k soldiers demobilised.`);
    }
    case 'doctrine': c.military.doctrine = cmd.doctrine; return ok(`Doctrine: ${cmd.doctrine}.`);
    case 'loan': {
      const max = Math.max(0, c.economy.income * 24 - c.economy.debt);
      if (cmd.amount <= 0 || cmd.amount > max) return fail(`Creditors will lend at most ${fmtNum(max)}.`);
      c.economy.debt += cmd.amount; c.economy.treasury += cmd.amount;
      return ok(`Borrowed ${fmtNum(cmd.amount)} at ${(c.economy.interestRate * 100).toFixed(1)}%.`);
    }
    case 'repay': {
      const amt = Math.min(cmd.amount, c.economy.debt, c.economy.treasury);
      if (amt <= 0) return fail('Nothing to repay.');
      c.economy.debt -= amt; c.economy.treasury -= amt;
      return ok(`Repaid ${fmtNum(amt)}.`);
    }
    case 'buyFood': {
      const months = clamp(cmd.amount, 0, 12);
      const price = 0.0011 * (1 + techLevel(c.tech.known) * 0.2);
      const cost = c.food.consumption * months * price;
      if (cost > c.economy.treasury) return fail(`Importing ${months} months of food costs ${fmtNum(cost)}.`);
      c.economy.treasury -= cost; c.food.stock += c.food.consumption * months;
      return ok(`Imported ${months} months of grain for ${fmtNum(cost)}.`);
    }
    case 'eventChoice': {
      const pe = w.events.pending.find((e) => e.uid === cmd.uid);
      if (!pe || pe.country !== c.id) return fail('No such event for your country.');
      return ok(resolvePlayerEvent(w, cmd.uid, cmd.option, st));
    }
    case 'answerOffer': return answerOffer(w, c, cmd.uid, cmd.accept, st);
    case 'moveCapital': {
      const p = w.provinces[cmd.province];
      if (!p || p.owner !== c.id || p.controller !== c.id) return fail('Capital must be a province you control.');
      const cost = Math.max(20, c.economy.income * 6);
      if (c.economy.treasury < cost) return fail(`Moving the capital costs ${fmtNum(cost)}.`);
      c.economy.treasury -= cost; c.capital = p.id; c.stability.value = clamp(c.stability.value - 5, 0, 100);
      addTimeline(w, 'player', `${c.name} moves its capital`, `The capital moves to ${p.name}.`, [c.id], 1);
      return ok(`Capital moved to ${p.name}.`);
    }
    case 'reform': {
      const g = GOVERNMENTS[cmd.government];
      if (!g) return fail('Unknown government.');
      if (g.minEra > eraIndex(eraForYear(w.date.y))) return fail(`${g.name} is not available in this era.`);
      if (c.modifiers.some((m) => m.id === 'recent_reform' && m.until > now(w))) return fail('A reform was enacted recently (10-year cooldown).');
      const old = c.government;
      c.government = cmd.government;
      c.stability.legitimacy = clamp(c.stability.legitimacy - 15, 0, 100);
      c.stability.value = clamp(c.stability.value - 10, 0, 100);
      addModifier(w, c, { id: 'recent_reform', label: 'Recent constitutional reform', months: 120, effects: {} });
      addTimeline(w, 'player', `${c.name} reforms its government`, `${GOVERNMENTS[old].name} → ${g.name}.`, [c.id], 2);
      return ok(`Government reformed: ${g.name}.`);
    }
    case 'rename': {
      const name = cmd.name.trim().slice(0, 48);
      if (name.length < 2) return fail('Name too short.');
      c.name = name;
      return ok('Renamed.');
    }
    case 'colonize': {
      const p = w.provinces[cmd.province];
      if (!p || p.owner) return fail('Only unclaimed land can be settled.');
      const adjacent = (st.adjacency[p.id] ?? []).some((j) => w.provinces[j].owner === c.id) || (st.seaLinks[p.id] ?? []).some((j) => w.provinces[j].owner === c.id && w.provinces[j].port > 0);
      if (!adjacent) return fail('Settlers need a neighbouring province or a port within sailing range.');
      const cost = colonizeCost(c);
      if (c.economy.treasury < cost) return fail(`Founding a settlement costs ${fmtNum(cost)}.`);
      const settlers = Math.max(2000, c.pop.total * 0.003);
      const donors = w.provinces.filter((q) => q.owner === c.id);
      for (const q of donors) q.pop -= settlers / donors.length;
      c.economy.treasury -= cost;
      p.owner = c.id; p.controller = c.id; p.originalOwner = c.id; p.pop += settlers; p.dev = Math.max(p.dev, 2);
      invalidate(w);
      addTimeline(w, 'player', `Settlement of ${p.name}`, `${c.name} founds a settlement with ${fmtNum(settlers)} colonists.`, [c.id], 1);
      return ok(`${p.name} settled.`);
    }
    case 'diplo': return diplo(w, c, cmd, st);
  }
  return fail('Unknown command.');
}

function diplo(w: World, c: Country, cmd: Extract<Command, { type: 'diplo' }>, st: MapStatic): CommandResult {
  const t = w.countries[cmd.target];
  if (!t?.alive || t.id === c.id) return fail('Invalid target.');
  const r = getRelation(w, c.id, t.id);
  const human = (id: string) => id === w.player || Object.values(w.players).includes(id);
  switch (cmd.action) {
    case 'improve': {
      const cost = improveCost(c);
      if (c.economy.treasury < cost) return fail(`Envoys cost ${fmtNum(cost)}.`);
      c.economy.treasury -= cost; r.opinion = clamp(r.opinion + 15, -200, 200); r.trust = clamp(r.trust + 3, 0, 100);
      return ok(`Relations with ${t.name} improve (opinion ${Math.round(r.opinion)}).`);
    }
    case 'insult': r.opinion = clamp(r.opinion - 40, -200, 200); return ok(`${t.name} is insulted (opinion ${Math.round(r.opinion)}).`);
    case 'gift': {
      const amt = Math.max(10, c.economy.income * 3);
      if (c.economy.treasury < amt) return fail(`A gift costs ${fmtNum(amt)}.`);
      c.economy.treasury -= amt; t.economy.treasury += amt; r.opinion = clamp(r.opinion + 25, -200, 200);
      return ok(`Gift of ${fmtNum(amt)} sent.`);
    }
    case 'recognize': r.recognized = true; r.opinion += 10; return ok(`${c.name} formally recognises ${t.name}.`);
    case 'alliance': case 'trade': case 'nap': case 'guarantee': case 'vassalize': {
      if (isAtWar(w, c.id, t.id)) return fail('You are at war.');
      if (cmd.action !== 'vassalize' && r.treaties[cmd.action as 'alliance']) return fail('Treaty already in force.');
      if (human(t.id)) {
        if (cmd.action === 'guarantee') { setTreaty(w, c.id, t.id, 'guarantee', true); return ok(`You guarantee ${t.name}.`); }
        w.offers.push({ uid: `o${w.uidCounter++}`, from: c.id, to: t.id, kind: cmd.action === 'vassalize' ? 'vassalize' : cmd.action, date: { ...w.date }, reason: `${c.name} proposes: ${cmd.action}` });
        return ok(`Proposal sent to ${t.name}'s player.`);
      }
      const ev = evaluateProposal(w, c, t, cmd.action, st);
      if (ev.total < ev.threshold) { r.opinion -= 3; return { ok: false, message: `${t.name} declines (${ev.total} < ${ev.threshold}).`, evaluation: ev }; }
      if (cmd.action === 'vassalize') {
        t.overlord = c.id;
        addTimeline(w, 'treaty', `${t.name} becomes a vassal of ${c.name}`, 'Diplomatic subjugation.', [c.id, t.id], 2);
        return { ok: true, message: `${t.name} accepts vassalage.`, evaluation: ev };
      }
      setTreaty(w, c.id, t.id, cmd.action, true);
      recordTreaty(w, c, t, cmd.action);
      return { ok: true, message: `${t.name} accepts (${ev.total} ≥ ${ev.threshold}).`, evaluation: ev };
    }
    case 'breakAlliance': {
      if (!r.treaties.alliance) return fail('No alliance.');
      setTreaty(w, c.id, t.id, 'alliance', false); r.opinion -= 40; r.trust = clamp(r.trust - 30, 0, 100);
      log(w, `${c.name} breaks its alliance with ${t.name}.`, 'diplomacy', c.id);
      return ok('Alliance dissolved.');
    }
    case 'cancelTrade': {
      if (!r.treaties.trade) return fail('No trade agreement.');
      setTreaty(w, c.id, t.id, 'trade', false); r.opinion -= 15;
      return ok('Trade agreement cancelled.');
    }
    case 'releaseVassal': {
      if (t.overlord !== c.id) return fail('Not your vassal.');
      t.overlord = null; r.opinion += 50;
      addTimeline(w, 'founding', `${t.name} released`, `${c.name} grants ${t.name} full independence.`, [c.id, t.id], 2);
      return ok(`${t.name} is now independent.`);
    }
    case 'declareWar': {
      if (isAtWar(w, c.id, t.id)) return fail('Already at war.');
      if (r.truceUntil > now(w)) return fail(`Truce in force for ${r.truceUntil - now(w)} more months.`);
      if (t.overlord === c.id) return fail('You cannot attack your own vassal.');
      if (!canReach(w, c.id, t.id, st)) return fail('No shared border or sea route — your armies cannot reach them.');
      const war = declareWar(w, c.id, t.id, 'conquest', st);
      return war ? ok(`War declared: ${war.name}.`) : fail('War could not be declared.');
    }
    case 'peaceWhite': case 'peaceDemand': {
      const war = w.wars.find((x) => !x.ended && ((x.attackers[0] === c.id && x.defenders.includes(t.id)) || (x.defenders[0] === c.id && x.attackers.includes(t.id))));
      if (!war) return fail('You must lead the war against this country to negotiate peace.');
      const isAtt = war.attackers[0] === c.id;
      const terms: PeaceTerms = cmd.action === 'peaceWhite' ? { type: 'white', provinces: [] } : { type: 'conquest', provinces: cmd.provinces?.length ? cmd.provinces.filter((p) => demandableProvinces(w, war, isAtt).includes(p) || w.provinces[p].controller === c.id) : demandableProvinces(w, war, isAtt) };
      if (terms.type === 'conquest' && !terms.provinces.length) return fail('You occupy no provinces you could demand. Win battles and sieges first.');
      const ev = evaluatePeace(w, war, isAtt, terms);
      if (human(t.id)) {
        w.offers.push({ uid: `o${w.uidCounter++}`, from: c.id, to: t.id, kind: 'peace', date: { ...w.date }, terms: { warId: war.id, provinces: terms.provinces, type: terms.type }, reason: `${c.name} offers peace: ${terms.type}` });
        return ok('Peace offer sent.');
      }
      if (ev.total < ev.threshold) return { ok: false, message: `${t.name} refuses (${ev.total} < ${ev.threshold}).`, evaluation: ev };
      endWar(w, war, terms.type, describeTerms(w, terms, c, t), terms, isAtt);
      return { ok: true, message: `Peace signed: ${describeTerms(w, terms, c, t)}`, evaluation: ev };
    }
  }
  return fail('Unknown diplomatic action.');
}

function answerOffer(w: World, c: Country, uidStr: string, accept: boolean, st: MapStatic): CommandResult {
  const idx = w.offers.findIndex((o) => o.uid === uidStr && o.to === c.id);
  if (idx < 0) return fail('Offer no longer valid.');
  const o = w.offers[idx];
  w.offers.splice(idx, 1);
  const from = w.countries[o.from];
  if (!from?.alive) return fail('The other party no longer exists.');
  const r = getRelation(w, c.id, from.id);
  if (!accept) { r.opinion -= 10; return ok(`Declined ${from.name}'s ${o.kind} proposal.`); }
  switch (o.kind) {
    case 'alliance': case 'trade': case 'nap':
      setTreaty(w, c.id, from.id, o.kind, true); recordTreaty(w, from, c, o.kind); return ok(`${o.kind} with ${from.name} signed.`);
    case 'vassalize': c.overlord = from.id; return ok(`You are now a vassal of ${from.name}.`);
    case 'peace': {
      const war = w.wars.find((x) => x.id === o.terms?.warId && !x.ended);
      if (!war) return fail('War already over.');
      const terms: PeaceTerms = { type: (o.terms?.type as PeaceTerms['type']) ?? 'white', provinces: o.terms?.provinces ?? [] };
      const fromIsAtt = war.attackers.includes(from.id);
      endWar(w, war, terms.type, describeTerms(w, terms, from, c), terms, fromIsAtt);
      void st;
      return ok('Peace accepted.');
    }
    default: return ok('Accepted.');
  }
}
