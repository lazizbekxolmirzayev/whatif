// Built-in (rule-based) AI Historian. It ONLY reads the simulation state, logs and snapshots;
// it never invents events. It is also used to build the factual context sent to the optional LLM.
import type { Command, Country, CountryId, MapStatic, World } from '../types/game';
import { allies, fmtNum, militaryPower, peekRelation, warsOf } from './util';
import { fmtDate } from './date';
import { techLevel } from '../data/technologies';
import { GOVERNMENTS } from '../data/eras';
import { cloneWorld } from './serialize';
import { advanceMonth } from './tick';
import { applyCommand } from './commands';
import { SCENARIO_BY_ID } from '../data/scenarios';

export type Intent = 'collapse' | 'power' | 'economy' | 'alliance' | 'population' | 'decision' | 'war' | 'overview';
export interface HistorianAnswer { intent: Intent; title: string; paragraphs: string[]; facts: { label: string; value: string }[]; references: string[]; countries: CountryId[] }

const KEYWORDS: [Intent, RegExp][] = [
  ['collapse', /collap|fall|fell|destroy|qula|yiqil|parchala|распа|пал[аи]?\b|гибел|круш/i],
  ['alliance', /allian|ittifoq|союз|treaty|shartnoma/i],
  ['economy', /econom|crisis|debt|inflation|treasury|iqtisod|inqiroz|qarz|кризис|эконом|долг|инфляц/i],
  ['population', /populat|decline|famine|aholi|ochlik|насел|голод/i],
  ['decision', /next decision|consequen|should i|what will happen|qaror|oqibat|последств|решени/i],
  ['power', /powerful|rise|strong|dominan|kuchli|qudrat|yuksal|сильн|могущ|возвыш/i],
  ['war', /\bwar\b|battle|urush|jang|войн|битв/i],
];

export function detectIntent(q: string): Intent {
  for (const [i, re] of KEYWORDS) if (re.test(q)) return i;
  return 'overview';
}
export function detectCountries(w: World, q: string): Country[] {
  const lq = q.toLowerCase();
  const all = Object.values(w.countries).sort((a, b) => b.name.length - a.name.length);
  const out: Country[] = [];
  for (const c of all) {
    const n = c.name.toLowerCase();
    const short = n.replace(/^(kingdom|empire|sultanate|republic|principality) of /, '').split(' ')[0];
    if (lq.includes(n) || (short.length > 4 && lq.includes(short))) { if (!out.includes(c)) out.push(c); }
    if (out.length >= 2) break;
  }
  return out;
}

