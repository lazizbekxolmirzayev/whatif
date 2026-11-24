// Scenario setup and scheduled divergence consequences. Decisions selected before the game
// change the simulation state; their downstream effects are resolved by the normal engine
// (wars, succession, economy), so outcomes are not predetermined.
import type { Country, MapStatic, ScenarioDefinition, World } from '../types/game';
import { SCENARIO_BY_ID } from '../data/scenarios';
import { CITIES } from '../data/cities';
import { addModifier, addTimeline, alive, distanceKm, getRelation, log } from './util';
import { monthIndex } from './date';
import { declareWar, endWar, transferProvince } from './military';
import { recordTreaty, setTreaty } from './diplomacy';
import { newCountry, spawnBreakaway, succession } from './internal';
import { chance } from './rng';
import { invalidate } from './cache';

type Find = (name: string) => Country | null;
interface Scheduled { id: string; at: { y: number; m: number }; when?: (w: World) => boolean; run: (w: World, st: MapStatic, f: Find) => void }
interface Handler { setup: (w: World, st: MapStatic, f: Find) => void; scheduled: Scheduled[] }

const ruler = (c: Country | null, name: string, title: string, born: number, skill: [number, number, number], health = 75, traits: string[] = []) => {
  if (!c) return;
  c.ruler = { name, title, born, health, skill: { admin: skill[0], diplomacy: skill[1], military: skill[2] }, traits, historical: true };
};
const heir = (c: Country | null, name: string, born: number, skill: [number, number, number]) => {
  if (!c) return;
  c.heir = { name, title: 'Heir', born, health: 80, skill: { admin: skill[0], diplomacy: skill[1], military: skill[2] }, traits: [], historical: true };
};
const d = (w: World, id: string) => w.decisions[id];
const div = (w: World, title: string, text: string, cs: (Country | null)[]) => addTimeline(w, 'divergence', title, text, cs.filter(Boolean).map((c) => c!.id), 3, false);
const fact = (w: World, title: string, text: string, cs: (Country | null)[]) => addTimeline(w, 'historical', title, `${text} (documented history)`, cs.filter(Boolean).map((c) => c!.id), 3, true);
function provinceNear(w: World, owner: Country, cityId: string): number | null {
  const city = CITIES.find((c) => c.id === cityId);
  if (!city) return null;
  let best: number | null = null, bd = Infinity;
  for (const p of w.provinces) if (p.owner === owner.id) { const dd = distanceKm(p.lon, p.lat, city.lon, city.lat); if (dd < bd) { bd = dd; best = p.id; } }
  return bd < 500 ? best : null;
}

