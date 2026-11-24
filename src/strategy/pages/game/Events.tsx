import { useMemo, useState } from 'react';
import { RequirePlayer } from './common';
import { Badge, Button, Panel, Tabs } from '../../components/ui';
import { EVENT_DEFS } from '../../engine/events';
import { fmtDate } from '../../engine/date';
import { useGame } from '../../store/game';
import type { Country, World } from '../../types/game';

const PAGE = 25;
export default function EventsPage() { return <RequirePlayer>{(c, w) => <Body c={c} w={w} />}</RequirePlayer>; }
function Body({ c, w }: { c: Country; w: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const st = useGame((s) => s.st)!;
  const [tab, setTab] = useState<'pending' | 'catalog' | 'history' | 'world'>('pending');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const pending = w.events.pending.filter((e) => e.country === c.id);
  const kinds = useMemo(() => ['all', ...Array.from(new Set(w.log.map((l) => l.kind)))], [w.log.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const log = useMemo(() => w.log.filter((l) => kind === 'all' || l.kind === kind).slice().reverse(), [w.log.length, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={(t) => { setTab(t); setPage(0); }} tabs={[{ id: 'pending', label: `Decisions (${pending.length})` }, { id: 'catalog', label: 'Event catalogue' }, { id: 'history', label: 'Your choices' }, { id: 'world', label: 'World chronicle' }]} />
      {tab === 'pending' && (pending.length ? pending.map((e) => (
        <Panel key={e.uid} title={e.title} subtitle={fmtDate(e.date)}>
          <p className="font-serif text-lg text-parchment-100">{e.body}</p>
          <div className="mt-3 grid gap-2">{e.options.map((o) => <button key={o.id} onClick={() => void dispatch({ type: 'eventChoice', country: c.id, uid: e.uid, option: o.id })} className="rounded bg-ink-950/60 px-3 py-2 text-left ring-1 ring-gold-600/40 hover:ring-gold-300"><div className="font-semibold text-gold-100">{o.label}</div><div className="text-xs text-parchment-300/70">{o.hint}</div></button>)}</div>
        </Panel>
      )) : <Panel title="No pending decisions"><p className="text-sm text-parchment-300/70">Events fire when their conditions are met in the simulation. See the catalogue for current probabilities.</p></Panel>)}
      {tab === 'catalog' && (
        <Panel title="Dynamic events affecting your country" subtitle="Monthly probability right now, computed from your country's live state (0 = conditions not met).">
          <div className="grid gap-2 md:grid-cols-2">
            {EVENT_DEFS.map((d) => {
              let p = 0;
              try { p = d.probability(w, c, st); } catch { p = 0; }
              const last = w.events.fired[`${d.id}|${c.id}`];
              const cooling = last !== undefined && w.date.y * 12 + w.date.m - last < d.cooldown;
              return (
                <div key={d.id} className="rounded bg-ink-950/50 p-2.5 ring-1 ring-gold-700/30">
                  <div className="flex items-center justify-between"><span className="font-semibold text-parchment-50">{d.title}</span><Badge tone={p > 0.01 ? 'red' : p > 0 ? 'gold' : 'gray'}>{cooling ? 'cooldown' : `${(p * 100).toFixed(2)}%/mo`}</Badge></div>
                  <div className="text-[11px] text-parchment-300/60">{d.category} · options: {d.options.map((o) => o.label).join(' / ')}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
      {tab === 'history' && <Panel title="Decisions you made">{w.events.history.filter((h) => h.country === c.id).slice().reverse().map((h, i) => <div key={i} className="border-b border-gold-700/10 py-1.5 text-sm"><span className="text-parchment-300/60">{fmtDate(h.date, true)}</span> · <b>{h.title}</b> → {h.choice}</div>)}{!w.events.history.some((h) => h.country === c.id) && <p className="text-sm text-parchment-300/60">None yet.</p>}</Panel>}
      {tab === 'world' && (
        <Panel title="World chronicle" actions={<select className="input !w-40 !py-1 text-xs" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>{kinds.map((k) => <option key={k} value={k}>{k}</option>)}</select>}>
          <ul className="space-y-1 text-sm">{log.slice(page * PAGE, page * PAGE + PAGE).map((l, i) => <li key={i} className="border-b border-gold-700/10 py-1"><span className="text-parchment-300/50">{fmtDate(l.date, true)} · {l.kind}</span> — {l.text}</li>)}</ul>
          <div className="mt-3 flex items-center justify-center gap-2"><Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button><span className="text-xs">{page + 1} / {Math.max(1, Math.ceil(log.length / PAGE))}</span><Button size="sm" disabled={(page + 1) * PAGE >= log.length} onClick={() => setPage(page + 1)}>Older</Button></div>
        </Panel>
      )}
    </div>
  );
}
