import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Globe, Lock, Monitor, Plus, RefreshCw } from 'lucide-react';
import { Badge, Button, ErrorBox, Field, Loading, Panel, SectionTitle, Select, Toggle } from '../components/ui';
import { createRoom, findByCode, joinRoom, listPublicRooms, type RoomInfo } from '../services/multiplayer';
import { cloudEnabled } from '../services/supabase';
import { SCENARIOS } from '../data/scenarios';
import { MAP_YEARS, formatYear } from '../data/eras';
import { useProfile } from '../services/profile';

export default function MultiplayerLobby() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(`${useProfile.getState().displayName}'s world`);
  const [scenario, setScenario] = useState(params.get('scenario') ?? '');
  const [mapKey, setMapKey] = useState('1400');
  const [isPublic, setPublic] = useState(true);
  const [maxPlayers, setMax] = useState('4');
  const [turnMonths, setTurn] = useState('6');
  const [codeIn, setCodeIn] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => { setErr(null); setRooms(null); listPublicRooms().then(setRooms).catch((e) => { setErr(e.message); setRooms([]); }); };
  useEffect(load, []);
  const sc = SCENARIOS.find((s) => s.id === scenario);
  const create = async () => {
    setBusy(true); setErr(null);
    try { const r = await createRoom({ name, mapKey: sc?.mapKey ?? mapKey, startYear: sc?.start.y ?? MAP_YEARS.find((m) => m.key === mapKey)!.year, scenarioId: sc?.id ?? null, isPublic, maxPlayers: Number(maxPlayers), turnMonths: Number(turnMonths) }); navigate(`/multiplayer/${r.id}`); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const byCode = async () => { try { const r = await findByCode(codeIn); await joinRoom(r.id); navigate(`/multiplayer/${r.id}`); } catch (e) { setErr((e as Error).message); } };
  return (
    <div>
      <SectionTitle kicker="Multiplayer lobby">Shared worlds, rival nations</SectionTitle>
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-parchment-200/80">Turn-based: every player issues orders for their own country, then ends the turn. Online games are <b>server-authoritative</b> — a Supabase Edge Function validates every order against the player's assigned country and simulates the shared world; browsers never decide outcomes.</p>
      {!cloudEnabled && <div className="mb-5"><ErrorBox error="Online rooms need a configured Supabase project (see README: migrations + 'multiplayer-turn' function). Local hot-seat below works right now." /></div>}
      {err && <div className="mb-5"><ErrorBox error={err} /></div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Create a room" subtitle="Online">
          <div className="space-y-3">
            <Field label="Room name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
            <Field label="Scenario"><Select value={scenario} onChange={setScenario} options={[{ value: '', label: 'Free start (choose map year)' }, ...SCENARIOS.map((s) => ({ value: s.id, label: s.title }))]} /></Field>
            {!sc && <Field label="Map year"><Select value={mapKey} onChange={setMapKey} options={MAP_YEARS.map((m) => ({ value: m.key, label: formatYear(m.year) }))} /></Field>}
            <div className="grid grid-cols-2 gap-2"><Field label="Players"><Select value={maxPlayers} onChange={setMax} options={['2', '3', '4', '6', '8'].map((v) => ({ value: v, label: v }))} /></Field><Field label="Months per turn"><Select value={turnMonths} onChange={setTurn} options={['1', '3', '6', '12'].map((v) => ({ value: v, label: v }))} /></Field></div>
            <Toggle label={isPublic ? 'Public lobby' : 'Private (invitation code only)'} checked={isPublic} onChange={setPublic} />
            <Button variant="gold" className="w-full" loading={busy} disabled={!cloudEnabled} icon={<Plus className="h-4 w-4" />} onClick={() => void create()}>Create room</Button>
          </div>
        </Panel>
        <Panel title="Public lobbies" actions={<button onClick={load} className="text-gold-300"><RefreshCw className="h-4 w-4" /></button>}>
          {rooms === null ? <Loading /> : rooms.length ? rooms.map((r) => (
            <button key={r.id} onClick={() => void joinRoom(r.id).then(() => navigate(`/multiplayer/${r.id}`)).catch((e) => setErr(e.message))} className="mb-2 block w-full rounded bg-ink-950/50 p-2.5 text-left ring-1 ring-gold-700/30 hover:ring-gold-300">
              <div className="flex items-center gap-2 font-semibold"><Globe className="h-4 w-4 text-gold-300" />{r.name}</div>
              <div className="text-xs text-parchment-300/70">{r.scenario_id ? SCENARIOS.find((s) => s.id === r.scenario_id)?.title : `Free start ${formatYear(r.start_year)}`} · up to {r.max_players} · {r.turn_months} mo/turn</div>
            </button>
          )) : <p className="text-sm text-parchment-300/60">No open public rooms.</p>}
          <div className="divider-gold my-3" />
          <div className="label flex items-center gap-1"><Lock className="h-3 w-3" />Join with invitation code</div>
          <div className="flex gap-2"><input className="input uppercase" maxLength={6} value={codeIn} onChange={(e) => setCodeIn(e.target.value)} placeholder="ABC123" /><Button disabled={codeIn.length < 6} onClick={() => void byCode()}>Join</Button></div>
        </Panel>
        <Panel title="Local hot-seat" subtitle="Offline · several players on this device">
          <Monitor className="mb-2 h-8 w-8 text-gold-300" />
          <p className="text-sm text-parchment-200/80">Players take turns on one screen. Each controls their own country; the world advances when everyone has ended their turn. Uses the same validated command pipeline.</p>
          <Button variant="gold" className="mt-4 w-full" onClick={() => navigate(`/multiplayer/local${scenario ? `?scenario=${scenario}` : ''}`)}>Set up hot-seat game</Button>
          <div className="mt-2"><Badge tone="green">Works offline</Badge></div>
        </Panel>
      </div>
    </div>
  );
}
