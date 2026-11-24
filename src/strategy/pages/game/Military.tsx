import { useState } from 'react';
import { RequirePlayer } from './common';
import { Badge, Bar, Button, Panel, Select, Slider, Stat } from '../../components/ui';
import { fmtNum, militaryPower } from '../../engine/util';
import { recruitCost } from '../../engine/commands';
import { demandableProvinces, evaluatePeace } from '../../engine/military';
import { fmtDate } from '../../engine/date';
import { useGame } from '../../store/game';
import type { Country, World } from '../../types/game';
import { Swords } from 'lucide-react';

export default function MilitaryPage() { return <RequirePlayer>{(c, w) => <Body c={c} w={w} />}</RequirePlayer>; }
function Body({ c, w }: { c: Country; w: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const [amount, setAmount] = useState(Math.min(10, Math.floor(c.military.manpower)));
  const m = c.military;
  const wars = w.wars.filter((x) => !x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id)));
  const past = w.wars.filter((x) => x.ended && (x.attackers.includes(c.id) || x.defenders.includes(c.id))).slice(-5).reverse();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Army" value={`${m.regiments.toFixed(1)}k`} sub={`power ${militaryPower(c).toFixed(0)}`} />
        <Stat label="Manpower" value={`${m.manpower.toFixed(1)}k`} sub={`max ${m.maxManpower.toFixed(0)}k`} />
        <Stat label="Quality" value={m.quality.toFixed(2)} sub="technology & training" />
        <Stat label="Losses" value={fmtNum(m.losses * 1000)} tone="bad" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Readiness">
          <div className="space-y-2">
            <Bar label="Morale" value={m.morale * 100} right={`${Math.round(m.morale * 100)}%`} color="green" />
            <Bar label="Supply & logistics" value={m.supply * 100} right={`${Math.round(m.supply * 100)}%`} color="blue" />
            <Bar label="Average fortification" value={m.forts} max={5} right={m.forts.toFixed(1)} />
          </div>
          <p className="mt-2 text-[11px] text-parchment-300/60">Battles weigh troops × quality × morale × supply × logistics (distance from capital vs roads, technology, navigation) × terrain & forts. Supply depends on food stock, roads and treasury.</p>
          <div className="mt-3"><span className="label">Doctrine</span><Select value={m.doctrine} onChange={(v) => void dispatch({ type: 'doctrine', country: c.id, doctrine: v })} options={[{ value: 'defensive', label: 'Defensive — commit fewer troops abroad' }, { value: 'balanced', label: 'Balanced' }, { value: 'offensive', label: 'Offensive — commit more troops' }]} /></div>
        </Panel>
        <Panel title="Army organisation">
          <Slider value={amount} min={0} max={Math.max(1, Math.floor(Math.max(m.manpower, m.regiments)))} step={1} onChange={setAmount} format={(v) => `${v}k`} />
          <p className="mt-2 text-xs text-parchment-300/70">Recruiting costs {fmtNum(recruitCost(c))} gold per thousand ({fmtNum(amount * recruitCost(c))} total) and uses manpower; upkeep is paid from the military budget.</p>
          <div className="mt-3 flex gap-2"><Button variant="gold" onClick={() => void dispatch({ type: 'recruit', country: c.id, amount })}>Recruit</Button><Button onClick={() => void dispatch({ type: 'disband', country: c.id, amount })}>Demobilise</Button></div>
        </Panel>
      </div>
      {wars.map((war) => {
        const isAtt = war.attackers.includes(c.id);
        const lead = isAtt ? war.attackers[0] === c.id : war.defenders[0] === c.id;
        const score = Math.round(war.score * (isAtt ? 1 : -1));
        const enemy = w.countries[isAtt ? war.defenders[0] : war.attackers[0]];
        const dem = lead ? demandableProvinces(w, war, isAtt) : [];
        const ev = lead ? evaluatePeace(w, war, isAtt, { type: 'conquest', provinces: dem }) : null;
        return (
          <Panel key={war.id} title={war.name} subtitle={`Since ${fmtDate(war.start)} · goal: ${war.goal}`} actions={<Badge tone={score >= 0 ? 'green' : 'red'}>War score {score}</Badge>}>
            <div className="mb-2 grid gap-2 text-xs md:grid-cols-2">
              <div><span className="label">Your side</span>{(isAtt ? war.attackers : war.defenders).map((id) => <div key={id}>{w.countries[id]?.name} — {w.countries[id]?.military.regiments.toFixed(1)}k</div>)}</div>
              <div><span className="label">Enemy</span>{(isAtt ? war.defenders : war.attackers).map((id) => <div key={id}>{w.countries[id]?.name} — {w.countries[id]?.military.regiments.toFixed(1)}k</div>)}</div>
            </div>
            {lead ? <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void dispatch({ type: 'diplo', country: c.id, target: enemy.id, action: 'peaceWhite' })}>Offer white peace</Button>
              <Button size="sm" variant="gold" disabled={!dem.length} onClick={() => void dispatch({ type: 'diplo', country: c.id, target: enemy.id, action: 'peaceDemand', provinces: dem })}>Demand {dem.length} occupied provinces</Button>
              {ev && dem.length > 0 && <span className="text-[11px] text-parchment-300/70">Acceptance {ev.total} vs {ev.threshold}</span>}
            </div> : <p className="mb-3 text-xs text-parchment-300/60">You are not the war leader — the leader negotiates peace.</p>}
            <div className="label">Recent battles</div>
            <ul className="space-y-1.5 text-xs">
              {war.battles.slice(-6).reverse().map((b, i) => (
                <li key={i} className="rounded bg-ink-950/50 p-2"><div className="flex items-center gap-1.5"><Swords className="h-3 w-3 text-blood-400" /><b>{w.provinces[b.province]?.name}</b> · {fmtDate(b.date, true)} · won by <span className={b.winner === c.id || (isAtt ? war.attackers : war.defenders).includes(b.winner) ? 'text-emerald-300' : 'text-blood-400'}>{w.countries[b.winner]?.name}</span> · losses {fmtNum(b.aLoss)} / {fmtNum(b.dLoss)}</div><div className="mt-0.5 text-[10px] text-parchment-300/60">{b.factors.join(' · ')}</div></li>
              ))}
              {!war.battles.length && <li className="text-parchment-300/50">No battles yet.</li>}
            </ul>
          </Panel>
        );
      })}
      {!wars.length && <Panel title="At peace"><p className="text-sm text-parchment-300/70">No active wars. Declare war from the map panel or the diplomacy screen (requires a shared border or sea route).</p></Panel>}
      {past.length > 0 && <Panel title="Past wars">{past.map((x) => <div key={x.id} className="border-b border-gold-700/10 py-1.5 text-sm"><b>{x.name}</b> <span className="text-xs text-parchment-300/60">({x.start.y}–{x.ended?.y})</span><div className="text-xs text-parchment-200/80">{x.result}</div></div>)}</Panel>}
    </div>
  );
}
