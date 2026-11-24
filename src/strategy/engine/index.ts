// Public API of the simulation engine (framework-independent).
import type { MapStatic, World } from '../types/game';
import { createWorld, type CreateOptions, type MapBundle } from './create';
import { calibrateFood, computeCalc, provinceFood } from './systems';
import { alive } from './util';
import { applyScenarioStart, installCustomScenario } from './scenario';
import { initialSnapshots } from './tick';
import { SCENARIO_BY_ID } from '../data/scenarios';
import type { ScenarioDefinition } from '../types/game';

export * from './tick';
export * from './commands';
export * from './util';
export * from './date';
export { createWorld, estimateGdp } from './create';
export type { CreateOptions, MapBundle, ProvinceMeta, OwnersFile, SandboxEmpire } from './create';
export { answerQuestion, buildContext, projectCommands, recommendations } from './historian';
export { cloneWorld, hashWorld, migrateWorld } from './serialize';
export { evaluateProposal } from './diplomacy';
export { evaluatePeace, demandableProvinces, canReach, provinceValue } from './military';
export { computeCalc, techCost, provinceFood } from './systems';
export { buildMapStatic } from './mapStatic';
export { ACHIEVEMENTS } from './achievements';

/** Creates a ready-to-play world: dataset → countries → calibration → scenario → snapshots. */
export function newGame(bundle: MapBundle, st: MapStatic, opts: CreateOptions, customScenario?: ScenarioDefinition | null): World {
  const w = createWorld(bundle, opts);
  calibrateFood(w);
  if (opts.scenarioId && SCENARIO_BY_ID[opts.scenarioId]) applyScenarioStart(w, st);
  if (customScenario) installCustomScenario(w, customScenario);
  primeCountries(w);
  initialSnapshots(w);
  return w;
}

/** Fills derived monthly figures (income, food balance) so the UI is meaningful before the first tick. */
function primeCountries(w: World): void {
  for (const c of alive(w)) {
    const k = computeCalc(w, c);
    let prod = 0, cons = 0;
    for (const p of w.provinces) if (p.owner === c.id) { prod += provinceFood(w, c, p, k.mult.agriculture, k.foodMod); cons += p.pop; }
    c.food.production = prod; c.food.consumption = cons;
    c.economy.gdp = k.gdp;
    const spend = Object.values(k.spend).reduce((a, b) => a + b, 0);
    c.economy.income = spend / Math.max(0.01, c.economy.spendingRate);
    c.economy.expenses = spend;
    c.economy.lastBalance = c.economy.income - spend;
  }
}
