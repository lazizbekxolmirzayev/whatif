import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Copy, Crown, MessageSquare, Play, Plus, Send, Trash2, Users } from 'lucide-react';
import { Badge, Button, ErrorBox, Field, Loading, Panel, SectionTitle, Select } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import { useDataset } from '../hooks/useDataset';
import { SCENARIOS } from '../data/scenarios';
import { MAP_YEARS, formatYear } from '../data/eras';
import { PROFILES, generatedFlag } from '../data/polities';
import { useGame } from '../store/game';
import { useProfile } from '../services/profile';
import { endTurnOnline, fetchRoomWorld, getRoom, leaveRoom, sendChat, sendCommandOnline, setMyCountry, setReady, startOnline, subscribeRoom, useHotseat, type ChatMsg, type HotseatPlayer, type RoomInfo, type RoomPlayer } from '../services/multiplayer';

export default function MultiplayerRoom() {
  const { roomId = '' } = useParams();
  return roomId === 'local' ? <Hotseat /> : <Online roomId={roomId} />;
}

function CountryPicker({ mapKey, value, onChange, taken }: { mapKey: string; value: string; onChange: (v: string) => void; taken: string[] }) {
  const { data } = useDataset(mapKey);
  const opts = useMemo(() => (data?.polities ?? []).filter((p) => !p.tribal && p.provinces >= 2), [data]);
  return <Select value={value} onChange={onChange} options={[{ value: '', label: '— choose a country —' }, ...opts.map((p) => ({ value: p.name, label: `${p.name}${taken.includes(p.name) && p.name !== value ? ' (taken)' : ''}` }))]} />;
}

function Hotseat() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const startGame = useGame((s) => s.startGame);
  const hs = useHotseat();
  const [scenario, setScenario] = useState(params.get('scenario') ?? '');
  const [mapKey, setMapKey] = useState('1400');
  const [turn, setTurn] = useState('6');
  const [players, setPlayers] = useState<HotseatPlayer[]>([{ slot: 'p1', name: 'Player 1', country: '' }, { slot: 'p2', name: 'Player 2', country: '' }]);
  const [msg, setMsg] = useState('');
  const sc = SCENARIOS.find((s) => s.id === scenario);
  const key = sc?.mapKey ?? mapKey;
  const year = sc?.start.y ?? MAP_YEARS.find((m) => m.key === mapKey)!.year;
  const valid = players.length >= 2 && players.every((p) => p.country && p.name.trim()) && new Set(players.map((p) => p.country)).size === players.length;
  const start = async () => {
    const decisions = sc ? Object.fromEntries(sc.decisions.map((d) => [d.id, d.options.find((o) => o.historical)?.id ?? d.options[0].id])) : {};
    const w = await startGame(key, { name: `Hot-seat: ${sc?.title ?? formatYear(year)}`, start: sc?.start ?? { y: year, m: 0 }, mode: sc ? 'scenario' : 'sandbox', scenarioId: sc?.id ?? null, decisions, player: players[0].country });
    const mapped = players.map((p) => ({ ...p, country: Object.values(w.countries).find((c) => c.name === p.country)?.id ?? '' })).filter((p) => p.country);
    hs.start(mapped, Number(turn));
    navigate('/game');
  };
  return (
    <div>
      <SectionTitle kicker="Multiplayer · hot-seat">Local game room</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel title="Players" subtitle="Each player controls a different country." actions={<Button size="sm" disabled={players.length >= 8} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPlayers([...players, { slot: `p${players.length + 1}`, name: `Player ${players.length + 1}`, country: '' }])}>Add</Button>}>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={p.slot} className="grid grid-cols-[auto_1fr_1.4fr_auto] items-center gap-2">
                {p.country ? <Flag flag={PROFILES[p.country]?.flag ?? generatedFlag(p.country)} className="h-6 w-9" /> : <Users className="h-5 w-5 text-parchment-300" />}
                <input className="input" value={p.name} onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <CountryPicker mapKey={key} value={p.country} taken={players.map((x) => x.country)} onChange={(v) => setPlayers(players.map((x, j) => (j === i ? { ...x, country: v } : x)))} />
                <button disabled={players.length <= 2} onClick={() => setPlayers(players.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-blood-400" /></button>
              </div>
            ))}
          </div>
          {!valid && <p className="mt-3 text-xs text-blood-400">Every player needs a name and a unique country.</p>}
        </Panel>
        <Panel title="World">
          <div className="space-y-3">
            <Field label="Scenario"><Select value={scenario} onChange={setScenario} options={[{ value: '', label: 'Free start' }, ...SCENARIOS.map((s) => ({ value: s.id, label: s.title }))]} /></Field>
            {!sc && <Field label="Map year"><Select value={mapKey} onChange={setMapKey} options={MAP_YEARS.map((m) => ({ value: m.key, label: formatYear(m.year) }))} /></Field>}
            <Field label="Months per round"><Select value={turn} onChange={setTurn} options={['1', '3', '6', '12'].map((v) => ({ value: v, label: `${v} months` }))} /></Field>
            <Button variant="gold" className="w-full" disabled={!valid} icon={<Play className="h-4 w-4" />} onClick={() => void start()}>Start hot-seat game</Button>
          </div>
        </Panel>
      </div>
      {hs.active && (
        <Panel className="mt-5" title={`Game in progress · round ${hs.turn}`} actions={<Button size="sm" onClick={() => navigate('/game')}>Return to the map</Button>}>
          <div className="scroll-thin max-h-60 space-y-1 overflow-y-auto text-sm">{hs.chat.map((c, i) => <div key={i}><b className="text-gold-200">{c.from}:</b> {c.text}</div>)}</div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { hs.say(msg); setMsg(''); } }}><input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Table talk…" /><Button type="submit" icon={<Send className="h-4 w-4" />}>Send</Button></form>
          <Button variant="danger" size="sm" className="mt-3" onClick={() => hs.stop()}>End hot-seat session</Button>
        </Panel>
      )}
    </div>
  );
}