function snapshotsOf(w: World, id: CountryId) {
  return w.history.filter((h) => h.countries[id]).map((h) => ({ year: h.year, ...h.countries[id] }));
}
function trend(w: World, id: CountryId, key: 'pop' | 'gdp' | 'provinces' | 'stability' | 'military' | 'tech'): string {
  const s = snapshotsOf(w, id);
  if (s.length < 2) return 'insufficient history yet';
  const a = s[0], b = s[s.length - 1];
  const fmt = (v: number) => (key === 'stability' || key === 'tech' ? v.toFixed(key === 'tech' ? 2 : 0) : fmtNum(v));
  const pct = a[key] ? ((b[key] - a[key]) / a[key]) * 100 : 0;
  return `${fmt(a[key])} (${a.year}) → ${fmt(b[key])} (${b.year})${a[key] ? `, ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : ''}`;
}
function relevantLog(w: World, id: CountryId, n = 6, kinds?: string[]): string[] {
  const out: string[] = [];
  const name = w.countries[id]?.name ?? '';
  for (let i = w.log.length - 1; i >= 0 && out.length < n; i--) {
    const e = w.log[i];
    if ((e.country === id || e.text.includes(name)) && (!kinds || kinds.includes(e.kind))) out.push(`${fmtDate(e.date, true)}: ${e.text}`);
  }
  return out;
}

export function sidePowerOf(w: World, id: CountryId): number {
  let p = militaryPower(w.countries[id]);
  for (const a of allies(w, id)) p += militaryPower(w.countries[a]) * 0.5;
  return p;
}

export function answerQuestion(w: World, question: string, focus: CountryId | null): HistorianAnswer {
  const intent = detectIntent(question);
  const named = detectCountries(w, question);
  const c = named[0] ?? (focus ? w.countries[focus] : null) ?? (w.player ? w.countries[w.player] : null) ?? Object.values(w.countries)[0];
  const base: HistorianAnswer = { intent, title: '', paragraphs: [], facts: [], references: [], countries: [c.id] };
  switch (intent) {
    case 'collapse': return collapse(w, c, base);
    case 'power': return power(w, c, base);
    case 'economy': return economy(w, c, base);
    case 'alliance': return alliance(w, c, named[1] ?? null, base);
    case 'population': return population(w, c, base);
    case 'decision': return decision(w, c, base);
    case 'war': return war(w, c, base);
    default: return overview(w, c, base);
  }
}

function collapse(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  if (c.alive) {
    a.title = `Is ${c.name} at risk of collapse?`;
    const risks: string[] = [];
    if (c.stability.value < 30) risks.push(`stability is only ${Math.round(c.stability.value)}/100`);
    if (c.stability.rebellion > 30) risks.push(`rebellion pressure has reached ${Math.round(c.stability.rebellion)}%`);
    if (c.economy.debt > c.economy.income * 24) risks.push(`debt equals ${(c.economy.debt / Math.max(1, c.economy.income)).toFixed(0)} months of income`);
    if (c.food.shortage > 0) risks.push(`${Math.round(c.food.shortage * 100)}% of food needs are unmet`);
    const wars = warsOf(w, c.id).filter((x) => (x.attackers.includes(c.id) ? x.score : -x.score) < -30);
    if (wars.length) risks.push(`it is losing the ${wars.map((x) => x.name).join(', ')}`);
    if (!c.heir) risks.push('there is no designated heir');
    a.paragraphs.push(`${c.name} has not collapsed in this timeline. ${risks.length ? `Current risk factors: ${risks.join('; ')}.` : 'No acute risk factors are present.'}`);
  } else {
    a.title = `Why did ${c.name} collapse?`;
    const end = c.collapsed ? fmtDate(c.collapsed) : 'unknown date';
    a.paragraphs.push(`${c.name} ceased to exist in ${end} in this simulated timeline.`);
    const lostWars = w.wars.filter((x) => x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id)));
    if (lostWars.length) a.paragraphs.push(`It fought ${lostWars.length} recorded war(s): ${lostWars.slice(-3).map((x) => `${x.name} (${x.result ?? 'ended'})`).join(' ')}`);
    const brk = w.timeline.filter((t) => t.countries.includes(c.id) && (t.kind === 'rebellion' || t.kind === 'founding' || t.kind === 'succession'));
    if (brk.length) a.paragraphs.push(`Internal fractures preceded the end: ${brk.slice(-3).map((t) => `${fmtDate(t.date, true)} — ${t.title}`).join('; ')}.`);
  }
  a.facts.push({ label: 'Population trend', value: trend(w, c.id, 'pop') }, { label: 'Provinces trend', value: trend(w, c.id, 'provinces') }, { label: 'Stability trend', value: trend(w, c.id, 'stability') });
  a.facts.push({ label: 'Deaths: famine / epidemic / war', value: `${fmtNum(c.pop.famineDeaths)} / ${fmtNum(c.pop.epidemicDeaths)} / ${fmtNum(c.pop.warDeaths)}` });
  a.references = relevantLog(w, c.id, 6, ['war', 'collapse', 'politics', 'succession', 'peace']);
  return a;
}

function power(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  a.title = `What made ${c.name} powerful?`;
  const all = Object.values(w.countries).filter((x) => x.alive && !x.tribal);
  const avgTech = all.reduce((s, x) => s + techLevel(x.tech.known), 0) / Math.max(1, all.length);
  const rank = all.sort((x, y) => y.economy.gdp - x.economy.gdp).findIndex((x) => x.id === c.id) + 1;
  const factors: string[] = [];
  const tl = techLevel(c.tech.known);
  if (tl > avgTech + 0.3) factors.push(`a technological lead (level ${tl.toFixed(2)} vs world average ${avgTech.toFixed(2)})`);
  const won = w.wars.filter((x) => x.ended && x.result && (x.attackers[0] === c.id ? x.result.includes(c.name) : x.defenders[0] === c.id && x.result.includes(c.name)));
  if (won.length) factors.push(`${won.length} favourable peace settlement(s)`);
  const partners = Object.entries(w.relations).filter(([k, r]) => r.treaties.trade && k.includes(c.id)).length;
  if (partners) factors.push(`${partners} trade agreement(s) boosting commerce`);
  if (allies(w, c.id).length) factors.push(`alliances with ${allies(w, c.id).map((x) => w.countries[x].name).join(', ')}`);
  if (c.stability.value > 60) factors.push(`high internal stability (${Math.round(c.stability.value)})`);
  if (c.pop.growthRate > 0.003) factors.push(`steady population growth (${(c.pop.growthRate * 100).toFixed(2)}%/yr)`);
  a.paragraphs.push(`${c.name} ranks #${rank} by economic output among organised states. ${factors.length ? `The simulation points to ${factors.join(', ')}.` : 'Its strength rests mainly on its starting size and resources.'}`);
  a.facts.push({ label: 'GDP trend', value: trend(w, c.id, 'gdp') }, { label: 'Provinces', value: trend(w, c.id, 'provinces') }, { label: 'Technology', value: trend(w, c.id, 'tech') }, { label: 'Army (k)', value: trend(w, c.id, 'military') });
  a.references = relevantLog(w, c.id, 6, ['war', 'peace', 'tech', 'diplomacy']);
  return a;
}

