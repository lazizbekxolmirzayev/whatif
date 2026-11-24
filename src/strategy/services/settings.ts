import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  musicVolume: number; sfxVolume: number; musicOn: boolean;
  autosaveMonths: number; autoPauseEvents: boolean; autoPauseWar: boolean;
  showCityLabels: boolean; showRivers: boolean; showTerrain: boolean; showTradeRoutes: boolean; parchmentMap: boolean;
  reduceMotion: boolean; uiScale: number; confirmWar: boolean;
  set: (p: Partial<Omit<Settings, 'set'>>) => void;
}
export const useSettings = create<Settings>()(persist((set) => ({
  musicVolume: 0.35, sfxVolume: 0.5, musicOn: false,
  autosaveMonths: 12, autoPauseEvents: true, autoPauseWar: true,
  showCityLabels: true, showRivers: true, showTerrain: true, showTradeRoutes: true, parchmentMap: true,
  reduceMotion: false, uiScale: 1, confirmWar: true,
  set: (p) => set(p),
}), { name: 'whatif-settings' }));
