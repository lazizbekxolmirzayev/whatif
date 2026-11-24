import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Castle, Coins, Crown, Gift, Handshake, Hammer, HeartHandshake, MapPin, Shield, Swords, Tractor, Users, X, Landmark, ScrollText, Store, Route } from 'lucide-react';
import { useGame } from '../../store/game';
import { Flag } from '../ui/Flag';
import { Badge, Bar, Button, Modal, cx } from '../ui';
import { fmtNum, isAtWar, peekRelation, militaryPower } from '../../engine/util';
import { GOVERNMENTS } from '../../data/eras';
import { techLevel } from '../../data/technologies';
import { REGION_LABEL } from '../../data/regions';
import type { BuildingKind, DiploAction } from '../../types/game';
import { maxBuildingLevel, colonizeCost, improveCost } from '../../engine/commands';
import { buildCost } from '../../engine/ai';
import { evaluateProposal } from '../../engine/diplomacy';
import { useSettings } from '../../services/settings';

const BUILD: { key: BuildingKind; label: string; icon: React.ReactNode; effect: string }[] = [
  { key: 'farms', label: 'Farms', icon: <Tractor className="h-3.5 w-3.5" />, effect: '+12% food capacity' },
  { key: 'roads', label: 'Roads', icon: <Route className="h-3.5 w-3.5" />, effect: 'Output, logistics' },
  { key: 'market', label: 'Market', icon: <Store className="h-3.5 w-3.5" />, effect: '+6% output, urbanisation' },
  { key: 'buildings', label: 'Public works', icon: <Landmark className="h-3.5 w-3.5" />, effect: 'Sanitation, storage, calm' },
  { key: 'port', label: 'Port', icon: <Anchor className="h-3.5 w-3.5" />, effect: 'Trade, naval reach' },
  { key: 'fort', label: 'Fortress', icon: <Castle className="h-3.5 w-3.5" />, effect: 'Defence, slower sieges' },
];

