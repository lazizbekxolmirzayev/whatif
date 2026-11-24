// Multiplayer: two transports sharing one command pipeline.
//  • Online  — Supabase: rooms/players tables, Realtime chat & presence, and the
//              server-authoritative Edge Function "multiplayer-turn" which validates
//              every command and advances the shared world.
//  • Hot-seat — several players on one device; same validation, local turns.
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Command, CommandResult, World } from '../types/game';
import { supabase } from './supabase';
import { useProfile } from './profile';
import { useGame } from '../store/game';
import { decompressWorld } from './saves';

export interface RoomInfo { id: string; code: string; name: string; status: 'lobby' | 'playing' | 'finished'; host_id: string; map_key: string; start_year: number; scenario_id: string | null; is_public: boolean; max_players: number; turn_number: number; turn_months: number; world_path: string | null }
export interface RoomPlayer { room_id: string; user_id: string; display_name: string; country_name: string | null; ready: boolean; submitted_turn: number }
export interface ChatMsg { from: string; text: string; at: number }

// ---------------- hot-seat ----------------
export interface HotseatPlayer { slot: string; name: string; country: string }
interface HotseatState { active: boolean; players: HotseatPlayer[]; current: number; turnMonths: number; turn: number; chat: ChatMsg[];
  start: (players: HotseatPlayer[], turnMonths: number) => void; endTurn: () => Promise<void>; say: (text: string) => void; stop: () => void }
export const useHotseat = create<HotseatState>((set, get) => ({
  active: false, players: [], current: 0, turnMonths: 6, turn: 1, chat: [],
  start(players, turnMonths) {
    const w = useGame.getState().world;
    if (!w) return;
    w.players = Object.fromEntries(players.map((p) => [p.slot, p.country]));
    w.player = players[0].country;
    w.mode = 'multiplayer';
    set({ active: true, players, current: 0, turnMonths, turn: 1, chat: [{ from: 'System', text: `Hot-seat game started: ${players.map((p) => p.name).join(', ')}. Turn length ${turnMonths} months.`, at: Date.now() }] });
    useGame.getState().setRemote({ mode: 'hotseat', slot: players[0].slot, roomId: 'local', send: async () => ({ ok: false, message: 'unused' }) });
    useGame.getState().bump();
  },
  async endTurn() {
    const { players, current, turnMonths, turn } = get();
    const g = useGame.getState();
    const w = g.world;
    if (!w) return;
    const next = (current + 1) % players.length;
    if (next === 0) { await g.advance(turnMonths); set({ turn: turn + 1 }); }
    w.player = players[next].country;
    set({ current: next, chat: [...get().chat, { from: 'System', text: `${players[next].name}'s turn (${w.countries[players[next].country]?.name}).`, at: Date.now() }] });
    g.setRemote({ mode: 'hotseat', slot: players[next].slot, roomId: 'local', send: async () => ({ ok: false, message: 'unused' }) });
    g.select(w.countries[w.player]?.capital ?? null, w.player);
    g.bump();
  },
  say(text) { const p = get().players[get().current]; set({ chat: [...get().chat, { from: p?.name ?? 'Player', text, at: Date.now() }] }); },
  stop() { set({ active: false }); useGame.getState().setRemote(null); },
}));

// ---------------- online (Supabase) ----------------
function requireCloud() {
  if (!supabase) throw new Error('Online multiplayer requires a Supabase project. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, apply supabase/migrations and deploy the "multiplayer-turn" function. Hot-seat works offline.');
  const uid = useProfile.getState().userId;
  if (!uid) throw new Error('Sign in on the Profile page to play online.');
  return { sb: supabase, uid };
}
const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