const HANDLERS: Record<string, Handler> = {
  'timur-east': {
    setup: (w, st, f) => {
      const T = f('Timurid Empire'), M = f('Ming Empire'), O = f('Ottoman Empire');
      ruler(T, 'Timur', 'Emir', 1336, [8, 6, 10], 30, ['conqueror', 'ailing']);
      ruler(M, 'Yongle Emperor (Zhu Di)', 'Emperor', 1360, [8, 6, 8]);
      ruler(O, 'Süleyman Çelebi', 'Prince', 1377, [5, 6, 6], 70, ['contested']);
      if (T) { T.heir = null; T.military.regiments *= 1.4; T.military.quality += 0.15; }
      if (O) {
        if (d(w, 'ottomans') === 'quick') { addModifier(w, O, { id: 'reunified', label: 'Swift reunification', months: 24, effects: { stability: -5 } }); div(w, 'Ottoman reunification', 'A single Ottoman prince quickly restores unity after Ankara.', [O]); }
        else {
          addModifier(w, O, { id: 'interregnum', label: 'Ottoman Interregnum', months: 96, effects: { stability: -18, legitimacy: -20, taxEfficiency: -0.15 } });
          const anatolia = w.provinces.filter((p) => p.owner === O.id && p.lon > 30).sort((a, b) => b.pop - a.pop)[0];
          if (anatolia) { const r = spawnBreakaway(w, O, anatolia.id, st, 'pretender', 'Ottoman Anatolia (Mehmed Çelebi)'); if (r) ruler(r, 'Mehmed Çelebi', 'Prince', 1389, [7, 6, 7]); }
          fact(w, 'Ottoman Interregnum', 'Bayezid\'s sons fight over the Ottoman realm', [O]);
        }
      }
      if (d(w, 'timur_fate') === 'survives') {
        div(w, 'Timur survives Otrar', 'In this timeline Timur recovers from his illness (historically he died on 18 February 1405).', [T]);
        if (d(w, 'campaign') === 'consolidate' && T) { heir(T, 'Shah Rukh', 1377, [8, 7, 6]); addModifier(w, T, { id: 'designated', label: 'Designated heir', months: 1e6, effects: { legitimacy: 12 } }); div(w, 'Timur names Shah Rukh heir', 'Timur returns to Samarkand and secures the succession.', [T]); }
      }
    },
    scheduled: [
      { id: 'timur_death', at: { y: 1405, m: 1 }, when: (w) => d(w, 'timur_fate') !== 'survives', run: (w, st, f) => { const T = f('Timurid Empire'); if (T) { fact(w, 'Death of Timur at Otrar', 'Timur dies of illness on campaign', [T]); succession(w, T, st); } } },
      { id: 'timur_invade', at: { y: 1405, m: 3 }, when: (w) => d(w, 'timur_fate') === 'survives' && d(w, 'campaign') === 'invade', run: (w, st, f) => { const T = f('Timurid Empire'), M = f('Ming Empire'); if (T && M) { div(w, 'Timur marches on China', 'The Timurid army crosses into Ming territory. Its fate depends on supply lines across the steppe and desert.', [T, M]); declareWar(w, T.id, M.id, 'conquest', st); } } },
    ],
  },
  waterloo: {
    setup: (w, st, f) => {
      const F = f('France'), UK = f('United Kingdom of Great Britain and Ireland'), P = f('Prussia'), A = f('Austrian Empire'), R = f('Russian Empire');
      ruler(UK, 'George III (Regent: George, Prince of Wales)', 'King', 1738, [4, 6, 3], 30);
      ruler(P, 'Frederick William III', 'King', 1770, [5, 5, 5]);
      ruler(A, 'Francis I', 'Emperor', 1768, [6, 7, 4]);
      ruler(R, 'Alexander I', 'Emperor', 1777, [6, 8, 6]);
      const battle = d(w, 'battle') ?? 'defeat';
      if (!F) return;
      if (battle === 'defeat') {
        ruler(F, 'Louis XVIII', 'King', 1755, [6, 6, 2], 50);
        F.government = 'constitutional_monarchy';
        addModifier(w, F, { id: 'occupation', label: 'Allied occupation & reparations', months: 36, effects: { stability: -10, taxEfficiency: -0.15 } });
        F.economy.treasury *= 0.4; F.military.regiments *= 0.45;
        fact(w, 'Waterloo: French defeat', 'Napoleon is defeated on 18 June and abdicates on 22 June; the Bourbons return', [F, UK, P]);
        for (const x of [R, A, P]) for (const y of [R, A, P]) if (x && y && x.id < y.id) { setTreaty(w, x.id, y.id, 'alliance', true); }
        return;
      }
      ruler(F, 'Napoleon I', 'Emperor', 1769, [9, 6, 10], 70, ['genius commander']);
      F.government = 'empire';
      const coalition = [UK, P, A, R].filter(Boolean) as Country[];
      const war = coalition.length ? declareWar(w, coalition[0].id, F.id, 'conquest', st) : null;
      if (war) for (const c of coalition.slice(1)) if (!war.attackers.includes(c.id)) war.attackers.push(c.id);
      if (war) war.name = 'War of the Seventh Coalition';
      if (battle === 'victory') {
        F.military.morale = 0.95; F.stability.legitimacy = 80;
        if (UK) UK.military.regiments *= 0.7;
        if (P) P.military.regiments *= 0.7;
        addModifier(w, F, { id: 'waterloo_victory', label: 'Victory at Waterloo', months: 36, effects: { morale: 0.1, legitimacy: 10, stability: 6 } });
        div(w, 'Napoleon wins at Waterloo', 'Wellington\'s army is broken before the Prussians arrive. The Coalition must decide whether to fight on.', [F, UK, P]);
      } else {
        for (const c of [F, ...coalition]) c.stability.warExhaustion += 20;
        div(w, 'Indecisive Waterloo', 'Both armies withdraw bloodied; the campaign continues.', [F, UK, P]);
      }
    },
    scheduled: [
      { id: 'uk_peace', at: { y: 1815, m: 8 }, when: (w) => d(w, 'battle') === 'victory' && d(w, 'coalition') === 'negotiate', run: (w, st, f) => {
        const F = f('France'), UK = f('United Kingdom of Great Britain and Ireland');
        const war = w.wars.find((x) => !x.ended && F && x.defenders.includes(F.id));
        if (war && UK && F) { war.attackers = war.attackers.filter((x) => x !== UK.id); getRelation(w, UK.id, F.id).truceUntil = monthIndex(w.date) + 120; div(w, 'Britain makes peace', 'War-weary Britain signs a separate peace with Napoleon.', [UK, F]); if (!war.attackers.length) endWar(w, war, 'white', 'The Coalition dissolves.'); }
      } },
    ],
  },
  'rome-endures': {
    setup: (w, st, f) => {
      const W = f('Western Roman Empire'), E = f('Eastern Roman Empire');
      ruler(W, 'Honorius', 'Augustus', 384, [3, 4, 2], 70);
      ruler(E, 'Arcadius', 'Augustus', 377, [4, 4, 2], 60);
      ruler(f('Persia'), 'Yazdegerd I', 'King of Kings', 375, [7, 8, 5]);
      ruler(f('Visigoths'), 'Alaric I', 'King', 370, [5, 6, 8]);
      if (W) addModifier(w, W, { id: 'fiscal_decay', label: 'Fiscal exhaustion', months: 600, effects: { taxEfficiency: -0.12, stability: -6 } });
      if (d(w, 'stilicho') === 'spared' && W) { addModifier(w, W, { id: 'stilicho', label: "Stilicho's reforms", months: 360, effects: { militaryQuality: 0.2, morale: 0.1 } }); div(w, 'Stilicho survives', 'Stilicho escapes the court conspiracy of 408 and rebuilds the field army.', [W]); }
      if (d(w, 'reunify') === 'alliance' && W && E) { setTreaty(w, W.id, E.id, 'alliance', true); setTreaty(w, W.id, E.id, 'guarantee', true); recordTreaty(w, W, E, 'alliance'); getRelation(w, W.id, E.id).opinion = 120; div(w, 'Pars Occidentis et Orientis united', 'The two courts commit to mutual defence and subsidies.', [W, E]); }
      if (d(w, 'fiscal') === 'reform' && W) { W.modifiers = W.modifiers.filter((m) => m.id !== 'fiscal_decay'); addModifier(w, W, { id: 'fiscal_reform', label: 'Fiscal reform', months: 1e6, effects: { taxEfficiency: 0.15, inflation: -0.01 } }); div(w, 'Western fiscal reform', 'Land registers and tax reforms restore revenue.', [W]); }
    },
    scheduled: [
      { id: 'rhine', at: { y: 406, m: 11 }, run: (w, st, f) => {
        const W = f('Western Roman Empire'), V = f('Visigoths') ?? f('Franks');
        if (!W || !V) return;
        fact(w, 'Pressure on the Rhine frontier', 'Vandals, Alans and Suebi cross the Rhine on 31 December 406', [W]);
        if (W.stability.value < 60 || chance(w, 0.5)) declareWar(w, V.id, W.id, 'conquest', st);
      } },
    ],
  },
  'mongol-unity': {
    setup: (w, st, f) => {
      const Y = f('Yuan Dynasty'), G = f('Khanate of the Golden Horde'), I = f('Ilkhanate'), C = f('Chagatai Khanate');
      ruler(Y, 'Kublai Khan', 'Great Khan', 1215, [8, 7, 8], 60);
      ruler(I, 'Abaqa Khan', 'Ilkhan', 1234, [6, 6, 7]);
      ruler(G, 'Möngke-Temür', 'Khan', 1240, [5, 5, 6]);
      ruler(f('Mamluke Sultanate'), 'Qalawun', 'Sultan', 1222, [7, 6, 8]);
      const others = [G, I, C].filter(Boolean) as Country[];
      const mode = d(w, 'unity');
      if (!Y) return;
      if (mode === 'federation') {
        for (const o of others) { o.overlord = Y.id; getRelation(w, o.id, Y.id).opinion = 80; for (const o2 of others) if (o2.id < o.id) setTreaty(w, o.id, o2.id, 'nap', true); }
        div(w, 'The Mongol federation', 'The khanates accept Kublai as Great Khan and send tribute to Khanbaliq.', [Y, ...others]);
      } else if (mode === 'unified') {
        for (const o of others) { for (const p of w.provinces) if (p.owner === o.id) { p.owner = Y.id; p.controller = Y.id; } o.alive = false; o.collapsed = { ...w.date }; }
        Y.name = 'Mongol Empire (Yuan)';
        addModifier(w, Y, { id: 'vast_empire', label: 'Ungovernably vast', months: 600, effects: { unrest: 10, taxEfficiency: -0.1 } });
        invalidate(w);
        div(w, 'One Ulus', 'The four khanates are reunited under a single Great Khan.', [Y]);
      } else fact(w, 'Divided khanates', 'The Mongol Empire remains split into four khanates', [Y, ...others]);
    },
    scheduled: [],
  },
  'different-peace-1945': {
    setup: (w, st, f) => {
      const US = f('United States'), SU = f('USSR'), UK = f('United Kingdom'), FR = f('France');
      ruler(US, 'Harry S. Truman', 'President', 1884, [7, 6, 6]);
      ruler(SU, 'Joseph Stalin', 'General Secretary', 1878, [6, 4, 7], 55, ['dictator']);
      ruler(UK, 'Clement Attlee', 'Prime Minister', 1883, [8, 6, 4]);
      ruler(FR, 'Charles de Gaulle', 'Chairman', 1890, [7, 6, 7]);
      const big = [US, SU, UK, FR].filter(Boolean) as Country[];
      for (const c of big) c.stability.warExhaustion = 60;
      if (d(w, 'order') === 'concert') {
        for (const a of big) for (const b of big) if (a.id < b.id) { setTreaty(w, a.id, b.id, 'trade', true); setTreaty(w, a.id, b.id, 'nap', true); getRelation(w, a.id, b.id).opinion = 70; getRelation(w, a.id, b.id).trust = 70; }
        div(w, 'A great-power concert', 'The wartime allies keep cooperating through the UN Security Council.', big);
      } else if (US && SU) {
        const r = getRelation(w, US.id, SU.id); r.opinion = -90; r.trust = 5;
        for (const c of [US, SU]) c.economy.budget.military += 0.15;
        if (UK && FR) { setTreaty(w, US.id, UK.id, 'alliance', true); setTreaty(w, US.id, FR.id, 'alliance', true); }
        fact(w, 'The Cold War begins', 'Rival blocs form around Washington and Moscow', [US, SU]);
      }
      if (d(w, 'aid') === 'all' && US) {
        for (const c of alive(w)) if (w.provinces[c.capital]?.region === 'europe' || c.id === SU?.id) { c.economy.treasury += US.economy.gdp * 0.004; addModifier(w, c, { id: 'reconstruction', label: 'Reconstruction aid', months: 60, effects: { stability: 5, foodProduction: 0.05 } }); getRelation(w, US.id, c.id).opinion += 30; }
        div(w, 'Pan-European reconstruction', 'American aid reaches every European country, including the Soviet zone.', [US]);
      }
    },
    scheduled: [],
  },
  'byzantium-rises': {
    setup: (w, st, f) => {
      const B = f('Byzantine Empire'), O = f('Ottoman Empire'), H = f('Kingdom of Hungary');
      ruler(B, 'Manuel II Palaiologos', 'Basileus', 1350, [8, 9, 5], 70);
      ruler(H, 'Sigismund of Luxembourg', 'King', 1368, [6, 7, 6]);
      if (O) {
        ruler(O, 'Süleyman Çelebi', 'Prince', 1377, [5, 6, 6]);
        addModifier(w, O, { id: 'interregnum', label: 'Ottoman Interregnum', months: 120, effects: { stability: -22, legitimacy: -20, taxEfficiency: -0.15, morale: -0.1 } });
        const anatolia = w.provinces.filter((p) => p.owner === O.id && p.lon > 30).sort((a, b) => b.pop - a.pop)[0];
        if (anatolia) spawnBreakaway(w, O, anatolia.id, st, 'pretender', 'Ottoman Anatolia (Mehmed Çelebi)');
      }
      if (B) { B.military.regiments *= 2; B.economy.treasury *= 2; }
      if (d(w, 'union') === 'alliance' && B && H) { setTreaty(w, B.id, H.id, 'alliance', true); recordTreaty(w, B, H, 'alliance'); B.economy.treasury += H.economy.income * 8; div(w, 'Byzantine–Hungarian alliance', 'Sigismund pledges troops and gold to Constantinople.', [B, H]); }
    },
    scheduled: [
      { id: 'gallipoli', at: { y: 1403, m: 1 }, run: (w, st, f) => {
        const B = f('Byzantine Empire'), O = f('Ottoman Empire');
        if (!B || !O) return;
        if (d(w, 'gallipoli') === 'offensive') { div(w, 'Byzantine reconquista', 'Manuel II rejects the Gallipoli terms and attacks the divided Ottomans.', [B, O]); declareWar(w, B.id, O.id, 'conquest', st); }
        else {
          const th = provinceNear(w, O, 'thessaloniki');
          if (th !== null) transferProvince(w, th, B.id);
          fact(w, 'Treaty of Gallipoli', 'Thessaloniki returns to Byzantine rule', [B, O]);
        }
      } },
    ],
  },
  'vienna-1683': {
    setup: (w, st, f) => {
      const O = f('Ottoman Empire'), H = f('Holy Roman Empire'), P = f('Polish–Lithuanian Commonwealth'), V = f('Venice'), F = f('France');
      ruler(O, 'Mehmed IV', 'Sultan', 1642, [4, 5, 4]);
      ruler(H, 'Leopold I', 'Emperor', 1640, [6, 6, 4]);
      ruler(P, 'Jan III Sobieski', 'King', 1629, [6, 7, 9]);
      ruler(F, 'Louis XIV', 'King', 1638, [9, 8, 7]);
      if (!O || !H) return;
      const war = declareWar(w, O.id, H.id, 'conquest', st);
      if (war) war.name = 'Great Turkish War';
      if (d(w, 'siege') === 'falls') {
        const vp = provinceNear(w, H, 'vienna');
        if (vp !== null) { w.provinces[vp].controller = O.id; }
        addModifier(w, H, { id: 'vienna_lost', label: 'Vienna occupied', months: 60, effects: { stability: -20, legitimacy: -15 } });
        addModifier(w, O, { id: 'vienna_won', label: 'Conquest of Vienna', months: 60, effects: { legitimacy: 15, morale: 0.1 } });
        div(w, 'Vienna falls', 'The Ottoman army storms Vienna before the relief army can arrive.', [O, H]);
      } else {
        O.military.regiments *= 0.6; O.military.morale = 0.3;
        addModifier(w, O, { id: 'vienna_defeat', label: 'Disaster at Vienna', months: 60, effects: { stability: -12, legitimacy: -10 } });
        if (war && P) war.defenders.push(P.id);
        if (war && V) war.defenders.push(V.id);
        if (P) setTreaty(w, H.id, P.id, 'alliance', true);
        if (V) setTreaty(w, H.id, V.id, 'alliance', true);
        fact(w, 'Battle of Vienna', 'Sobieski\'s relief army routs the Ottomans on 12 September 1683', [O, H, P]);
      }
      if (d(w, 'france') === 'opportunist' && F) { declareWar(w, F.id, H.id, 'conquest', st); div(w, 'France strikes the Rhine', 'Louis XIV exploits the Habsburg emergency.', [F, H]); }
    },
    scheduled: [],
  },
  'inca-resists': {
    setup: (w, st, f) => {
      const I = f('Inca Empire'), S = f('Spain');
      ruler(I, 'Atahualpa', 'Sapa Inca', 1502, [7, 5, 8], 85);
      ruler(S, 'Charles V', 'King & Emperor', 1500, [8, 7, 7]);
      if (!I) return;
      if (d(w, 'civilwar') !== 'peace') {
        I.stability.value = 25; I.military.manpower *= 0.5;
        const south = w.provinces.filter((p) => p.owner === I.id && p.lat < -12).sort((a, b) => b.pop - a.pop)[0];
        if (south) { const r = spawnBreakaway(w, I, south.id, st, 'pretender', 'Tawantinsuyu (Huáscar, Cusco)'); if (r) { ruler(r, 'Huáscar', 'Sapa Inca', 1503, [5, 4, 5]); declareWar(w, I.id, r.id, 'conquest', st); } }
        fact(w, 'Inca civil war', 'Huáscar and Atahualpa fight for the throne', [I]);
      } else { addModifier(w, I, { id: 'shared_rule', label: 'Brothers share rule', months: 120, effects: { stability: 8 } }); div(w, 'Peace between the brothers', 'Huáscar and Atahualpa agree to divide responsibilities.', [I]); }
      const sev = d(w, 'epidemic') === 'milder' ? 0.3 : 0.85;
      I.health.epidemic = { name: 'smallpox epidemic', severity: sev, monthsLeft: 36, origin: I.capital };
      if (sev > 0.5) fact(w, 'Smallpox in the Andes', 'European diseases spread ahead of the conquistadors', [I]);
    },
    scheduled: [
      { id: 'cajamarca', at: { y: 1532, m: 10 }, run: (w, st, f) => {
        const I = f('Inca Empire'), S = f('Spain');
        if (!I) return;
        if (d(w, 'cajamarca') === 'ambush_fails') {
          addModifier(w, I, { id: 'cajamarca_victory', label: 'Victory at Cajamarca', months: 120, effects: { legitimacy: 15, morale: 0.15, stability: 6 } });
          div(w, 'The ambush at Cajamarca fails', 'Pizarro\'s small expedition is overwhelmed; Atahualpa keeps his throne.', [I, S]);
          return;
        }
        // Pizarro's expedition lands on the northern coast and is modelled as a Spanish vassal force
        const coast = w.provinces.filter((p) => p.owner === I.id && p.coastal).sort((a, b) => b.lat - a.lat)[0];
        if (!coast) return;
        const exp = newCountry(w, 'Spanish Expedition (Pizarro)', [coast.id], S, 'scenario');
        exp.government = 'military_junta'; exp.military.regiments = 25; exp.military.quality = (S?.military.quality ?? 2) + 0.8; exp.military.morale = 0.95;
        exp.tech.known = [...(S?.tech.known ?? [])]; exp.economy.treasury = 500; exp.flag = S?.flag ?? exp.flag; exp.color = '#d0a43c';
        if (S) exp.overlord = S.id;
        I.stability.legitimacy -= 30;
        fact(w, 'Atahualpa captured at Cajamarca', 'Pizarro seizes the Sapa Inca on 16 November 1532', [I]);
        succession(w, I, st);
        declareWar(w, exp.id, I.id, 'conquest', st);
        log(w, 'Spanish expedition lands at ' + coast.name, 'war', exp.id);
      } },
    ],
  },
};

