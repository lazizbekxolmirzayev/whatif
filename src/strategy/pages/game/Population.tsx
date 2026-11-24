import { useMemo } from 'react';
import { RequirePlayer, historySeries, yearLabel } from './common';
import { Panel, Stat } from '../../components/ui';
import { BarList, Donut, LineChart } from '../../components/ui/Charts';
import { fmtNum } from '../../engine/util';
import { REGION_LABEL } from '../../data/regions';
import { useGame } from '../../store/game';

const COLORS = ['#d9b65c', '#4fa08b', '#c2493d', '#5f9fae', '#9a7b3f', '#8a6a9a', '#7fa87a', '#b8573a', '#cfc28a', '#3a8371', '#a0614f'];
export default function PopulationPage() {
  const select = useGame((s) => s.select);
  return (
    <RequirePlayer>{(c, w) => <Body c={c} w={w} select={select} />}</RequirePlayer>
  );
}
function Body({ c, w, select }: { c: import('../../types/game').Country; w: import('../../types/game').World; select: (p: number | null, c?: string | null) => void }) {
  const provs = useMemo(() => w.provinces.filter((p) => p.owner === c.id).sort((a, b) => b.pop - a.pop), [w, c.id, c.pop.total]); // eslint-disable-line react-hooks/exhaustive-deps
  const byRegion = useMemo(() => { const m = new Map<string, number>(); for (const p of provs) m.set(p.region, (m.get(p.region) ?? 0) + p.pop); return Array.from(m.entries()); }, [provs]);
  const p = c.pop;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Population" value={fmtNum(p.total)} />
        <Stat label="Growth" value={`${(p.growthRate * 100).toFixed(2)}%`} sub="per year" tone={p.growthRate >= 0 ? 'good' : 'bad'} />
        <Stat label="Births / month" value={fmtNum(p.births)} />
        <Stat label="Deaths / month" value={fmtNum(p.deaths)} />
        <Stat label="Net migration" value={fmtNum(p.migration)} tone={p.migration < 0 ? 'bad' : 'neutral'} />
        <Stat label="Urbanisation" value={`${(p.urbanization * 100).toFixed(1)}%`} />
        <Stat label="Density" value={`${(p.total / Math.max(1, c.area)).toFixed(1)}/km²`} />
        <Stat label="Provinces" value={provs.length} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Distribution by region"><Donut parts={byRegion.map(([r, v], i) => ({ label: REGION_LABEL[r as keyof typeof REGION_LABEL], value: v, color: COLORS[i % COLORS.length] }))} /></Panel>
        <Panel title="Cumulative deaths by cause" subtitle="Since the start of this timeline">
          <BarList items={[{ label: 'Famine', value: p.famineDeaths, color: '#b8573a' }, { label: 'Epidemics', value: p.epidemicDeaths, color: '#8a6a9a' }, { label: 'War', value: p.warDeaths, color: '#a3362c' }]} format={fmtNum} />
          <p className="mt-3 text-[11px] text-parchment-300/60">Births fall as provinces approach their agricultural carrying capacity; deaths depend on healthcare, sanitation, medicine technology, famine, epidemics and war.</p>
        </Panel>
      </div>
      <Panel title="Population over time"><LineChart xLabel={yearLabel} series={[{ name: c.name, color: '#e8d08a', points: historySeries(w, c.id, 'pop') }]} /></Panel>
      <Panel title="Most populous provinces">
        <div className="grid gap-1 text-sm">
          {provs.slice(0, 15).map((pr) => (
            <button key={pr.id} onClick={() => select(pr.id)} className="grid grid-cols-[1fr_6rem_4rem_4rem] items-center rounded px-2 py-1 text-left hover:bg-ink-800">
              <span className="truncate text-parchment-50">{pr.name}{pr.id === c.capital && ' ★'}</span><span className="stat-num text-right">{fmtNum(pr.pop)}</span><span className="stat-num text-right text-parchment-300/60">dev {pr.dev}</span><span className="stat-num text-right text-parchment-300/60">{Math.round(pr.unrest)}%</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
