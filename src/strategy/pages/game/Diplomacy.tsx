import { useMemo, useState } from 'react';
import { RequirePlayer } from './common';
import { Badge, Button, Panel, cx } from '../../components/ui';
import { Flag } from '../../components/ui/Flag';
import { allies, fmtNum, isAtWar, militaryPower, peekRelation, vassalsOf } from '../../engine/util';
import { evaluateProposal } from '../../engine/diplomacy';
import { neighbours } from '../../engine/cache';
import { useGame } from '../../store/game';
import type { Country, DiploAction, World } from '../../types/game';
import { Search } from 'lucide-react';

export default function DiplomacyPage() { return <RequirePlayer>{(c, w) => <Body c={c} w={w} />}</RequirePlayer>; }

function Body({ c, w }: { c: Country; w: World }) {
  const st = useGame((s) => s.st)!;
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const [filter, setFilter] = useState<'relevant' | 'neighbours' | 'all'>('relevant');
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const neigh = useMemo(() => neighbours(w, st).get(c.id) ?? new Set<string>(), [w, st, c.id, w.stats.ticks]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => Object.values(w.countries).filter((o) => o.alive && o.id !== c.id && !o.tribal && o.name.toLowerCase().includes(q.toLowerCase()) && (filter === 'all' || (filter === 'neighbours' ? neigh.has(o.id) : neigh.has(o.id) || !!peekRelation(w, c.id, o.id) || o.pop.total > 2e7)))
    .sort((a, b) => (peekRelation(w, c.id, b.id)?.opinion ?? -999) - (peekRelation(w, c.id, a.id)?.opinion ?? -999)), [w, c.id, filter, q, neigh, w.stats.ticks]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = target ? w.countries[target] : null;
  const rel = t ? peekRelation(w, c.id, t.id) : undefined;
  const act = (a: DiploAction) => t && void dispatch({ type: 'diplo', country: c.id, target: t.id, action: a });
  const ev = (a: DiploAction) => (t ? evaluateProposal(w, c, t, a, st) : null);
  const offers = w.offers.filter((o) => o.to === c.id);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <Panel title="Your diplomatic standing">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge tone="green">{allies(w, c.id).length} allies</Badge>
            <Badge tone="blue">{Object.entries(w.relations).filter(([k, r]) => k.includes(c.id) && r.treaties.trade).length} trade agreements</Badge>
            <Badge>{vassalsOf(w, c.id).length} vassals</Badge>
            <Badge tone="red">{w.wars.filter((x) => !x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id))).length} wars</Badge>
            {c.overlord && <Badge tone="red">Vassal of {w.countries[c.overlord]?.name}</Badge>}
          </div>
          {offers.length > 0 && <div className="mt-3 space-y-2">{offers.map((o) => <div key={o.uid} className="rounded bg-sky-500/10 p-2 text-xs ring-1 ring-sky-400/30"><div>{o.reason}</div><div className="mt-1 flex gap-1.5"><Button size="sm" variant="gold" onClick={() => void dispatch({ type: 'answerOffer', country: c.id, uid: o.uid, accept: true })}>Accept</Button><Button size="sm" onClick={() => void dispatch({ type: 'answerOffer', country: c.id, uid: o.uid, accept: false })}>Decline</Button></div></div>)}</div>}
        </Panel>
        <Panel title="Nations">
          <div className="mb-2 flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-parchment-300/50" /><input className="input !pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" /></div>
            <select className="input !w-36" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="relevant">Relevant</option><option value="neighbours">Neighbours</option><option value="all">All states</option></select>
          </div>
          <div className="scroll-thin max-h-[460px] space-y-1 overflow-y-auto pr-1">
            {list.map((o) => {
              const r = peekRelation(w, c.id, o.id);
              const war = isAtWar(w, c.id, o.id);
              return (
                <button key={o.id} onClick={() => { setTarget(o.id); select(o.capital, o.id); }} className={cx('grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded px-2 py-1.5 text-left text-sm', target === o.id ? 'bg-gold-500/15 ring-1 ring-gold-300' : 'hover:bg-ink-800')}>
                  <Flag flag={o.flag} className="h-4 w-6 rounded-sm" />
                  <span className="truncate">{o.name} {neigh.has(o.id) && <span className="text-[10px] text-parchment-300/50">· border</span>}</span>
                  <span className={cx('stat-num text-xs', war ? 'text-blood-400' : (r?.opinion ?? 0) >= 0 ? 'text-emerald-300' : 'text-blood-400')}>{war ? 'WAR' : Math.round(r?.opinion ?? 0)}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
      <div>
        {t ? (
          <Panel title={t.name} subtitle={`${t.government.replace(/_/g, ' ')} · population ${fmtNum(t.pop.total)} · power ${militaryPower(t).toFixed(0)} (yours ${militaryPower(c).toFixed(0)})`} actions={<Flag flag={t.flag} className="h-8 w-12" />}>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded bg-ink-950/60 p-2"><div className="text-parchment-300/60">Opinion</div><div className="stat-num text-lg">{Math.round(rel?.opinion ?? 0)}</div></div>
              <div className="rounded bg-ink-950/60 p-2"><div className="text-parchment-300/60">Trust</div><div className="stat-num text-lg">{Math.round(rel?.trust ?? 30)}</div></div>
              <div className="rounded bg-ink-950/60 p-2"><div className="text-parchment-300/60">Their allies</div><div className="stat-num text-lg">{allies(w, t.id).length}</div></div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">{Object.keys(rel?.treaties ?? {}).map((k) => <Badge key={k} tone="blue">{k}</Badge>)}{rel && rel.truceUntil > w.date.y * 12 + w.date.m && <Badge tone="gray">truce</Badge>}{!rel?.recognized && <Badge tone="red">not recognised</Badge>}</div>
            <div className="space-y-2">
              {(['alliance', 'trade', 'nap', 'vassalize'] as DiploAction[]).map((a) => {
                const e = ev(a)!;
                const has = a !== 'vassalize' && rel?.treaties[a as 'alliance'];
                return (
                  <div key={a} className="rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold capitalize text-parchment-50">{a === 'nap' ? 'Non-aggression pact' : a === 'vassalize' ? 'Demand vassalage' : a === 'trade' ? 'Trade agreement' : 'Alliance'}</span>
                      {has ? <Button size="sm" onClick={() => act(a === 'alliance' ? 'breakAlliance' : 'cancelTrade')} disabled={a === 'nap'}>{a === 'nap' ? 'In force' : 'Cancel'}</Button>
                        : <Button size="sm" variant={e.total >= e.threshold ? 'gold' : 'ghost'} disabled={isAtWar(w, c.id, t.id)} onClick={() => act(a)}>Propose</Button>}
                    </div>
                    {!has && <div className="mt-1.5 text-[11px] text-parchment-300/70"><span className={e.total >= e.threshold ? 'text-emerald-300' : 'text-blood-400'}>{e.total >= e.threshold ? 'Likely accepted' : 'Likely refused'}</span> ({e.total} vs {e.threshold}): {e.factors.map((f) => `${f.label} ${f.value > 0 ? '+' : ''}${f.value}`).join(' · ') || 'no strong factors'}</div>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => act('improve')}>Improve relations</Button>
              <Button size="sm" onClick={() => act('gift')}>Send gift</Button>
              <Button size="sm" onClick={() => act('recognize')} disabled={rel?.recognized !== false}>Recognise</Button>
              <Button size="sm" onClick={() => act('insult')}>Insult</Button>
              {t.overlord === c.id && <Button size="sm" onClick={() => act('releaseVassal')}>Grant independence</Button>}
              {isAtWar(w, c.id, t.id) ? <><Button size="sm" onClick={() => act('peaceWhite')}>White peace</Button><Button size="sm" variant="gold" onClick={() => act('peaceDemand')}>Demand territory</Button></>
                : <Button size="sm" variant="danger" onClick={() => act('declareWar')}>Declare war</Button>}
            </div>
            <div className="mt-4"><div className="label">Recent decisions of their government</div>
              <ul className="space-y-1 text-[11px] text-parchment-200/80">{t.ai.decisions.slice(0, 6).map((d, i) => <li key={i}><b className="text-parchment-50">{d.summary}</b> — {d.reason}</li>)}{!t.ai.decisions.length && <li className="text-parchment-300/50">No recorded decisions yet.</li>}</ul>
              <div className="mt-2 text-[11px] text-parchment-300/60">Current goals: {t.ai.goals.join(', ') || '—'}</div>
            </div>
          </Panel>
        ) : <Panel title="Select a nation"><p className="text-sm text-parchment-300/70">Choose a country to see relations, AI acceptance factors and available actions. Every AI decision is explained by its factors.</p></Panel>}
      </div>
    </div>
  );
}
