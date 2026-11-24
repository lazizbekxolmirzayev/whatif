// Server-authoritative multiplayer. Browsers send intents; this function validates them
// against the caller's assigned country, applies them with the shared engine and advances
// the world when every player has ended the turn. Clients never decide outcomes.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gzip, ungzip } from 'https://esm.sh/pako@2.1.0';
import { cors, json } from '../_shared/cors.ts';
// deno-lint-ignore no-explicit-any
import * as engine from '../_shared/engine.js';

type World = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const mapCache = new Map<string, unknown>();

async function gameData(sb: SupabaseClient, file: string) {
  if (mapCache.has(file)) return mapCache.get(file);
  const { data, error } = await sb.storage.from('game-data').download(file);
  if (error || !data) throw new Error(`game-data/${file} missing — upload public/maps/* to the game-data bucket`);
  const parsed = JSON.parse(await data.text());
  mapCache.set(file, parsed);
  return parsed;
}
async function mapStatic(sb: SupabaseClient, key: string) {
  const [topo, meta, owners] = await Promise.all([gameData(sb, 'provinces.topo.json'), gameData(sb, 'provinces_meta.json'), gameData(sb, `owners_${key}.json`)]);
  const { st, drawn } = engine.buildMapStatic(key, topo, meta);
  return { st, bundle: { key, meta, owners, static: st, drawn } };
}
async function loadWorld(sb: SupabaseClient, path: string): Promise<World> {
  const { data, error } = await sb.storage.from('worlds').download(path);
  if (error || !data) throw new Error('world snapshot missing');
  return JSON.parse(new TextDecoder().decode(ungzip(new Uint8Array(await data.arrayBuffer()))));
}
async function storeWorld(sb: SupabaseClient, roomId: string, w: World, worldId: string | null, expectedVersion: number | null) {
  const path = `${roomId}/world.wif`;
  const up = await sb.storage.from('worlds').upload(path, gzip(JSON.stringify(w)), { upsert: true, contentType: 'application/octet-stream' });
  if (up.error) throw up.error;
  const row = { room_id: roomId, name: w.name, mode: 'multiplayer', scenario_id: w.scenarioId, map_key: w.mapKey, seed: w.seed, sim_year: w.date.y, sim_month: w.date.m, storage_path: path, state_hash: engine.hashWorld(w), updated_at: new Date().toISOString() };
  if (!worldId) {
    const { data, error } = await sb.from('game_worlds').insert({ ...row, version: 1 }).select('id').single();
    if (error) throw error;
    return { path, worldId: data.id as string };
  }
  const { data, error } = await sb.from('game_worlds').update({ ...row, version: (expectedVersion ?? 0) + 1 }).eq('id', worldId).eq('version', expectedVersion).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Concurrent update detected — please retry');
  return { path, worldId };
}
/** Normalised summary rows for queries (timeline, statistics). */
async function writeSummaries(sb: SupabaseClient, worldId: string, w: World) {
  const year = w.date.y;
  const alive = Object.values(w.countries).filter((c: any) => c.alive && !c.tribal) as any[];
  const top = alive.sort((a, b) => b.pop.total - a.pop.total).slice(0, 80);
  const players = new Set(Object.values(w.players));
  await sb.from('countries').upsert(top.map((c) => ({ world_id: worldId, country_id: c.id, name: c.name, government: c.government, color: c.color, flag: c.flag, alive: c.alive, overlord_id: c.overlord, is_player: players.has(c.id), capital_province: c.capital, updated_at: new Date().toISOString() })));
  await sb.from('economy_state').upsert(top.map((c) => ({ world_id: worldId, country_id: c.id, year, treasury: c.economy.treasury, gdp: c.economy.gdp, income: c.economy.income, expenses: c.economy.expenses, tax_rate: c.economy.taxRate, inflation: c.economy.inflation, debt: c.economy.debt })));
  await sb.from('population_state').upsert(top.map((c) => ({ world_id: worldId, country_id: c.id, year, population: Math.round(c.pop.total), growth_rate: c.pop.growthRate, urbanization: c.pop.urbanization, famine_deaths: Math.round(c.pop.famineDeaths), epidemic_deaths: Math.round(c.pop.epidemicDeaths), war_deaths: Math.round(c.pop.warDeaths) })));
  await sb.from('food_state').upsert(top.map((c) => ({ world_id: worldId, country_id: c.id, year, production: c.food.production, consumption: c.food.consumption, stock: c.food.stock, shortage: c.food.shortage })));
  await sb.from('technology_state').upsert(top.map((c) => ({ world_id: worldId, country_id: c.id, year, tech_level: engine.techLevel(c.tech.known), known: c.tech.known, researching: c.tech.researching, education: c.tech.education })));
  await sb.from('provinces').upsert(w.provinces.filter((p: any) => p.owner).map((p: any) => ({ world_id: worldId, province_id: p.id, name: p.name, owner_id: p.owner, controller_id: p.controller, population: Math.round(p.pop), development: p.dev, buildings: { roads: p.roads, port: p.port, farms: p.farms, market: p.market, buildings: p.buildings, fort: p.fort }, unrest: p.unrest })));
  const rel = Object.entries(w.relations).map(([k, r]: [string, any]) => { const [a, b] = k.split('|'); return { world_id: worldId, country_a: a, country_b: b, opinion: Math.max(-200, Math.min(200, r.opinion)), trust: r.trust }; });
  for (let i = 0; i < rel.length; i += 500) await sb.from('country_relations').upsert(rel.slice(i, i + 500));
  await sb.from('diplomacy').delete().eq('world_id', worldId);
  const dip: any[] = [];
  for (const [k, r] of Object.entries(w.relations) as [string, any][]) { const [a, b] = k.split('|'); for (const t of Object.keys(r.treaties)) dip.push({ world_id: worldId, country_a: a, country_b: b, kind: t, since_year: r.treaties[t].since.y, since_month: r.treaties[t].since.m }); }
  for (const war of w.wars.filter((x: any) => !x.ended)) dip.push({ world_id: worldId, country_a: war.attackers[0], country_b: war.defenders[0], kind: 'war', since_year: war.start.y, since_month: war.start.m, details: { name: war.name, score: war.score } });
  if (dip.length) await sb.from('diplomacy').insert(dip.slice(0, 2000));
  const tl = w.timeline.filter((t: any) => t.importance >= 2).slice(-200).map((t: any) => ({ world_id: worldId, event_key: t.id, year: t.date.y, month: t.date.m, kind: t.kind, title: t.title.slice(0, 300), description: t.text.slice(0, 2000), countries: t.countries, is_documented: t.factual, importance: t.importance }));
  if (tl.length) await sb.from('timeline_events').upsert(tl, { onConflict: 'world_id,event_key' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: 'Not signed in' }, 401);
    const { data: allowed } = await sb.rpc('check_rate_limit', { p_user: user.id, p_action: 'mp', p_max: 240, p_window_seconds: 60 });
    if (!allowed) return json({ error: 'Too many requests' }, 429);
    const body = await req.json();
    const roomId = String(body.roomId ?? '');
    const { data: room } = await sb.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (!room) return json({ error: 'Room not found' }, 404);
    const { data: players } = await sb.from('multiplayer_players').select('*').eq('room_id', roomId);
    const me = (players ?? []).find((p: any) => p.user_id === user.id);
    if (!me) return json({ error: 'You are not in this room' }, 403);
    const { data: worldRow } = await sb.from('game_worlds').select('id, version').eq('room_id', roomId).maybeSingle();

    if (body.action === 'start') {
      if (room.host_id !== user.id) return json({ error: 'Only the host can start' }, 403);
      if (room.status !== 'lobby') return json({ error: 'Already started' }, 409);
      if ((players ?? []).length < 2 || (players ?? []).some((p: any) => !p.ready || !p.country_name)) return json({ error: 'All players must pick a country and be ready' }, 400);
      const { st, bundle } = await mapStatic(sb, room.map_key);
      const sc = room.scenario_id ? engine.SCENARIO_BY_ID[room.scenario_id] : null;
      const decisions = sc ? Object.fromEntries(sc.decisions.map((d: any) => [d.id, d.options.find((o: any) => o.historical)?.id ?? d.options[0].id])) : {};
      const seed = Math.floor(Math.random() * 2 ** 31);
      const w = engine.newGame(bundle, st, { name: room.name, seed, start: sc?.start ?? { y: room.start_year, m: 0 }, mode: 'multiplayer', scenarioId: sc?.id ?? null, decisions, player: null });
      for (const p of players as any[]) {
        const c = Object.values(w.countries).find((x: any) => x.name === p.country_name) as any;
        if (!c) return json({ error: `Country ${p.country_name} not found in dataset` }, 400);
        w.players[p.user_id] = c.id;
        await sb.from('multiplayer_players').update({ country_id: c.id, submitted_turn: 0 }).eq('room_id', roomId).eq('user_id', p.user_id);
      }
      const { path, worldId } = await storeWorld(sb, roomId, w, null, null);
      await writeSummaries(sb, worldId, w);
      await sb.from('multiplayer_rooms').update({ status: 'playing', turn_number: 1, world_path: path }).eq('id', roomId);
      return json({ ok: true });
    }

    if (room.status !== 'playing' || !worldRow) return json({ error: 'Game is not running' }, 409);
    const w = await loadWorld(sb, room.world_path);
    const { st } = await mapStatic(sb, room.map_key);

    if (body.action === 'command') {
      const cmd = body.command;
      if (!cmd || typeof cmd.type !== 'string') return json({ error: 'Invalid command' }, 400);
      if (cmd.country !== me.country_id) return json({ ok: false, message: 'You can only command your own country.' }, 403);
      if (me.submitted_turn >= room.turn_number) return json({ ok: false, message: 'You already ended this turn.' }, 409);
      w.player = me.country_id; // perspective for player-only rules (events, offers)
      const res = engine.applyCommand(w, cmd, st);
      w.player = null;
      if (res.ok) await storeWorld(sb, roomId, w, worldRow.id, worldRow.version);
      return json(res);
    }

    if (body.action === 'endTurn') {
      await sb.from('multiplayer_players').update({ submitted_turn: room.turn_number }).eq('room_id', roomId).eq('user_id', user.id);
      const { data: ps } = await sb.from('multiplayer_players').select('submitted_turn').eq('room_id', roomId);
      const all = (ps ?? []).every((p: any) => p.submitted_turn >= room.turn_number);
      if (!all) return json({ ok: true, advanced: false });
      // unresolved player events are auto-resolved with their first option so the world can advance
      for (const pe of [...w.events.pending]) {
        const ow = w.player; w.player = pe.country;
        engine.applyCommand(w, { type: 'eventChoice', country: pe.country, uid: pe.uid, option: pe.options[0].id }, st);
        w.player = ow;
      }
      for (let i = 0; i < room.turn_months; i++) engine.advanceMonth(w, st);
      const { worldId } = await storeWorld(sb, roomId, w, worldRow.id, worldRow.version);
      await writeSummaries(sb, worldId, w);
      await sb.from('multiplayer_rooms').update({ turn_number: room.turn_number + 1 }).eq('id', roomId);
      return json({ ok: true, advanced: true });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
