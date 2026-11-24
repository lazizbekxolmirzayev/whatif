import { useState } from 'react';
import { Crown, Pencil, Users } from 'lucide-react';
import { RequirePlayer, historySeries, yearLabel } from './common';
import { Badge, Bar, Button, Panel, Select, Stat } from '../../components/ui';
import { Flag } from '../../components/ui/Flag';
import { LineChart } from '../../components/ui/Charts';
import { GOVERNMENTS, eraForYear, eraIndex } from '../../data/eras';
import { fmtNum, now, vassalsOf } from '../../engine/util';
import { techLevel } from '../../data/technologies';
import { useGame } from '../../store/game';
import type { GovernmentId } from '../../types/game';

export default function CountryPage() {
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const [name, setName] = useState<string | null>(null);
  const [gov, setGov] = useState<GovernmentId | ''>('');
  return (
    <RequirePlayer>{(c, w) => {
      const vassals = vassalsOf(w, c.id);
      const mods = c.modifiers.filter((m) => m.until > now(w));
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Flag flag={c.flag} className="h-16 w-24 rounded shadow-panel" />
            <div className="flex-1">
              {name === null ? <h1 className="title-display gold-text flex items-center gap-2 text-2xl">{c.name}<button onClick={() => setName(c.name)} className="text-parchment-300 hover:text-gold-100"><Pencil className="h-4 w-4" /></button></h1>
                : <div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><Button variant="gold" onClick={() => { void dispatch({ type: 'rename', country: c.id, name }); setName(null); }}>Rename</Button></div>}
              <div className="mt-1 flex flex-wrap gap-1.5"><Badge>{GOVERNMENTS[c.government].name}</Badge>{c.historical ? <Badge tone="blue">Historical polity</Badge> : <Badge tone="purple">Created in this timeline</Badge>}{c.overlord && <Badge tone="red">Vassal of {w.countries[c.overlord]?.name}</Badge>}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Population" value={fmtNum(c.pop.total)} sub={`${(c.pop.growthRate * 100).toFixed(2)}% / yr`} />
            <Stat label="GDP" value={fmtNum(c.economy.gdp)} sub="gold per year" />
            <Stat label="Provinces" value={c.provinceCount} sub={`${fmtNum(c.area)} km²`} />
            <Stat label="Technology" value={techLevel(c.tech.known).toFixed(2)} sub={`${c.tech.known.length} discoveries`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Ruler & succession">
              <div className="flex items-start gap-3"><Crown className="mt-1 h-5 w-5 text-gold-300" /><div><div className="font-semibold text-gold-100">{c.ruler.title} {c.ruler.name}</div><div className="text-xs text-parchment-300/70">Age {w.date.y - c.ruler.born} · health {Math.round(c.ruler.health)} · {c.ruler.historical ? 'documented historical figure' : 'generated character'}</div><div className="mt-1 text-xs text-parchment-200">Administration {c.ruler.skill.admin} · Diplomacy {c.ruler.skill.diplomacy} · Military {c.ruler.skill.military}</div>{c.ruler.traits.length > 0 && <div className="mt-1 flex gap-1">{c.ruler.traits.map((t) => <Badge key={t} tone="gray">{t}</Badge>)}</div>}</div></div>
              <div className="mt-3 flex items-start gap-3 text-sm"><Users className="mt-0.5 h-4 w-4 text-parchment-300" />{c.heir ? <span>Heir: <b className="text-parchment-50">{c.heir.name}</b> (age {w.date.y - c.heir.born}, admin {c.heir.skill.admin})</span> : <span className="text-blood-400">No designated heir — a succession crisis looms if the ruler dies.</span>}</div>
            </Panel>
            <Panel title="Stability">
              <div className="space-y-2.5">
                <Bar label="Stability" value={c.stability.value} right={Math.round(c.stability.value)} color={c.stability.value < 35 ? 'red' : 'green'} />
                <Bar label="Public satisfaction" value={c.stability.satisfaction} right={Math.round(c.stability.satisfaction)} />
                <Bar label="Government legitimacy" value={c.stability.legitimacy} right={Math.round(c.stability.legitimacy)} color="blue" />
                <Bar label="Average unrest" value={c.stability.unrest} right={`${Math.round(c.stability.unrest)}%`} color="red" />
                <Bar label="Rebellion pressure" value={c.stability.rebellion} right={`${Math.round(c.stability.rebellion)}%`} color="red" />
                <Bar label="War exhaustion" value={c.stability.warExhaustion} right={Math.round(c.stability.warExhaustion)} color="red" />
              </div>
              <p className="mt-2 text-[11px] text-parchment-300/60">Rebellion reaches 100% → a region revolts and declares a war of independence.</p>
            </Panel>
          </div>
          <Panel title="Government reform" subtitle="10-year cooldown; costs legitimacy and stability during the transition.">
            <div className="flex flex-wrap gap-2">
              <Select value={gov || c.government} onChange={(v) => setGov(v)} className="max-w-xs" options={Object.values(GOVERNMENTS).filter((g) => g.minEra <= eraIndex(eraForYear(w.date.y))).map((g) => ({ value: g.id, label: g.name }))} />
              <Button variant="gold" disabled={!gov || gov === c.government} onClick={() => gov && void dispatch({ type: 'reform', country: c.id, government: gov })}>Enact reform</Button>
            </div>
            {gov && <p className="mt-2 text-xs text-parchment-300/70">{GOVERNMENTS[gov].description} Effects: {Object.entries(GOVERNMENTS[gov].effects).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(', ')}</p>}
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Active modifiers">{mods.length ? <ul className="space-y-1.5 text-sm">{mods.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="text-parchment-50">{m.label}</span><span className="text-[11px] text-parchment-300/60">{Object.entries(m.effects).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(', ')}{m.until < 1e8 ? ` · ${m.until - now(w)} mo` : ''}</span></li>)}</ul> : <p className="text-sm text-parchment-300/60">None.</p>}</Panel>
            <Panel title={`Vassals (${vassals.length})`}>{vassals.length ? vassals.map((v) => <button key={v.id} onClick={() => select(v.capital, v.id)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-ink-800"><Flag flag={v.flag} className="h-4 w-6" />{v.name}<span className="ml-auto text-xs text-parchment-300/60">{fmtNum(v.pop.total)}</span></button>) : <p className="text-sm text-parchment-300/60">No vassals. Subjugate weaker states through war or diplomacy.</p>}</Panel>
          </div>
          <Panel title="History of the realm">
            <LineChart xLabel={yearLabel} series={[{ name: 'Population', color: '#e8d08a', points: historySeries(w, c.id, 'pop') }]} />
            <LineChart xLabel={yearLabel} series={[{ name: 'Provinces', color: '#4fa08b', points: historySeries(w, c.id, 'provinces') }, { name: 'Stability', color: '#c2493d', points: historySeries(w, c.id, 'stability') }]} />
          </Panel>
        </div>
      );
    }}</RequirePlayer>
  );
}
