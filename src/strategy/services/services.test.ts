import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateScenario, exportCode, importCode } from './scenarios';
import { compressWorld, decompressWorld } from './saves';
import { newGame, buildMapStatic, advanceMonth, hashWorld, applyCommand } from '../engine';
import type { ScenarioDefinition } from '../types/game';

const base: ScenarioDefinition = { id: 'custom-x', title: 'Test', subtitle: '', question: 'What if the test passes?', mapKey: '1492', start: { y: 1500, m: 0 }, era: 'renaissance', background: [], sourcesNote: '', focusCountries: ['England'], recommended: 'England', characters: [], originalTimeline: [], decisions: [], consequences: [], artHue: 1, customEvents: [] };

describe('scenario validation & sharing', () => {
  it('accepts a valid scenario and rejects invalid configurations', () => {
    expect(validateScenario(base, new Set(['England', 'France']))).toEqual([]);
    expect(validateScenario({ ...base, start: { y: 1400, m: 0 } }, new Set(['England']))).toContain('The map dataset (1492) is later than the start year.');
    expect(validateScenario({ ...base, focusCountries: ['Atlantis'], recommended: 'Atlantis' }, new Set(['England'])).some((e) => e.includes('Atlantis'))).toBe(true);
    const badWar = { ...base, customEvents: [{ id: 'e', title: 'War', description: '', probability: 1, once: true, conditions: [], options: [{ id: 'a', label: 'x', effects: [{ kind: 'war' as const, country: 'England', value: 0, other: 'England' }] }] }] };
    expect(validateScenario(badWar, new Set(['England'])).some((e) => e.includes('itself'))).toBe(true);
  });
  it('round-trips share codes', () => { expect(importCode(exportCode(base)).title).toBe('Test'); });
});

describe('save system', () => {
  it('compresses and restores a world that continues identically', () => {
    const topo = JSON.parse(readFileSync('public/strategy-data/maps/provinces.topo.json', 'utf8'));
    const meta = JSON.parse(readFileSync('public/strategy-data/maps/provinces_meta.json', 'utf8'));
    const owners = JSON.parse(readFileSync('public/strategy-data/maps/owners_1815.json', 'utf8'));
    const { st, drawn } = buildMapStatic('1815', topo, meta);
    const w = newGame({ key: '1815', meta, owners, static: st, drawn }, st, { name: 'S', seed: 9, start: { y: 1815, m: 5 }, mode: 'scenario', scenarioId: 'waterloo', decisions: { battle: 'victory', coalition: 'negotiate' }, player: 'France' });
    expect(applyCommand(w, { type: 'setTax', country: w.player!, rate: 0.18 }, st).ok).toBe(true);
    for (let i = 0; i < 6; i++) advanceMonth(w, st);
    const data = compressWorld(w);
    expect(data.byteLength).toBeLessThan(JSON.stringify(w).length / 3);
    const r = decompressWorld(data);
    expect(hashWorld(r)).toBe(hashWorld(w));
    for (let i = 0; i < 6; i++) { advanceMonth(w, st); advanceMonth(r, st); }
    expect(hashWorld(r)).toBe(hashWorld(w));
    expect(w.wars.some((x) => x.name === 'War of the Seventh Coalition')).toBe(true);
  });
});
