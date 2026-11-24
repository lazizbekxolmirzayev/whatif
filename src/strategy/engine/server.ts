// Entry point bundled for the server-authoritative Edge Function (see scripts/sync-engine.mjs).
export { newGame, advanceMonth, applyCommand, buildMapStatic, hashWorld, encodeOwners } from './index';
export { SCENARIO_BY_ID } from '../data/scenarios';
export { techLevel } from '../data/technologies';
