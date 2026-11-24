import { gzip, ungzip } from 'pako';
import type { FlagDesign, World } from '../types/game';
import { idb } from './idb';
import { supabase } from './supabase';
import { useProfile } from './profile';
import { migrateWorld } from '../engine/serialize';
import { fmtDate } from '../engine/date';

export interface SaveMeta {
  slot: string; name: string; worldName: string; date: string; year: number; playerName: string | null; playerFlag: FlagDesign | null;
  mode: World['mode']; scenarioId: string | null; savedAt: string; sizeBytes: number; auto: boolean; months: number; cloud?: boolean;
}

export function compressWorld(w: World): Uint8Array { return gzip(JSON.stringify(w)); }
export function decompressWorld(data: Uint8Array): World { return migrateWorld(JSON.parse(new TextDecoder().decode(ungzip(data)))); }

function metaOf(w: World, slot: string, name: string, size: number, auto: boolean): SaveMeta {
  const p = w.player ? w.countries[w.player] : null;
  return {
    slot, name, worldName: w.name, date: fmtDate(w.date), year: w.date.y, playerName: p?.name ?? null, playerFlag: p?.flag ?? null,
    mode: w.mode, scenarioId: w.scenarioId, savedAt: new Date().toISOString(), sizeBytes: size, auto,
    months: (w.date.y - w.startDate.y) * 12 + (w.date.m - w.startDate.m),
  };
}

export async function saveWorld(w: World, slot: string, name: string, auto = false): Promise<SaveMeta> {
  const data = compressWorld(w);
  const meta = metaOf(w, slot, name, data.byteLength, auto);
  await idb.set('saves', slot, data);
  await idb.set('meta', slot, meta);
  void uploadCloud(slot, data, meta).catch(() => undefined);
  return meta;
}
export async function loadWorld(slot: string): Promise<World> {
  const data = await idb.get<Uint8Array>('saves', slot);
  if (!data) {
    const cloud = await downloadCloud(slot);
    if (!cloud) throw new Error('Save not found.');
    return decompressWorld(cloud);
  }
  return decompressWorld(data);
}
export async function listSaves(): Promise<SaveMeta[]> {
  const local = (await idb.all<SaveMeta>('meta').catch(() => [] as SaveMeta[])) ?? [];
  const cloud = await listCloud().catch(() => [] as SaveMeta[]);
  const bySlot = new Map(local.map((m) => [m.slot, m]));
  for (const c of cloud) if (!bySlot.has(c.slot)) bySlot.set(c.slot, { ...c, cloud: true });
  return Array.from(bySlot.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export async function renameSave(slot: string, name: string): Promise<void> {
  const m = await idb.get<SaveMeta>('meta', slot);
  if (!m) throw new Error('Save not found.');
  await idb.set('meta', slot, { ...m, name });
  if (supabase && useProfile.getState().userId) await supabase.from('saved_games').update({ name }).eq('slot', slot).eq('user_id', useProfile.getState().userId!);
}
export async function deleteSave(slot: string): Promise<void> {
  await idb.del('saves', slot); await idb.del('meta', slot);
  const uid = useProfile.getState().userId;
  if (supabase && uid) { await supabase.storage.from('saves').remove([`${uid}/${slot}.wif`]); await supabase.from('saved_games').delete().eq('slot', slot).eq('user_id', uid); }
}
export async function latestSave(): Promise<SaveMeta | null> { const l = await listSaves(); return l[0] ?? null; }

export function downloadSaveFile(w: World): void {
  const blob = new Blob([compressWorld(w) as BlobPart], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${w.name.replace(/[^\w-]+/g, '_')}_${w.date.y}.wif`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function importSaveFile(file: File): Promise<World> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const w = decompressWorld(buf);
  if (!w.provinces || !w.countries || !w.date) throw new Error('Not a valid WHAT IF? save file.');
  return w;
}

// ---- Supabase cloud sync (only when signed in) ----
async function uploadCloud(slot: string, data: Uint8Array, meta: SaveMeta): Promise<void> {
  const uid = useProfile.getState().userId;
  if (!supabase || !uid) return;
  const path = `${uid}/${slot}.wif`;
  const up = await supabase.storage.from('saves').upload(path, data, { upsert: true, contentType: 'application/octet-stream' });
  if (up.error) throw up.error;
  await supabase.from('saved_games').upsert({ user_id: uid, slot, name: meta.name, storage_path: path, metadata: meta, simulation_date: meta.date, size_bytes: meta.sizeBytes, is_autosave: meta.auto, updated_at: meta.savedAt }, { onConflict: 'user_id,slot' });
}
async function downloadCloud(slot: string): Promise<Uint8Array | null> {
  const uid = useProfile.getState().userId;
  if (!supabase || !uid) return null;
  const { data, error } = await supabase.storage.from('saves').download(`${uid}/${slot}.wif`);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
async function listCloud(): Promise<SaveMeta[]> {
  const uid = useProfile.getState().userId;
  if (!supabase || !uid) return [];
  const { data } = await supabase.from('saved_games').select('metadata').eq('user_id', uid).order('updated_at', { ascending: false }).limit(50);
  return (data ?? []).map((r) => r.metadata as SaveMeta);
}
