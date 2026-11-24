import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { MAP_YEARS, formatYear } from '../data/eras';
import { useDataset } from '../hooks/useDataset';
import { WorldMap } from '../components/map/WorldMap';
import { Badge, Panel, SectionTitle, cx } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import { PROFILES, generatedFlag, CORRECTIONS } from '../data/polities';
import { worldPopulation } from '../data/regions';
import { fmtNum } from '../engine/util';
import { citiesForYear } from '../data/cities';

export default function WorldExplorer() {
  const [i, setI] = useState(8);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [parchment, setParchment] = useState(true);
  const ds = MAP_YEARS[i];
  const { data, error } = useDataset(ds.key, parchment);
  const list = useMemo(() => (data?.polities ?? []).filter((p) => !p.tribal && p.name.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const highlight = useMemo(() => (sel && data ? new Set(data.owners.map((o, k) => (o === sel ? k : -1)).filter((k) => k >= 0)) : null), [sel, data]);
  const notes = CORRECTIONS.filter((c) => c.key === ds.key);
  return (
    <div>
      <SectionTitle kicker="World explorer">2,500 years of political borders</SectionTitle>
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-1">{MAP_YEARS.map((m, k) => <button key={m.key} onClick={() => { setI(k); setSel(null); }} className={cx('rounded px-2 py-1 text-[11px] font-semibold', k === i ? 'bg-gold-400 text-ink-950' : 'bg-ink-950/60 text-parchment-200 hover:bg-ink-800')}>{formatYear(m.year)}</button>)}</div>
        <input type="range" min={0} max={MAP_YEARS.length - 1} value={i} onChange={(e) => { setI(Number(e.target.value)); setSel(null); }} className="mt-3 w-full accent-gold-400" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel className="!p-0 overflow-hidden">
          <div className="relative h-[560px]">
            {error && <p className="p-4 text-blood-400">{error}</p>}
            {data && <WorldMap owners={data.owners} fills={data.fills} fillVersion={i + (parchment ? 100 : 0)} borderVersion={i} labels={data.labels} year={ds.year} highlight={highlight} selectedOwner={sel} onProvinceClick={(id) => setSel(data.owners[id])} />}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={formatYear(ds.year)} subtitle="Documented borders (historical-basemaps). Province shapes are modern admin regions — an approximation.">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-ink-950/60 p-2"><div className="text-parchment-300/60">States</div><div className="stat-num text-lg">{list.length}</div></div>
              <div className="rounded bg-ink-950/60 p-2"><div className="text-parchment-300/60">World pop. (est.)</div><div className="stat-num text-lg">{fmtNum(worldPopulation(ds.year))}</div></div>
              <div className="rounded bg-ink-950/60 p-2"><div className="text-parchment-300/60">Major cities</div><div className="stat-num text-lg">{citiesForYear(ds.year).length}</div></div>
              <label className="flex items-center gap-2 rounded bg-ink-950/60 p-2"><input type="checkbox" checked={parchment} onChange={(e) => setParchment(e.target.checked)} />Parchment style</label>
            </div>
            {notes.length > 0 && <div className="mt-3 space-y-1 text-[11px] text-parchment-300/70">{notes.map((n, k) => <div key={k}><Badge tone="gold">editorial correction</Badge> {n.note}</div>)}</div>}
          </Panel>
          <Panel title="Polities">
            <div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-parchment-300/50" /><input className="input !pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" /></div>
            <div className="scroll-thin max-h-[360px] space-y-1 overflow-y-auto">{list.map((p) => <button key={p.name} onClick={() => setSel(p.name)} className={cx('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm', sel === p.name ? 'bg-gold-500/15 ring-1 ring-gold-300' : 'hover:bg-ink-800')}><Flag flag={PROFILES[p.name]?.flag ?? generatedFlag(p.name)} className="h-4 w-6" /><span className="flex-1 truncate">{p.name}</span><span className="text-[10px] text-parchment-300/50">{p.provinces}</span></button>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