function economy(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  const e = c.economy;
  a.title = `${c.name}: economic diagnosis`;
  const causes: { text: string; weight: number }[] = [];
  if (e.lastBalance < 0) causes.push({ text: `a monthly deficit of ${fmtNum(-e.lastBalance)} (income ${fmtNum(e.income)} vs expenses ${fmtNum(e.expenses)})`, weight: -e.lastBalance / Math.max(1, e.income) });
  if (e.debt > e.income * 12) causes.push({ text: `debt of ${fmtNum(e.debt)} at ${(e.interestRate * 100).toFixed(1)}% interest`, weight: e.debt / Math.max(1, e.income * 24) });
  if (e.inflation > 0.04) causes.push({ text: `inflation of ${(e.inflation * 100).toFixed(1)}%, which erodes tax efficiency and satisfaction`, weight: e.inflation * 10 });
  if (c.stability.warExhaustion > 30) causes.push({ text: `war exhaustion (${Math.round(c.stability.warExhaustion)}) from ongoing or recent conflict`, weight: c.stability.warExhaustion / 60 });
  if (c.food.imports > 0) causes.push({ text: `grain imports costing treasury reserves`, weight: 0.3 });
  if (e.spendingRate > 1) causes.push({ text: `spending at ${Math.round(e.spendingRate * 100)}% of income`, weight: e.spendingRate - 1 });
  causes.sort((x, y) => y.weight - x.weight);
  a.paragraphs.push(causes.length ? `The main pressures on ${c.name}'s finances are ${causes.slice(0, 4).map((x) => x.text).join('; ')}.` : `${c.name}'s finances are currently sound: the treasury holds ${fmtNum(e.treasury)} with a monthly balance of ${fmtNum(e.lastBalance)}.`);
  const crises = w.timeline.filter((t) => t.countries.includes(c.id) && /Fiscal Crisis|default|debase/i.test(t.title + t.text));
  if (crises.length) a.paragraphs.push(`Past crises: ${crises.slice(-3).map((t) => `${fmtDate(t.date, true)} — ${t.title}`).join('; ')}.`);
  a.facts.push({ label: 'GDP (annual)', value: fmtNum(e.gdp) }, { label: 'Tax rate', value: `${Math.round(e.taxRate * 100)}%` }, { label: 'Trade income', value: `${fmtNum(e.tradeIncome)}/mo` }, { label: 'Treasury', value: fmtNum(e.treasury) }, { label: 'Debt', value: fmtNum(e.debt) }, { label: 'GDP trend', value: trend(w, c.id, 'gdp') });
  a.references = relevantLog(w, c.id, 5, ['event', 'economy']);
  return a;
}

