import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';

export interface ProfileStats { gamesStarted: number; monthsSimulated: number; scenariosCompleted: string[]; worldsCreated: number; warsFought: number; }
export interface ProfileState {
  displayName: string; userId: string | null; email: string | null;
  achievements: Record<string, string>; // id -> ISO date unlocked
  favorites: string[]; stats: ProfileStats;
  unlock: (ids: string[]) => void; toggleFavorite: (id: string) => void; bump: (p: Partial<Record<keyof ProfileStats, number>>) => void;
  completeScenario: (id: string) => void; setIdentity: (p: { displayName?: string; userId?: string | null; email?: string | null }) => void;
}
export const useProfile = create<ProfileState>()(persist((set, get) => ({
  displayName: 'Chronicler', userId: null, email: null, achievements: {}, favorites: [],
  stats: { gamesStarted: 0, monthsSimulated: 0, scenariosCompleted: [], worldsCreated: 0, warsFought: 0 },
  unlock: (ids) => { const a = { ...get().achievements }; let changed = false; for (const id of ids) if (!a[id]) { a[id] = new Date().toISOString(); changed = true; } if (changed) { set({ achievements: a }); void syncProfile(); } },
  toggleFavorite: (id) => set({ favorites: get().favorites.includes(id) ? get().favorites.filter((x) => x !== id) : [...get().favorites, id] }),
  bump: (p) => { const s = { ...get().stats }; for (const [k, v] of Object.entries(p)) if (k !== 'scenariosCompleted') (s as unknown as Record<string, number>)[k] += v ?? 0; set({ stats: s }); },
  completeScenario: (id) => { const s = get().stats; if (!s.scenariosCompleted.includes(id)) set({ stats: { ...s, scenariosCompleted: [...s.scenariosCompleted, id] } }); },
  setIdentity: (p) => set(p),
}), { name: 'whatif-profile' }));

/** Pushes profile & achievements to Supabase when signed in (RLS restricts rows to the owner). */
export async function syncProfile(): Promise<void> {
  const p = useProfile.getState();
  if (!supabase || !p.userId) return;
  await supabase.from('profiles').upsert({ id: p.userId, display_name: p.displayName, stats: p.stats, favorites: p.favorites, updated_at: new Date().toISOString() });
  const rows = Object.entries(p.achievements).map(([achievement_id, unlocked_at]) => ({ user_id: p.userId, achievement_id, unlocked_at }));
  if (rows.length) await supabase.from('achievements').upsert(rows, { onConflict: 'user_id,achievement_id' });
}