export async function createRoom(p: { name: string; mapKey: string; startYear: number; scenarioId: string | null; isPublic: boolean; maxPlayers: number; turnMonths: number }): Promise<RoomInfo> {
  const { sb, uid } = requireCloud();
  const { data, error } = await sb.from('multiplayer_rooms').insert({ code: code(), name: p.name, host_id: uid, map_key: p.mapKey, start_year: p.startYear, scenario_id: p.scenarioId, is_public: p.isPublic, max_players: p.maxPlayers, turn_months: p.turnMonths }).select().single();
  if (error) throw error;
  await joinRoom(data.id);
  return data as RoomInfo;
}
export async function listPublicRooms(): Promise<RoomInfo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('multiplayer_rooms').select('*').eq('is_public', true).eq('status', 'lobby').order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data as RoomInfo[];
}
export async function findByCode(c: string): Promise<RoomInfo> {
  const { sb } = requireCloud();
  const { data, error } = await sb.rpc('find_room_by_code', { p_code: c.trim().toUpperCase() });
  if (error) throw error;
  if (!data) throw new Error('No room with that invitation code.');
  return data as RoomInfo;
}
export async function joinRoom(roomId: string): Promise<void> {
  const { sb, uid } = requireCloud();
  const { error } = await sb.from('multiplayer_players').upsert({ room_id: roomId, user_id: uid, display_name: useProfile.getState().displayName }, { onConflict: 'room_id,user_id' });
  if (error) throw error;
}
export async function leaveRoom(roomId: string): Promise<void> { const { sb, uid } = requireCloud(); await sb.from('multiplayer_players').delete().eq('room_id', roomId).eq('user_id', uid); }
export async function getRoom(roomId: string): Promise<{ room: RoomInfo; players: RoomPlayer[] }> {
  const { sb } = requireCloud();
  const [r, p] = await Promise.all([sb.from('multiplayer_rooms').select('*').eq('id', roomId).single(), sb.from('multiplayer_players').select('*').eq('room_id', roomId)]);
  if (r.error) throw r.error;
  return { room: r.data as RoomInfo, players: (p.data ?? []) as RoomPlayer[] };
}
export async function setMyCountry(roomId: string, country: string | null): Promise<void> { const { sb, uid } = requireCloud(); const { error } = await sb.from('multiplayer_players').update({ country_name: country }).eq('room_id', roomId).eq('user_id', uid); if (error) throw error; }
export async function setReady(roomId: string, ready: boolean): Promise<void> { const { sb, uid } = requireCloud(); await sb.from('multiplayer_players').update({ ready }).eq('room_id', roomId).eq('user_id', uid); }

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { sb } = requireCloud();
  const { data, error } = await sb.functions.invoke('multiplayer-turn', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export const startOnline = (roomId: string) => invoke<{ ok: boolean }>({ action: 'start', roomId });
export const endTurnOnline = (roomId: string) => invoke<{ ok: boolean; advanced: boolean }>({ action: 'endTurn', roomId });
export const sendCommandOnline = (roomId: string, cmd: Command) => invoke<CommandResult>({ action: 'command', roomId, command: cmd });

/** Downloads the authoritative world snapshot for the room. */
export async function fetchRoomWorld(room: RoomInfo): Promise<World> {
  const { sb } = requireCloud();
  if (!room.world_path) throw new Error('The game has not started yet.');
  const { data, error } = await sb.storage.from('worlds').download(room.world_path);
  if (error || !data) throw error ?? new Error('World snapshot missing');
  return decompressWorld(new Uint8Array(await data.arrayBuffer()));
}

/** Realtime: chat broadcast + presence + room/turn changes. */
export function subscribeRoom(roomId: string, on: { chat: (m: ChatMsg) => void; room: () => void; presence: (names: string[]) => void }): () => void {
  if (!supabase) return () => undefined;
  const ch: RealtimeChannel = supabase.channel(`room:${roomId}`, { config: { presence: { key: useProfile.getState().userId ?? 'anon' } } });
  ch.on('broadcast', { event: 'chat' }, ({ payload }) => on.chat(payload as ChatMsg))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_rooms', filter: `id=eq.${roomId}` }, () => on.room())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_players', filter: `room_id=eq.${roomId}` }, () => on.room())
    .on('presence', { event: 'sync' }, () => on.presence(Object.values(ch.presenceState()).flat().map((p) => (p as unknown as { name: string }).name)))
    .subscribe((status) => { if (status === 'SUBSCRIBED') void ch.track({ name: useProfile.getState().displayName }); });
  (subscribeRoom as unknown as { channels: Map<string, RealtimeChannel> }).channels ??= new Map();
  (subscribeRoom as unknown as { channels: Map<string, RealtimeChannel> }).channels.set(roomId, ch);
  return () => { void supabase!.removeChannel(ch); };
}
export function sendChat(roomId: string, text: string): void {
  const ch = (subscribeRoom as unknown as { channels?: Map<string, RealtimeChannel> }).channels?.get(roomId);
  const msg: ChatMsg = { from: useProfile.getState().displayName, text: text.slice(0, 400), at: Date.now() };
  void ch?.send({ type: 'broadcast', event: 'chat', payload: msg });
}
