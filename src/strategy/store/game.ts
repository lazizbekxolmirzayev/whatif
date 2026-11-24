import { create } from 'zustand';
import type { Command, CommandResult, MapStatic, World } from '../types/game';
import { advanceMonth, applyCommand, newGame, type CreateOptions, hashWorld } from '../engine';
import { loadBundle, loadStatic } from '../services/mapData';
import { saveWorld } from '../services/saves';
import { useSettings } from '../services/settings';
import { useProfile } from '../services/profile';
import { sfx } from '../services/audio';
import { ACHIEVEMENTS } from '../engine/achievements';
import type { ScenarioDefinition } from '../types/game';

export type MapMode = 'political' | 'terrain' | 'economy' | 'population' | 'stability' | 'food' | 'diplomacy' | 'technology' | 'military';
export type Speed = 0 | 1 | 2 | 5 | 10;
export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'bad' | 'event' }

/** Remote command transport for online multiplayer (set by the multiplayer service). */
export interface RemoteTransport { send: (cmd: Command) => Promise<CommandResult>; slot: string; roomId: string; mode: 'online' | 'hotseat' }

interface GameStore {
  world: World | null; st: MapStatic | null;
  version: number; mapVersion: number; ownerSig: string;
  speed: Speed; selectedProvince: number | null; selectedCountry: string | null; mapMode: MapMode;
  toasts: Toast[]; loading: string | null; error: string | null; lastAutosave: number; busy: boolean;
  remote: RemoteTransport | null;
  startGame: (key: string, opts: CreateOptions, custom?: ScenarioDefinition | null) => Promise<World>;
  setWorld: (w: World) => Promise<void>;
  closeGame: () => void;
  tick: (n?: number) => void;
  advance: (months: number, onProgress?: (done: number) => void) => Promise<void>;
  setSpeed: (s: Speed) => void;
  select: (province: number | null, country?: string | null) => void;
  setMapMode: (m: MapMode) => void;
  dispatch: (cmd: Command) => Promise<CommandResult>;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
  bump: () => void;
  setRemote: (r: RemoteTransport | null) => void;
}

