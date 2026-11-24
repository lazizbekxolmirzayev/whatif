import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search } from 'lucide-react';
import { ERAS, MAP_YEARS, SUPPORTED_RANGE, mapKeyForYear, formatYear } from '../data/eras';
import { useDataset } from '../hooks/useDataset';
import { WorldMap } from '../components/map/WorldMap';
import { Badge, Button, Panel, SectionTitle, Select, cx } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import { PROFILES, generatedFlag } from '../data/polities';
import { useGame } from '../store/game';
import type { Difficulty } from '../types/game';
import { ScenarioArt } from '../components/art/ScenarioArt';

export default function EraSelect() {
  const [era, setEra] = useState(ERAS[3]);
  const [year, setYear] = useState(era.defaultYear);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [showTribal, setShowTribal] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const key = mapKeyForYear(year);
  const datasetYear = MAP_YEARS.find((m) => m.key === key)!.year;
  const { data, error } = useDataset(key);
  const startGame = useGame((s) => s.startGame);
  const navigate = useNavigate();
  const list = useMemo(() => (data?.polities ?? []).filter((p) => (showTribal || !p.tribal) && p.name.toLowerCase().includes(q.toLowerCase())), [data, q, showTribal]);
  const highlight = useMemo(() => (pick && data ? new Set(data.owners.map((o, i) => (o === pick ? i : -1)).filter((i) => i >= 0)) : null), [pick, data]);

  const start = async () => {
    if (!pick) return;
    await startGame(key, { name: `${pick}, ${formatYear(year)}`, start: { y: year, m: 0 }, mode: 'sandbox', player: pick, difficulty });
    navigate('/game');
  };

  return (
    <div>
      <SectionTitle kicker="Historical era selection">Choose an age and a nation</SectionTitle>
      <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {ERAS.map((e, i) => (
          <button key={e.id} onClick={() => { setEra(e); setYear(e.defaultYear); setPick(null); }} className={cx('panel group relative h-36 overflow-hidden text-left transition', era.id === e.id ? 'ring-2 ring-gold-300 shadow-glow' : 'hover:-translate-y-0.5')}>
            <ScenarioArt hue={e.hue} year={formatYear(e.defaultYear)} seed={i + 1} className="absolute inset-0 h-full w-full opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40" />
            <div className="absolute bottom-0 p-3"><div className="title-display text-[12px] text-gold-100">{e.name}</div><div className="text-[10px] text-parchment-300/70">{formatYear(e.range[0])} – {formatYear(e.range[1])}</div></div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b border-gold-600/20 p-4">
            <div className="flex-1">
              <div className="label">Starting year: <span className="text-gold-100">{formatYear(year)}</span></div>
              <input type="range" min={Math.max(SUPPORTED_RANGE[0], era.range[0])} max={Math.min(SUPPORTED_RANGE[1], era.range[1])} value={year} onChange={(e) => { setYear(Number(e.target.value)); setPick(null); }} className="w-full accent-gold-400" />
            </div>
            <div className="text-xs text-parchment-300/70">Borders: dataset <Badge>{formatYear(datasetYear)}</Badge>{datasetYear !== year && <span className="ml-1">(nearest earlier map — approximate for {formatYear(year)})</span>}</div>
          </div>
          <p className="px-4 pt-3 text-sm text-parchment-200/80">{era.blurb}</p>
          <div className="relative h-[420px]">
            {error && <div className="p-4 text-blood-400">{error}</div>}
            {data && <WorldMap owners={data.owners} fills={data.fills} fillVersion={1} borderVersion={datasetYear} labels={data.labels} year={year} highlight={highlight} selectedOwner={pick}
              onProvinceClick={(id) => { const o = data.owners[id]; if (o) setPick(o); }} />}
          </div>
        </Panel>
        <Panel title="Select a nation" subtitle="Click the map or the list">
          <div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-parchment-300/50" /><input className="input !pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <label className="mb-2 flex items-center gap-2 text-xs text-parchment-300/70"><input type="checkbox" checked={showTribal} onChange={(e) => setShowTribal(e.target.checked)} />Include non-state peoples (passive)</label>
          <div className="scroll-thin max-h-[300px] space-y-1 overflow-y-auto pr-1">
            {list.map((p) => (
              <button key={p.name} onClick={() => setPick(p.name)} className={cx('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm', pick === p.name ? 'bg-gold-500/20 ring-1 ring-gold-300' : 'hover:bg-ink-800')}>
                <Flag flag={PROFILES[p.name]?.flag ?? generatedFlag(p.name)} className="h-4 w-6 rounded-sm" />
                <span className="flex-1 truncate text-parchment-50">{p.name}</span>
                <span className="stat-num text-[11px] text-parchment-300/50">{p.provinces} prov.</span>
              </button>
            ))}
          </div>
          <div className="mt-3"><span className="label">Difficulty</span><Select value={difficulty} onChange={setDifficulty} options={[{ value: 'story', label: 'Story — generous resources' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }, { value: 'ironman', label: 'Ironman — hard, single autosave' }]} /></div>
          <Button variant="gold" className="mt-4 w-full" size="lg" disabled={!pick} icon={<Play className="h-4 w-4" />} onClick={() => void start()}>{pick ? `Play as ${pick}` : 'Select a nation'}</Button>
        </Panel>
      </div>
    </div>
  );
}
