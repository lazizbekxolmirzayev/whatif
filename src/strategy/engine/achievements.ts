import type { World } from '../types/game';
import { addTimeline } from './util';
import { techLevel } from '../data/technologies';

export interface AchievementDef { id: string; name: string; description: string; category: 'historical' | 'sandbox' | 'general'; check: (w: World) => boolean }

const P = (w: World) => (w.player ? w.countries[w.player] : null);
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_empire', name: 'Build Your First Empire', description: 'Start a sandbox game with your own nation.', category: 'sandbox', check: (w) => w.mode === 'sandbox' && !!P(w)?.alive },
  { id: 'econ_crisis', name: 'Survive an Economic Crisis', description: 'Resolve a fiscal crisis and keep your state alive.', category: 'general', check: (w) => w.stats.crisesSurvived > 0 && !!P(w)?.alive },
  { id: 'powerful', name: 'Develop a Powerful Civilization', description: 'Reach technology level 4 with over 10 million subjects.', category: 'general', check: (w) => { const c = P(w); return !!c && techLevel(c.tech.known) >= 4 && c.pop.total > 1e7; } },
  { id: 'alt_timeline', name: 'Create an Alternative Timeline', description: 'Change a historical decision in a scenario and play 10 years.', category: 'historical', check: (w) => w.mode === 'scenario' && w.timeline.some((t) => t.kind === 'divergence') && w.date.y - w.startDate.y >= 10 },
  { id: 'stability', name: 'Maintain Long-Term Stability', description: 'Keep stability above 60 for 25 consecutive years.', category: 'general', check: (w) => w.stats.stableMonths >= 300 },
  { id: 'century', name: 'A Century of History', description: 'Simulate 100 years in one world.', category: 'general', check: (w) => w.date.y - w.startDate.y >= 100 },
  { id: 'conqueror', name: 'Expanding Horizons', description: 'Double your starting number of provinces.', category: 'general', check: (w) => { const c = P(w); const s = w.ownership[0]; if (!c || !s) return false; const start = s.owners.split(',').filter((x) => x && w.countryOrder[parseInt(x, 36)] === c.id).length; return start > 0 && w.stats.maxProvinces >= start * 2; } },
  { id: 'peacemaker', name: 'Peacemaker', description: 'Hold three non-aggression pacts or alliances at once.', category: 'general', check: (w) => { if (!w.player) return false; let n = 0; for (const [k, r] of Object.entries(w.relations)) if (k.includes(w.player) && (r.treaties.alliance || r.treaties.nap)) n++; return n >= 3; } },
  { id: 'timur_china', name: 'The Unfinished Campaign', description: 'As the Timurids, control a province of Ming China.', category: 'historical', check: (w) => w.scenarioId === 'timur-east' && P(w)?.name === 'Timurid Empire' && w.provinces.some((p) => p.controller === w.player && p.modern === 'China') },
  { id: 'eternal_rome', name: 'Roma Aeterna', description: 'Keep the Western Roman Empire alive past AD 476.', category: 'historical', check: (w) => w.scenarioId === 'rome-endures' && w.date.y > 476 && Object.values(w.countries).some((c) => c.name === 'Western Roman Empire' && c.alive) },
  { id: 'byzantium_1453', name: 'The City Endures', description: 'Byzantium still holds Constantinople after 1453.', category: 'historical', check: (w) => w.scenarioId === 'byzantium-rises' && w.date.y > 1453 && Object.values(w.countries).some((c) => c.name === 'Byzantine Empire' && c.alive) },
  { id: 'inca_1572', name: 'Unconquered Andes', description: 'The Inca Empire survives past 1572.', category: 'historical', check: (w) => w.scenarioId === 'inca-resists' && w.date.y > 1572 && Object.values(w.countries).some((c) => c.name === 'Inca Empire' && c.alive) },
  { id: 'scholar', name: 'House of Wisdom', description: 'Found 5 scientific institutions.', category: 'general', check: (w) => (P(w)?.tech.institutions ?? 0) >= 5 },
];

export function checkAchievements(w: World): string[] {
  const out: string[] = [];
  if (!w.player || w.mode === 'multiplayer') return out;
  for (const a of ACHIEVEMENTS) {
    if (w.achievements.includes(a.id)) continue;
    if (a.check(w)) {
      w.achievements.push(a.id);
      out.push(a.id);
      addTimeline(w, 'player', `Achievement: ${a.name}`, a.description, [w.player], 1);
    }
  }
  return out;
}
