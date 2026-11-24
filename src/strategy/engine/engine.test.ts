import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame, advanceMonth, hashWorld, cloneWorld, buildMapStatic, applyCommand, answerQuestion, projectCommands } from './index';
import type { MapBundle } from './index';

function bundle(key: string) {
  const topo = JSON.parse(readFileSync('public/strategy-data/maps/provinces.topo.json', 'utf8'));
  const meta = JSON.parse(readFileSync('public/strategy-data/maps/provinces_meta.json', 'utf8'));
  const owners = JSON.parse(readFileSync(`public/strategy-data/maps/owners_${key}.json`, 'utf8'));
  const { st, drawn } = buildMapStatic(key, topo, meta);
  const b: MapBundle = { key, meta, owners, static: st, drawn };
  return { b, st };
}

describe('simulation engine', () => {
  const { b, st } = bundle('1400');
  it('creates a world from the historical dataset', () => {
    const w = newGame(b, st, { name: 'T', seed: 42, start: { y: 1405, m: 0 }, mode: 'scenario', scenarioId: 'timur-east', decisions: { timur_fate: 'survives', campaign: 'invade', ottomans: 'historical' }, player: 'Timurid Empire' });
    expect(w.player).toBeTruthy();
    const pop = Object.values(w.countries).reduce((s, c) => s + c.pop.total, 0);
    expect(pop).toBeGreaterThan(2e8);
    expect(w.countries[w.player!].name).toBe('Timurid Empire');
    expect(Object.values(w.countries).some((c) => c.name === 'Ming Empire')).toBe(true);
  });
  it('is deterministic and save/load resumes identically', () => {
    const mk = () => newGame(b, st, { name: 'D', seed: 7, start: { y: 1405, m: 0 }, mode: 'scenario', scenarioId: 'timur-east', decisions: { timur_fate: 'dies' }, player: 'Timurid Empire' });
    const a = mk(), c = mk();
    c.id = a.id;
    for (let i = 0; i < 24; i++) { advanceMonth(a, st); advanceMonth(c, st); }
    expect(hashWorld(a)).toBe(hashWorld(c));
    const saved = JSON.parse(JSON.stringify(a));
    for (let i = 0; i < 12; i++) { advanceMonth(a, st); advanceMonth(saved, st); }
    expect(hashWorld(a)).toBe(hashWorld(saved));
  });
  it('runs 50 years with live economy, wars, events and timeline', () => {
    const w = newGame(b, st, { name: 'L', seed: 3, start: { y: 1405, m: 0 }, mode: 'scenario', scenarioId: 'timur-east', decisions: { timur_fate: 'survives', campaign: 'invade' }, player: 'Ming Empire' });
    const t0 = Date.now();
    for (let i = 0; i < 600; i++) { advanceMonth(w, st); w.events.pending = []; }
    const ms = (Date.now() - t0) / 600;
    const p = w.countries[w.player!];
    console.log(`avg tick ${ms.toFixed(1)} ms; wars ${w.wars.length}; timeline ${w.timeline.length}; alive ${Object.values(w.countries).filter((c) => c.alive).length}; ${p.name} pop ${(p.pop.total / 1e6).toFixed(1)}M stab ${p.stability.value.toFixed(0)} treasury ${p.economy.treasury.toFixed(0)} tech ${p.tech.known.length}`);
    console.log(w.timeline.slice(0, 40).map((t) => `${t.date.y}-${t.date.m} [${t.kind}] ${t.title}`).join('\n'));
    expect(w.date.y).toBe(1455);
    expect(w.history.length).toBeGreaterThan(40);
    expect(ms).toBeLessThan(120);
  });
  it('validates and applies commands', () => {
    const w = newGame(b, st, { name: 'C', seed: 5, start: { y: 1400, m: 0 }, mode: 'sandbox', player: 'France' });
    const id = w.player!;
    expect(applyCommand(w, { type: 'setTax', country: id, rate: 0.2 }, st).ok).toBe(true);
    expect(w.countries[id].economy.taxRate).toBe(0.2);
    const other = Object.values(w.provinces).find((p) => p.owner && p.owner !== id)!;
    expect(applyCommand(w, { type: 'build', country: id, province: other.id, building: 'farms' }, st).ok).toBe(false);
    const a = answerQuestion(w, 'Why did France become powerful?', id);
    expect(a.paragraphs.length).toBeGreaterThan(0);
    const proj = projectCommands(w, st, id, [{ type: 'setTax', country: id, rate: 0.4 }], 6);
    expect(proj.variant.length).toBe(7);
    expect(proj.variant[6].treasury).toBeGreaterThan(proj.baseline[6].treasury);
  });
  it('supports every scenario', async () => {
    const { SCENARIOS } = await import('../data/scenarios');
    for (const s of SCENARIOS) {
      const { b: bb, st: ss } = bundle(s.mapKey);
      const decisions = Object.fromEntries(s.decisions.map((d) => [d.id, d.options[0].id]));
      const w = newGame(bb, ss, { name: s.id, seed: 11, start: s.start, mode: 'scenario', scenarioId: s.id, decisions, player: s.recommended });
      expect(w.player, s.id).toBeTruthy();
      for (const f of s.focusCountries) expect(Object.values(w.countries).some((c) => c.name === f), `${s.id}:${f}`).toBe(true);
      for (let i = 0; i < 36; i++) { advanceMonth(w, ss); w.events.pending = []; }
      const cl = cloneWorld(w);
      expect(cl.date.y).toBe(w.date.y);
    }
  });
});