export function CountryPanel({ onClose }: { onClose: () => void }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const st = useGame((s) => s.st)!;
  const cid = useGame((s) => s.selectedCountry);
  const pid = useGame((s) => s.selectedProvince);
  const dispatch = useGame((s) => s.dispatch);
  const confirmWar = useSettings((s) => s.confirmWar);
  const [warConfirm, setWarConfirm] = useState(false);
  const c = cid ? w.countries[cid] : null;
  const p = pid !== null ? w.provinces[pid] : null;
  const me = w.player ? w.countries[w.player] : null;
  const isMe = !!c && c.id === w.player;
  const rel = c && me && !isMe ? peekRelation(w, me.id, c.id) : undefined;
  const atWar = c && me ? isAtWar(w, me.id, c.id) : false;
  const diplo = (action: DiploAction) => me && c && dispatch({ type: 'diplo', country: me.id, target: c.id, action });
  const preview = (action: DiploAction) => (me && c ? evaluateProposal(w, me, c, action, st) : null);

  return (
    <aside className="panel panel-ornate pointer-events-auto flex max-h-full w-full flex-col overflow-hidden md:w-[360px]">
      <div className="flex items-start gap-3 border-b border-gold-600/20 p-4">
        {c ? <Flag flag={c.flag} className="h-10 w-14 shrink-0 rounded" title={c.name} /> : <MapPin className="h-8 w-8 text-gold-300" />}
        <div className="min-w-0 flex-1">
          <h2 className="title-display truncate text-sm text-gold-100">{c ? c.name : p ? p.name : 'Unclaimed'}</h2>
          {c && <div className="text-[11px] text-parchment-300/70">{GOVERNMENTS[c.government].name}{c.overlord && w.countries[c.overlord] ? ` · vassal of ${w.countries[c.overlord].name}` : ''}</div>}
          {c && <div className="mt-1 flex flex-wrap gap-1">{isMe && <Badge>Your nation</Badge>}{!c.alive && <Badge tone="red">Collapsed</Badge>}{c.tribal && <Badge tone="gray">Tribal / non-state</Badge>}{!c.historical && <Badge tone="purple">Created in this timeline</Badge>}{atWar && <Badge tone="red">At war with you</Badge>}{rel?.treaties.alliance && <Badge tone="green">Ally</Badge>}</div>}
        </div>
        <button onClick={onClose} className="rounded p-1 text-parchment-300 hover:text-gold-100" aria-label="Close panel"><X className="h-4 w-4" /></button>
      </div>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {c && c.alive && (
          <>
            <div className="text-xs text-parchment-200/80"><Crown className="mr-1 inline h-3.5 w-3.5 text-gold-300" />{c.ruler.title} {c.ruler.name} <span className="text-parchment-300/50">({c.ruler.historical ? 'historical figure' : 'generated'}, age {w.date.y - c.ruler.born})</span></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Population" value={fmtNum(c.pop.total)} />
              <Info label="GDP / yr" value={fmtNum(c.economy.gdp)} />
              <Info label="Treasury" value={fmtNum(c.economy.treasury)} />
              <Info label="Food" value={`${fmtNum(c.food.production)} / ${fmtNum(c.food.consumption)}`} />
              <Info label="Army" value={`${c.military.regiments.toFixed(1)}k · q${c.military.quality.toFixed(2)}`} />
              <Info label="Technology" value={techLevel(c.tech.known).toFixed(2)} />
              <Info label="Provinces" value={String(c.provinceCount)} />
              <Info label="Power" value={militaryPower(c).toFixed(0)} />
            </div>
            <Bar label="Stability" value={c.stability.value} right={Math.round(c.stability.value)} color={c.stability.value < 35 ? 'red' : 'green'} />
            <Bar label="Legitimacy" value={c.stability.legitimacy} right={Math.round(c.stability.legitimacy)} />
            {!isMe && me && me.alive && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="label !mb-0">Relations with you</span>
                  <span className="stat-num text-parchment-100">opinion {Math.round(rel?.opinion ?? 0)} · trust {Math.round(rel?.trust ?? 30)}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1">{Object.keys(rel?.treaties ?? {}).map((t) => <Badge key={t} tone="blue">{t}</Badge>)}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" icon={<HeartHandshake className="h-3.5 w-3.5" />} onClick={() => diplo('improve')} title={`Costs ${fmtNum(improveCost(me))}`}>Improve</Button>
                  <Button size="sm" icon={<Gift className="h-3.5 w-3.5" />} onClick={() => diplo('gift')}>Send gift</Button>
                  {!atWar && <>
                    <Button size="sm" icon={<Handshake className="h-3.5 w-3.5" />} onClick={() => diplo(rel?.treaties.alliance ? 'breakAlliance' : 'alliance')} title={odds(preview('alliance'))}>{rel?.treaties.alliance ? 'Break alliance' : 'Alliance'}</Button>
                    <Button size="sm" icon={<Coins className="h-3.5 w-3.5" />} onClick={() => diplo(rel?.treaties.trade ? 'cancelTrade' : 'trade')} title={odds(preview('trade'))}>{rel?.treaties.trade ? 'End trade' : 'Trade deal'}</Button>
                    {!rel?.treaties.nap && <Button size="sm" icon={<Shield className="h-3.5 w-3.5" />} onClick={() => diplo('nap')} title={odds(preview('nap'))}>Non-aggression</Button>}
                    {c.overlord !== me.id ? <Button size="sm" icon={<Crown className="h-3.5 w-3.5" />} onClick={() => diplo('vassalize')} title={odds(preview('vassalize'))}>Demand vassalage</Button> : <Button size="sm" onClick={() => diplo('releaseVassal')}>Release vassal</Button>}
                    <Button size="sm" variant="danger" icon={<Swords className="h-3.5 w-3.5" />} onClick={() => (confirmWar ? setWarConfirm(true) : diplo('declareWar'))}>Declare war</Button>
                  </>}
                  {atWar && <>
                    <Button size="sm" onClick={() => diplo('peaceWhite')}>Offer white peace</Button>
                    <Button size="sm" variant="gold" onClick={() => diplo('peaceDemand')}>Demand territory</Button>
                  </>}
                </div>
                <Link to="/game/diplomacy" className="mt-2 block text-[11px] text-gold-300 hover:underline">Open diplomacy screen →</Link>
              </div>
            )}
            {isMe && <div className="grid grid-cols-2 gap-1.5">{[['Economy', '/game/economy'], ['Military', '/game/military'], ['Technology', '/game/technology'], ['Diplomacy', '/game/diplomacy']].map(([l, to]) => <Link key={to} to={to} className="btn-ghost !py-1.5 !text-xs">{l}</Link>)}</div>}
          </>
        )}
        {c && !c.alive && <p className="text-sm text-parchment-300/80">{c.name} no longer exists in this timeline{c.collapsed ? ` (collapsed ${c.collapsed.y})` : ''}. <Link className="text-gold-300 hover:underline" to="/game/historian">Ask the AI Historian why →</Link></p>}

        {p && (
          <div className="rounded-md bg-ink-950/50 p-3 ring-1 ring-gold-700/30">
            <div className="flex items-center justify-between"><div className="font-serif text-lg font-bold text-gold-100">{p.name}</div><span className="text-[10px] text-parchment-300/60">{REGION_LABEL[p.region]}</span></div>
            <div className="mb-2 text-[11px] text-parchment-300/60">Province in modern {p.modern} · {fmtNum(p.area)} km² {p.id === c?.capital && '· capital'}</div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <Info label="Pop" value={fmtNum(p.pop)} /><Info label="Dev" value={String(p.dev)} /><Info label="Unrest" value={`${Math.round(p.unrest)}%`} />
            </div>
            {me && p.owner === me.id && (
              <div className="mt-3 space-y-1">
                <div className="label">Build & invest</div>
                {BUILD.filter((b) => b.key !== 'port' || p.coastal).map((b) => {
                  const lvl = p[b.key];
                  const max = maxBuildingLevel(me, b.key);
                  const cost = buildCost(w, me, lvl);
                  return (
                    <div key={b.key} className="flex items-center gap-2 text-xs">
                      <span className="text-gold-300">{b.icon}</span>
                      <span className="w-24 text-parchment-100">{b.label}</span>
                      <span className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <span key={i} className={cx('h-1.5 w-3 rounded-sm', i < lvl ? 'bg-gold-300' : i < max ? 'bg-ink-700' : 'bg-ink-950')} />)}</span>
                      <button disabled={lvl >= max || me.economy.treasury < cost} onClick={() => dispatch({ type: 'build', country: me.id, province: p.id, building: b.key })} className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-gold-200 ring-1 ring-gold-600/40 hover:bg-ink-700 disabled:opacity-30" title={b.effect}><Hammer className="mr-1 inline h-3 w-3" />{fmtNum(cost)}</button>
                    </div>
                  );
                })}
                {p.id !== me.capital && <button className="mt-1 text-[11px] text-gold-300 hover:underline" onClick={() => dispatch({ type: 'moveCapital', country: me.id, province: p.id })}>Move capital here</button>}
              </div>
            )}
            {me && !p.owner && <Button size="sm" className="mt-3 w-full" icon={<Users className="h-3.5 w-3.5" />} onClick={() => dispatch({ type: 'colonize', country: me.id, province: p.id })}>Settle this land ({fmtNum(colonizeCost(me))})</Button>}
          </div>
        )}
        {!c && !p && <p className="text-sm text-parchment-300/70"><ScrollText className="mr-1 inline h-4 w-4" />Select a province on the map.</p>}
      </div>
      <Modal open={warConfirm} onClose={() => setWarConfirm(false)} title="Declare war?" footer={<><Button onClick={() => setWarConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { setWarConfirm(false); diplo('declareWar'); }}>Declare war</Button></>}>
        {c && me && (() => {
          const r = peekRelation(w, me.id, c.id) ?? { opinion: 0, treaties: {} as Record<string, unknown> };
          return <div className="space-y-2 text-sm text-parchment-100">
            <p>You are about to declare war on <b>{c.name}</b>.</p>
            <ul className="list-disc space-y-1 pl-5 text-parchment-200/80">
              <li>Their allies with sufficient trust will join the war.</li>
              {!!(r.treaties as Record<string, unknown>).nap && <li className="text-blood-400">You have a non-aggression pact — breaking it costs legitimacy and trust worldwide.</li>}
              {r.opinion > -25 && <li className="text-blood-400">Without a grievance (opinion above −25, no claims) the war is unjustified: −8 stability, −6 legitimacy for 5 years.</li>}
              <li>Your power {militaryPower(me).toFixed(0)} vs theirs {militaryPower(c).toFixed(0)} (before allies, logistics and terrain).</li>
            </ul>
          </div>;
        })()}
      </Modal>
    </aside>
  );
}

function odds(ev: { total: number; threshold: number } | null): string { return ev ? `AI acceptance: ${ev.total} vs required ${ev.threshold}` : ''; }
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-ink-950/50 px-2 py-1 ring-1 ring-gold-700/20"><div className="text-[9px] uppercase tracking-wider text-parchment-300/50">{label}</div><div className="stat-num truncate text-parchment-50">{value}</div></div>;
}
