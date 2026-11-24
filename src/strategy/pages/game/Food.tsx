import { useMemo, useState } from 'react';
import { RequirePlayer } from './common';
import { Bar, Button, Panel, Slider, Stat } from '../../components/ui';
import { BarList } from '../../components/ui/Charts';
import { fmtNum } from '../../engine/util';
import { computeCalc, foodMultiplier } from '../../engine/systems';
import { techLevel } from '../../data/technologies';
import { useGame } from '../../store/game';
import { Link } from 'react-router-dom';

export default function FoodPage() {
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const [months, setMonths] = useState(3);
  return (
    <RequirePlayer>{(c, w) => {
      const f = c.food;
      const ratio = f.production / Math.max(1, f.consumption);
      const stockMonths = f.stock / Math.max(1, f.consumption);
      const risk = Math.max(0, Math.min(100, (1 - ratio) * 300 + (3 - stockMonths) * 15 + (1 - f.weather) * 150));
      const calc = computeCalc(w, c);
      const price = 0.0011 * (1 + techLevel(c.tech.known) * 0.2);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Production / mo" value={fmtNum(f.production)} sub="people fed" />
            <Stat label="Consumption / mo" value={fmtNum(f.consumption)} />
            <Stat label="Balance" value={`${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`} tone={ratio >= 1 ? 'good' : 'bad'} />
            <Stat label="Stock" value={`${stockMonths.toFixed(1)} months`} sub={`capacity ${f.storageMonths.toFixed(1)} mo`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Famine risk">
              <Bar value={risk} color={risk > 50 ? 'red' : 'gold'} label="Estimated risk" right={`${Math.round(risk)}%`} />
              <ul className="mt-3 space-y-1 text-xs text-parchment-200/80">
                <li>Weather: harvest ×{f.weather.toFixed(2)} {f.weather < 0.9 && <span className="text-blood-400">(drought)</span>}</li>
                <li>Imports via trade agreements: {fmtNum(f.imports)} / month</li>
                <li>Agriculture budget effect: ×{calc.mult.agriculture.toFixed(2)} (<Link to="/game/economy" className="text-gold-300 hover:underline">adjust</Link>)</li>
                <li>Months in famine so far: {f.famineMonths}</li>
              </ul>
            </Panel>
            <Panel title="Emergency grain purchase">
              <Slider value={months} min={1} max={12} step={1} onChange={setMonths} format={(v) => `${v} mo`} />
              <p className="mt-2 text-xs text-parchment-300/70">Cost: {fmtNum(f.consumption * months * price)} gold for {months} months of food.</p>
              <Button variant="gold" className="mt-3" onClick={() => void dispatch({ type: 'buyFood', country: c.id, amount: months })}>Import grain</Button>
            </Panel>
          </div>
          <Panel title="Agriculture by province" subtitle="Load = population / carrying capacity. Above ~80% births slow down; build farms to raise capacity.">
            <ProvinceLoad c={c} w={w} select={select} agri={calc.mult.agriculture} foodMod={calc.foodMod} />
          </Panel>
        </div>
      );
    }}</RequirePlayer>
  );
}
function ProvinceLoad({ c, w, select, agri, foodMod }: { c: import('../../types/game').Country; w: import('../../types/game').World; select: (p: number) => void; agri: number; foodMod: number }) {
  const rows = useMemo(() => w.provinces.filter((p) => p.owner === c.id).map((p) => ({ p, load: p.pop / Math.max(1, p.baseCap * foodMultiplier(w, c, p, agri, foodMod)) })).sort((a, b) => b.load - a.load).slice(0, 15), [w, c, agri, foodMod]);
  return (
    <div>
      <BarList items={rows.map((r) => ({ label: `${r.p.name} (farms ${r.p.farms})`, value: r.load * 100, color: r.load > 0.8 ? '#a3362c' : '#7fa87a' }))} format={(v) => `${v.toFixed(0)}%`} />
      <div className="mt-2 flex flex-wrap gap-1">{rows.slice(0, 6).map((r) => <button key={r.p.id} className="text-[11px] text-gold-300 hover:underline" onClick={() => select(r.p.id)}>Select {r.p.name}</button>)}</div>
    </div>
  );
}