export function findByName(w: World): Find {
  return (name: string) => Object.values(w.countries).find((c) => c.alive && c.name === name) ?? null;
}

export function applyScenarioStart(w: World, st: MapStatic): void {
  if (!w.scenarioId) return;
  const def: ScenarioDefinition | undefined = SCENARIO_BY_ID[w.scenarioId];
  if (!def) return;
  const f = findByName(w);
  for (const e of def.originalTimeline) if (monthIndex(e.date) < monthIndex(w.date)) {
    addTimeline(w, 'historical', e.title, `${e.text} (documented history)`, (e.countries ?? []).map((n) => f(n)?.id).filter(Boolean) as string[], 2, true, e.date);
  }
  HANDLERS[def.id]?.setup(w, st, f);
  for (const dec of def.decisions) {
    const choice = w.decisions[dec.id];
    const opt = dec.options.find((o) => o.id === choice);
    if (opt && !opt.historical) log(w, `Divergence: ${dec.question} → ${opt.label}`, 'divergence');
  }
}

export function runScenarioSchedule(w: World, st: MapStatic): void {
  if (!w.scenarioId) return;
  const h = HANDLERS[w.scenarioId];
  if (!h) return;
  const t = monthIndex(w.date);
  for (const s of h.scheduled) {
    if (w.events.scheduledDone.includes(s.id)) continue;
    if (t < monthIndex(s.at)) continue;
    w.events.scheduledDone.push(s.id);
    if (s.when && !s.when(w)) continue;
    s.run(w, st, findByName(w));
  }
}

/** Custom scenarios from the editor: install their events into the world. */
export function installCustomScenario(w: World, def: ScenarioDefinition): void {
  w.events.custom = [...(def.customEvents ?? [])];
}