let toastId = 0;
function sig(w: World): string {
  let h = 2166136261;
  for (const p of w.provinces) { const s = (p.owner ?? '') + (p.controller ?? ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 124; }
  return (h >>> 0).toString(36) + w.countryOrder.length;
}

export const useGame = create<GameStore>((set, get) => ({
  world: null, st: null, version: 0, mapVersion: 0, ownerSig: '',
  speed: 0, selectedProvince: null, selectedCountry: null, mapMode: 'political',
  toasts: [], loading: null, error: null, lastAutosave: 0, busy: false, remote: null,

  async startGame(key, opts, custom) {
    set({ loading: 'Forging the world', error: null });
    try {
      const { bundle, st } = await loadBundle(key);
      const w = newGame(bundle, st, opts, custom);
      useProfile.getState().bump({ gamesStarted: 1, worldsCreated: 1 });
      set({ world: w, st, version: 1, mapVersion: 1, ownerSig: sig(w), speed: 0, selectedCountry: w.player, selectedProvince: w.player ? w.countries[w.player].capital : null, loading: null, lastAutosave: 0, remote: null });
      return w;
    } catch (e) {
      set({ loading: null, error: (e as Error).message });
      throw e;
    }
  },
  async setWorld(w) {
    set({ loading: 'Restoring the world' });
    const { st } = await loadStatic();
    set({ world: w, st, version: get().version + 1, mapVersion: get().mapVersion + 1, ownerSig: sig(w), speed: 0, selectedCountry: w.player, selectedProvince: w.player ? w.countries[w.player]?.capital ?? null : null, loading: null, lastAutosave: 0 });
  },
  closeGame() { set({ world: null, speed: 0, selectedCountry: null, selectedProvince: null, remote: null }); },

  tick(n = 1) {
    const { world: w, st } = get();
    if (!w || !st) return;
    const newAch: string[] = [];
    const pendingBefore = w.events.pending.length;
    const warsBefore = w.wars.filter((x) => !x.ended && w.player && (x.attackers.includes(w.player) || x.defenders.includes(w.player))).length;
    for (let i = 0; i < n; i++) newAch.push(...advanceMonth(w, st));
    useProfile.getState().bump({ monthsSimulated: n });
    const s = sig(w);
    const patch: Partial<GameStore> = { version: get().version + 1 };
    if (s !== get().ownerSig) { patch.ownerSig = s; patch.mapVersion = get().mapVersion + 1; }
    set(patch);
    const settings = useSettings.getState();
    if (newAch.length) {
      useProfile.getState().unlock(newAch);
      for (const id of newAch) get().toast(`Achievement unlocked: ${ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id}`, 'good');
      sfx('success');
    }
    if (w.events.pending.length > pendingBefore) { sfx('event'); if (settings.autoPauseEvents) set({ speed: 0 }); }
    const warsNow = w.wars.filter((x) => !x.ended && w.player && (x.attackers.includes(w.player) || x.defenders.includes(w.player))).length;
    if (warsNow > warsBefore) { sfx('war'); get().toast('War! Your country is now at war.', 'bad'); useProfile.getState().bump({ warsFought: 1 }); if (settings.autoPauseWar) set({ speed: 0 }); }
    if (w.player && !w.countries[w.player]?.alive) { set({ speed: 0 }); get().toast('Your nation has fallen. You may keep observing the world.', 'bad'); }
    const t = w.stats.ticks;
    if (settings.autosaveMonths > 0 && t - get().lastAutosave >= settings.autosaveMonths && get().remote?.mode !== 'online') {
      set({ lastAutosave: t });
      void saveWorld(w, 'autosave', 'Autosave', true).catch(() => undefined);
    }
  },

  async advance(months, onProgress) {
    if (get().busy) return;
    set({ busy: true, speed: 0 });
    let done = 0;
    while (done < months) {
      const w = get().world;
      if (!w) break;
      const chunk = Math.min(3, months - done);
      get().tick(chunk);
      done += chunk;
      onProgress?.(done);
      if (w.events.pending.length && useSettings.getState().autoPauseEvents) break;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    set({ busy: false });
  },

  setSpeed(s) { set({ speed: s }); },
  select(province, country) {
    const w = get().world;
    const c = country !== undefined ? country : province !== null && w ? w.provinces[province]?.owner ?? null : null;
    set({ selectedProvince: province, selectedCountry: c });
  },
  setMapMode(m) { set({ mapMode: m }); },

  async dispatch(cmd) {
    const { world: w, st, remote } = get();
    if (!w || !st) return { ok: false, message: 'No game loaded.' };
    let res: CommandResult;
    if (remote && remote.mode === 'online') { res = await remote.send(cmd); if (res.ok) applyCommand(w, cmd, st); }
    else res = applyCommand(w, cmd, st);
    const s = sig(w);
    set({ version: get().version + 1, ...(s !== get().ownerSig ? { ownerSig: s, mapVersion: get().mapVersion + 1 } : {}) });
    get().toast(res.message, res.ok ? 'good' : 'bad');
    if (res.ok) sfx('click');
    return res;
  },
  toast(text, tone = 'info') {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-4), { id, text, tone }] });
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss(id) { set({ toasts: get().toasts.filter((t) => t.id !== id) }); },
  bump() { const w = get().world; set({ version: get().version + 1, ...(w ? { ownerSig: sig(w), mapVersion: get().mapVersion + 1 } : {}) }); },
  setRemote(r) { set({ remote: r }); },
}));

export function useWorld(): World | null {
  useGame((s) => s.version);
  return useGame((s) => s.world);
}
export function worldHash(): string { const w = useGame.getState().world; return w ? hashWorld(w) : ''; }