let detach: (() => void) | null = null;
function attachOnline(room: RoomInfo, players: RoomPlayer[]) {
  const g = useGame.getState();
  const me = players.find((p) => p.user_id === useProfile.getState().userId);
  g.setRemote({ mode: 'online', roomId: room.id, slot: me?.user_id ?? '', send: (cmd) => sendCommandOnline(room.id, cmd) });
  detach?.();
  let turn = room.turn_number;
  detach = subscribeRoom(room.id, { chat: () => undefined, presence: () => undefined, room: () => { void getRoom(room.id).then(async ({ room: r }) => { if (r.turn_number !== turn) { turn = r.turn_number; const w = await fetchRoomWorld(r); await useGame.getState().setWorld(w); useGame.getState().toast(`Turn ${r.turn_number} resolved.`, 'event'); } }); } });
}

function Online({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const uid = useProfile((s) => s.userId);
  const setWorld = useGame((s) => s.setWorld);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const refresh = () => getRoom(roomId).then(({ room: r, players: p }) => { setRoom(r); setPlayers(p); }).catch((e) => setErr(e.message));
  useEffect(() => { void refresh(); return subscribeRoom(roomId, { chat: (m) => setChat((c) => [...c.slice(-100), m]), room: () => void refresh(), presence: setOnline }); }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <ErrorBox error={err} />;
  if (!room) return <Loading label="Joining room" />;
  const me = players.find((p) => p.user_id === uid);
  const host = room.host_id === uid;
  const allReady = players.length >= 2 && players.every((p) => p.ready && p.country_name);
  const enter = async () => { try { const w = await fetchRoomWorld(room); await setWorld(w); attachOnline(room, players); navigate('/game'); } catch (e) { setErr((e as Error).message); } };
  return (
    <div>
      <SectionTitle kicker={`Room · ${room.status}`}>{room.name}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Panel title="Players" subtitle={`${players.length}/${room.max_players} · turn ${room.turn_number} · ${room.turn_months} months per turn`} actions={<button className="flex items-center gap-1 text-xs text-gold-300" onClick={() => void navigator.clipboard.writeText(room.code)}><Copy className="h-3.5 w-3.5" />Invite code {room.code}</button>}>
            {players.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 border-b border-gold-700/10 py-2 text-sm">
                {p.country_name ? <Flag flag={PROFILES[p.country_name]?.flag ?? generatedFlag(p.country_name)} className="h-6 w-9" /> : <Users className="h-5 w-5 text-parchment-300" />}
                <span className="font-semibold">{p.display_name}</span>{p.user_id === room.host_id && <Crown className="h-3.5 w-3.5 text-gold-300" />}
                <span className="text-xs text-parchment-300/70">{p.country_name ?? 'no country yet'}</span>
                <span className="ml-auto flex gap-1">{online.includes(p.display_name) && <Badge tone="green">online</Badge>}{room.status === 'lobby' ? (p.ready ? <Badge tone="green">ready</Badge> : <Badge tone="gray">not ready</Badge>) : p.submitted_turn >= room.turn_number ? <Badge tone="green">turn ended</Badge> : <Badge tone="gold">playing</Badge>}</span>
              </div>
            ))}
          </Panel>
          {room.status === 'lobby' && me && (
            <Panel title="Your nation">
              <CountryPicker mapKey={room.map_key} value={me.country_name ?? ''} taken={players.map((p) => p.country_name ?? '')} onChange={(v) => void setMyCountry(room.id, v || null).then(refresh).catch((e) => setErr(e.message))} />
              <div className="mt-3 flex gap-2">
                <Button variant={me.ready ? 'ghost' : 'gold'} disabled={!me.country_name} onClick={() => void setReady(room.id, !me.ready).then(refresh)}>{me.ready ? 'Not ready' : 'Ready'}</Button>
                {host && <Button variant="gold" disabled={!allReady} icon={<Play className="h-4 w-4" />} onClick={() => void startOnline(room.id).then(refresh).catch((e) => setErr(e.message))}>Start game (server creates the world)</Button>}
                <Button variant="danger" onClick={() => void leaveRoom(room.id).then(() => navigate('/multiplayer'))}>Leave</Button>
              </div>
            </Panel>
          )}
          {room.status === 'playing' && <Panel title="Game in progress"><div className="flex gap-2"><Button variant="gold" icon={<Play className="h-4 w-4" />} onClick={() => void enter()}>Enter the shared world</Button><Button onClick={() => void endTurnOnline(room.id).then(refresh).catch((e) => setErr(e.message))}>End my turn</Button></div><p className="mt-2 text-xs text-parchment-300/60">When every player has ended the turn, the server simulates {room.turn_months} months and broadcasts the new state.</p></Panel>}
        </div>
        <Panel title="Room chat" subtitle="Realtime">
          <div className="scroll-thin h-72 space-y-1 overflow-y-auto text-sm">{chat.map((c, i) => <div key={i}><b className="text-gold-200">{c.from}:</b> {c.text}</div>)}{!chat.length && <p className="text-parchment-300/50"><MessageSquare className="mr-1 inline h-4 w-4" />No messages yet.</p>}</div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { sendChat(room.id, msg); setChat((c) => [...c, { from: useProfile.getState().displayName, text: msg, at: Date.now() }]); setMsg(''); } }}><input className="input" value={msg} maxLength={400} onChange={(e) => setMsg(e.target.value)} /><Button type="submit" icon={<Send className="h-4 w-4" />}>Send</Button></form>
        </Panel>
      </div>
    </div>
  );
}