function alliance(w: World, c: Country, other: Country | null, a: HistorianAnswer): HistorianAnswer {
  const al = allies(w, c.id);
  const partner = other ?? (al[0] ? w.countries[al[0]] : null);
  if (!partner) { a.title = `${c.name} has no alliances`; a.paragraphs.push(`${c.name} currently has no allies, so no alliance can end. Its own military power is ${militaryPower(c).toFixed(0)}.`); return a; }
  a.countries.push(partner.id);
  a.title = `What if the ${c.name}–${partner.name} alliance ends?`;
  const r = peekRelation(w, c.id, partner.id);
  const before = sidePowerOf(w, c.id);
  const after = before - (r?.treaties.alliance ? militaryPower(partner) * 0.5 : 0);
  const threats = Object.values(w.countries).filter((x) => x.alive && x.id !== partner.id && x.id !== c.id && (peekRelation(w, c.id, x.id)?.opinion ?? 0) < -30).sort((x, y) => militaryPower(y) - militaryPower(x)).slice(0, 3);
  a.paragraphs.push(r?.treaties.alliance ? `The alliance contributes about ${Math.round((1 - after / Math.max(1, before)) * 100)}% of ${c.name}'s effective coalition strength (${before.toFixed(0)} → ${after.toFixed(0)}).` : `${c.name} and ${partner.name} are not currently allied (opinion ${Math.round(r?.opinion ?? 0)}).`);
  if (threats.length) a.paragraphs.push(`Hostile powers that could exploit the gap: ${threats.map((x) => `${x.name} (power ${militaryPower(x).toFixed(0)}, opinion ${Math.round(peekRelation(w, c.id, x.id)?.opinion ?? 0)})`).join(', ')}. AI states declare war only when they are at least 1.5× stronger including allies, so losing this alliance ${threats.some((x) => militaryPower(x) > after / 1.5) ? 'would make an attack plausible' : 'is unlikely to trigger an immediate attack'}.`);
  a.paragraphs.push('Breaking an alliance also reduces trust (−30) and opinion (−40) with the former ally. Use the Projection tool to simulate the next 12 months precisely.');
  a.facts.push({ label: 'Opinion', value: `${Math.round(r?.opinion ?? 0)}` }, { label: 'Trust', value: `${Math.round(r?.trust ?? 0)}` });
  return a;
}

function population(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  a.title = `${c.name}: population dynamics`;
  const p = c.pop;
  const yearlyBirths = p.births * 12, yearlyDeaths = p.deaths * 12;
  const causes: string[] = [];
  if (c.food.shortage > 0) causes.push(`famine (${Math.round(c.food.shortage * 100)}% shortfall)`);
  if (c.health.epidemic) causes.push(`the ongoing ${c.health.epidemic.name} (severity ${Math.round(c.health.epidemic.severity * 100)}%)`);
  if (warsOf(w, c.id).length) causes.push('war casualties and occupation');
  if (p.migration < 0) causes.push(`emigration (${fmtNum(-p.migration)} last month)`);
  const near = w.provinces.filter((x) => x.owner === c.id);
  a.paragraphs.push(`Births run at about ${fmtNum(yearlyBirths)} per year against ${fmtNum(yearlyDeaths)} deaths, a growth rate of ${(p.growthRate * 100).toFixed(2)}%/yr. ${causes.length ? `Current downward pressures: ${causes.join(', ')}.` : 'No acute crisis is suppressing growth.'}`);
  a.paragraphs.push(`Long-run growth is limited by agricultural capacity: farms, rivers, agricultural technology and the agriculture budget raise it; overcrowded provinces see births fall. ${near.length} provinces are tracked individually.`);
  a.facts.push({ label: 'Population trend', value: trend(w, c.id, 'pop') }, { label: 'Urbanisation', value: `${Math.round(p.urbanization * 100)}%` }, { label: 'Cumulative famine deaths', value: fmtNum(p.famineDeaths) }, { label: 'Cumulative epidemic deaths', value: fmtNum(p.epidemicDeaths) }, { label: 'Cumulative war deaths', value: fmtNum(p.warDeaths) }, { label: 'Healthcare / sanitation', value: `${Math.round(c.health.care)} / ${Math.round(c.health.sanitation)}` });
  a.references = relevantLog(w, c.id, 5, ['health', 'event']);
  return a;
}

function decision(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  a.title = `Advice for ${c.name}'s next decisions`;
  const recs = recommendations(w, c);
  a.paragraphs.push(recs.length ? 'Based on the current state, these actions address the most pressing problems:' : 'No urgent problems detected. Consider investing in research or infrastructure.');
  for (const r of recs) a.paragraphs.push(`• ${r.text}`);
  a.paragraphs.push('Use “Project consequences” below to simulate any action 12 months ahead with the actual engine before committing.');
  return a;
}

