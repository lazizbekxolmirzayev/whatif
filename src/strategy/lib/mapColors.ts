import type { World } from '../types/game';
import type { MapMode } from '../store/game';
import { techLevel } from '../data/technologies';
import { peekRelation } from '../engine/util';

const UNOWNED_P = '#cbb88f', UNOWNED_D = '#3b3a35';
function hexToRgb(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r: number, g: number, b: number): string { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a: string, b: string, t: number): string { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
function desat(h: string, t: number): string { const [r, g, b] = hexToRgb(h); const l = (r + g + b) / 3; return rgbToHex(r + (l - r) * t, g + (l - g) * t, b + (l - b) * t); }
/** Sequential palette: deep red → amber → parchment → verdigris */
export function ramp(t: number): string {
  t = Math.max(0, Math.min(1, t));
  const stops = ['#7c271f', '#b8573a', '#d9a55c', '#cfc28a', '#7fa87a', '#3a8371'];
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  return mix(stops[i], stops[i + 1], t * (stops.length - 1) - i);
}

export function computeFills(w: World, mode: MapMode, selected: string | null, parchment: boolean): string[] {
  const out = new Array<string>(w.provinces.length);
  const unowned = parchment ? UNOWNED_P : UNOWNED_D;
  let maxDensity = 1, maxGdpPc = 1e-9;
  if (mode === 'population') for (const p of w.provinces) maxDensity = Math.max(maxDensity, Math.log10(1 + p.pop / Math.max(50, p.area)));
  const gdpPc: Record<string, number> = {};
  if (mode === 'economy') for (const c of Object.values(w.countries)) if (c.alive && c.pop.total > 0) { gdpPc[c.id] = c.economy.gdp / c.pop.total; maxGdpPc = Math.max(maxGdpPc, gdpPc[c.id]); }
  let maxArmy = 1;
  if (mode === 'military') for (const c of Object.values(w.countries)) if (c.alive) maxArmy = Math.max(maxArmy, Math.log10(1 + c.military.regiments));
  for (const p of w.provinces) {
    const c = p.owner ? w.countries[p.owner] : null;
    if (!c) { out[p.id] = mode === 'terrain' ? terrain(p) : unowned; continue; }
    switch (mode) {
      case 'political': {
        let col = c.color;
        if (c.overlord && w.countries[c.overlord]) col = mix(col, w.countries[c.overlord].color, 0.45);
        if (c.tribal) col = desat(mix(col, unowned, 0.45), 0.5);
        if (selected && c.id !== selected && selected === c.overlord) col = mix(col, '#ffffff', 0.12);
        out[p.id] = parchment ? mix(col, '#e3d2a8', 0.18) : col;
        break;
      }
      case 'terrain': out[p.id] = terrain(p); break;
      case 'population': out[p.id] = ramp(Math.log10(1 + p.pop / Math.max(50, p.area)) / maxDensity); break;
      case 'economy': out[p.id] = ramp(Math.sqrt((gdpPc[c.id] ?? 0) / maxGdpPc)); break;
      case 'stability': out[p.id] = ramp(1 - p.unrest / 100); break;
      case 'food': { const r = c.food.consumption > 0 ? c.food.production / c.food.consumption : 1; out[p.id] = ramp((r - 0.85) / 0.4); break; }
      case 'technology': out[p.id] = ramp(techLevel(c.tech.known) / 6); break;
      case 'military': out[p.id] = ramp(Math.log10(1 + c.military.regiments) / maxArmy); break;
      case 'diplomacy': {
        if (!selected) { out[p.id] = desat(c.color, 0.6); break; }
        if (c.id === selected) { out[p.id] = '#e8d08a'; break; }
        const r = peekRelation(w, selected, c.id);
        const atWar = w.wars.some((x) => !x.ended && ((x.attackers.includes(selected) && x.defenders.includes(c.id)) || (x.defenders.includes(selected) && x.attackers.includes(c.id))));
        if (atWar) out[p.id] = '#a3362c';
        else if (c.overlord === selected) out[p.id] = '#c9a640';
        else if (r?.treaties.alliance) out[p.id] = '#2f8f6a';
        else if (r?.treaties.nap || r?.treaties.trade) out[p.id] = '#5f9fae';
        else out[p.id] = r ? ramp((r.opinion + 100) / 200) : desat(c.color, 0.75);
        break;
      }
    }
  }
  return out;
}
function terrain(p: { desert: boolean; mountain: boolean; river: boolean; lat: number }): string {
  if (Math.abs(p.lat) > 62) return '#dfe6e8';
  if (p.desert) return '#d8b878';
  if (p.mountain) return '#8f8066';
  if (p.river) return '#6f9a5a';
  if (Math.abs(p.lat) < 15) return '#4f8a4a';
  return '#8fae6a';
}

export const MAP_MODES: { id: MapMode; label: string; legend: string }[] = [
  { id: 'political', label: 'Political', legend: 'Countries; vassals tinted toward their overlord; tribal lands muted.' },
  { id: 'terrain', label: 'Terrain', legend: 'Deserts, mountains, river valleys, tropics and polar lands.' },
  { id: 'population', label: 'Population', legend: 'Population density (log scale).' },
  { id: 'economy', label: 'Economy', legend: 'GDP per capita by country.' },
  { id: 'stability', label: 'Unrest', legend: 'Green = calm, red = high unrest.' },
  { id: 'food', label: 'Food', legend: 'Food production vs consumption.' },
  { id: 'technology', label: 'Technology', legend: 'Technology level (0–6).' },
  { id: 'military', label: 'Military', legend: 'Standing army size (log scale).' },
  { id: 'diplomacy', label: 'Diplomacy', legend: 'Relative to the selected country: gold = self, green = ally, teal = treaty, red = war, gradient = opinion.' },
];