export function recommendations(w: World, c: Country): { text: string; command?: Command }[] {
  const out: { text: string; command?: Command }[] = [];
  if (c.food.shortage > 0 || c.food.production < c.food.consumption) out.push({ text: `Food production (${fmtNum(c.food.production)}) is below consumption (${fmtNum(c.food.consumption)}). Raise the agriculture budget or import grain.`, command: { type: 'buyFood', country: c.id, amount: 3 } });
  if (c.stability.value < 40) out.push({ text: `Stability ${Math.round(c.stability.value)} is low. Lowering taxes by 3 points would raise satisfaction.`, command: { type: 'setTax', country: c.id, rate: Math.max(0, c.economy.taxRate - 0.03) } });
  if (c.economy.lastBalance < 0 && c.stability.value > 55) out.push({ text: `The budget runs a deficit of ${fmtNum(-c.economy.lastBalance)}/month while stability is solid; a modest tax rise is affordable.`, command: { type: 'setTax', country: c.id, rate: c.economy.taxRate + 0.02 } });
  if (!c.tech.researching) out.push({ text: 'No research project is selected — research points are being wasted.' });
  if (c.health.epidemic) out.push({ text: `The ${c.health.epidemic.name} is active: increase the health budget.` });
  const threats = Object.values(w.countries).filter((x) => x.alive && (peekRelation(w, c.id, x.id)?.opinion ?? 0) < -50 && militaryPower(x) > militaryPower(c) * 1.2);
  if (threats.length) out.push({ text: `${threats[0].name} is hostile and stronger. Seek alliances or a non-aggression pact.` });
  return out.slice(0, 5);
}

function war(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  const wars = warsOf(w, c.id);
  a.title = wars.length ? `${c.name}'s wars` : `${c.name} is at peace`;
  for (const x of wars) {
    const side = x.attackers.includes(c.id) ? 1 : -1;
    const last = x.battles.slice(-3);
    a.paragraphs.push(`${x.name} (since ${fmtDate(x.start, true)}): war score ${Math.round(x.score * side)} from ${c.name}'s perspective. ${last.length ? `Recent battles: ${last.map((b) => `${w.provinces[b.province].name} — won by ${w.countries[b.winner]?.name} (${b.factors.slice(0, 2).join('; ')})`).join(' | ')}` : 'No battles yet.'}`);
  }
  if (!wars.length) a.paragraphs.push(`Past conflicts: ${w.wars.filter((x) => x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id))).slice(-3).map((x) => `${x.name}: ${x.result}`).join(' ') || 'none recorded.'}`);
  a.facts.push({ label: 'Army', value: `${c.military.regiments.toFixed(1)}k` }, { label: 'Quality', value: c.military.quality.toFixed(2) }, { label: 'Morale', value: `${Math.round(c.military.morale * 100)}%` }, { label: 'Supply', value: `${Math.round(c.military.supply * 100)}%` });
  return a;
}

function overview(w: World, c: Country, a: HistorianAnswer): HistorianAnswer {
  a.title = `${c.name} — state of the realm, ${fmtDate(w.date)}`;
  a.paragraphs.push(`${c.name} is a ${GOVERNMENTS[c.government].name.toLowerCase()} of ${fmtNum(c.pop.total)} people across ${c.provinceCount} provinces, ruled by ${c.ruler.name}${c.ruler.historical ? ' (historical figure)' : ' (generated character)'}.`);
  const sc = w.scenarioId ? SCENARIO_BY_ID[w.scenarioId] : null;
  if (sc) a.paragraphs.push(`This world began from the scenario “${sc.title}”. Documented history ends at the divergence point; later events are simulated alternatives.`);
  return power(w, c, a);
}

/** Compact factual context for the optional LLM historian (server-side). */
export function buildContext(w: World, focus: CountryId | null): string {
  const c = focus ? w.countries[focus] : w.player ? w.countries[w.player] : null;
  const lines: string[] = [];
  lines.push(`DATE: ${fmtDate(w.date)}. WORLD STARTED: ${fmtDate(w.startDate)} from dataset ${w.mapKey}. MODE: ${w.mode}.`);
  if (w.scenarioId) { const s = SCENARIO_BY_ID[w.scenarioId]; if (s) lines.push(`SCENARIO: ${s.title}. Divergence choices: ${Object.entries(w.decisions).map(([k, v]) => `${k}=${v}`).join(', ')}`); }
  if (c) {
    lines.push(`FOCUS: ${c.name} alive=${c.alive} gov=${c.government} pop=${Math.round(c.pop.total)} provinces=${c.provinceCount} stability=${c.stability.value.toFixed(0)} legitimacy=${c.stability.legitimacy.toFixed(0)} treasury=${c.economy.treasury.toFixed(0)} income=${c.economy.income.toFixed(0)} expenses=${c.economy.expenses.toFixed(0)} debt=${c.economy.debt.toFixed(0)} inflation=${(c.economy.inflation * 100).toFixed(1)}% food_prod=${c.food.production.toFixed(0)} food_cons=${c.food.consumption.toFixed(0)} tech=${techLevel(c.tech.known).toFixed(2)} army=${c.military.regiments.toFixed(1)}k`);
    lines.push(`HISTORY ${c.name}: pop ${trend(w, c.id, 'pop')}; gdp ${trend(w, c.id, 'gdp')}; provinces ${trend(w, c.id, 'provinces')}`);
    lines.push(`RECENT LOG: ${relevantLog(w, c.id, 12).join(' | ')}`);
  }
  lines.push(`TOP POWERS: ${Object.values(w.countries).filter((x) => x.alive).sort((a, b) => b.economy.gdp - a.economy.gdp).slice(0, 8).map((x) => `${x.name}(gdp ${x.economy.gdp.toFixed(0)}, prov ${x.provinceCount})`).join(', ')}`);
  lines.push(`ACTIVE WARS: ${w.wars.filter((x) => !x.ended).map((x) => `${x.name} score ${x.score.toFixed(0)}`).join('; ') || 'none'}`);
  lines.push(`TIMELINE (last 15; factual=true means documented history): ${w.timeline.slice(-15).map((t) => `[${fmtDate(t.date, true)}|factual=${t.factual}] ${t.title}`).join(' ; ')}`);
  return lines.join('\n');
}

// ---------------- Projection: simulate consequences with the real engine ----------------
export interface ProjectionPoint { month: number; treasury: number; stability: number; pop: number; food: number; army: number; provinces: number; gdp: number }
export interface ProjectionResult { baseline: ProjectionPoint[]; variant: ProjectionPoint[]; message: string; summary: string[] }

function point(w: World, id: CountryId, month: number): ProjectionPoint {
  const c = w.countries[id];
  return { month, treasury: c.economy.treasury, stability: c.stability.value, pop: c.pop.total, food: c.food.stock / Math.max(1, c.food.consumption), army: c.military.regiments, provinces: w.provinces.filter((p) => p.owner === id).length, gdp: c.economy.gdp };
}
export function projectCommands(w: World, st: MapStatic, country: CountryId, cmds: Command[], months = 12): ProjectionResult {
  const base = cloneWorld(w), alt = cloneWorld(w);
  base.events.pending = []; alt.events.pending = [];
  let message = '';
  for (const cmd of cmds) { const r = applyCommand(alt, cmd, st); message += r.message + ' '; }
  const baseline: ProjectionPoint[] = [point(base, country, 0)], variant: ProjectionPoint[] = [point(alt, country, 0)];
  for (let i = 1; i <= months; i++) {
    advanceMonth(base, st); advanceMonth(alt, st);
    base.events.pending = []; alt.events.pending = [];
    if (!base.countries[country]?.alive || !alt.countries[country]?.alive) break;
    baseline.push(point(base, country, i)); variant.push(point(alt, country, i));
  }
  const b = baseline[baseline.length - 1], v = variant[variant.length - 1];
  const diff = (label: string, x: number, y: number, f: (n: number) => string) => `${label}: ${f(x)} → ${f(y)} (${y - x >= 0 ? '+' : ''}${f(y - x)})`;
  const summary = [
    diff('Treasury', b.treasury, v.treasury, fmtNum), diff('Stability', b.stability, v.stability, (n) => n.toFixed(1)),
    diff('Population', b.pop, v.pop, fmtNum), diff('Food stock (months)', b.food, v.food, (n) => n.toFixed(2)),
    diff('Army (k)', b.army, v.army, (n) => n.toFixed(1)), diff('Provinces', b.provinces, v.provinces, (n) => n.toFixed(0)),
  ];
  return { baseline, variant, message: message.trim(), summary };
}
