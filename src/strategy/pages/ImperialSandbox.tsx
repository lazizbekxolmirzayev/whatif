import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Dice5, MapPin, Play } from 'lucide-react';
import { ERAS, GOVERNMENTS, MAP_YEARS, SUPPORTED_RANGE, eraIndex, eraForYear, formatYear, mapKeyForYear } from '../data/eras';
import { useDataset } from '../hooks/useDataset';
import { WorldMap } from '../components/map/WorldMap';
import { Badge, Button, Field, Panel, SectionTitle, Select, Slider, Tabs, cx } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import type { Difficulty, FlagDesign, GovernmentId } from '../types/game';
import { loadMeta, loadStatic } from '../services/mapData';
import type { ProvinceMeta } from '../engine/create';
import { useGame } from '../store/game';
import { fmtNum, distanceKm } from '../engine/util';
import { generatedFlag, PALETTE } from '../data/polities';

const PATTERNS: FlagDesign['pattern'][] = ['solid', 'hbi', 'htri', 'vtri', 'vbi', 'nordic', 'saltire', 'canton', 'diagonal', 'border', 'quartered', 'stripes'];
const EMBLEMS: FlagDesign['emblem'][] = ['none', 'star', 'crescent', 'sun', 'cross', 'circle', 'crown', 'eagle', 'rings', 'tower', 'lion', 'wheel'];
const SWATCHES = ['#9e1c22', '#c8102e', '#1d3c8f', '#2b4aa0', '#2f6b3a', '#3a8a4a', '#e7c33c', '#f5f1e6', '#1b1b1b', '#5b1f6a', '#c66a1a', '#2a7a8a', '#7a1a3a', '#8a5a2a'];
const FOCI = [
  { id: 'world', label: 'Whole world', lon: 20, lat: 25 }, { id: 'europe', label: 'Europe', lon: 12, lat: 48 }, { id: 'mena', label: 'Middle East', lon: 42, lat: 32 },
  { id: 'asia', label: 'East Asia', lon: 110, lat: 33 }, { id: 'india', label: 'South Asia', lon: 78, lat: 22 }, { id: 'africa', label: 'Africa', lon: 20, lat: 5 },
  { id: 'americas', label: 'Americas', lon: -80, lat: 15 }, { id: 'steppe', label: 'Central Asia', lon: 66, lat: 42 },
];

export default function ImperialSandbox() {
  const navigate = useNavigate();
  const startGame = useGame((s) => s.startGame);
  const [step, setStep] = useState<'world' | 'territory' | 'nation'>('world');
  const [year, setYear] = useState(1200);
  const [setting, setSetting] = useState<'historical' | 'empty'>('historical');
  const [focus, setFocus] = useState('world');
  const [capital, setCapital] = useState<number | null>(null);
  const [size, setSize] = useState(8);
  const [name, setName] = useState('Kingdom of Aurelia');
  const [ruler, setRuler] = useState('Aurelian I');
  const [flag, setFlag] = useState<FlagDesign>(() => generatedFlag('Aurelia'));
  const [color, setColor] = useState('#8f5b4a');
  const [gov, setGov] = useState<GovernmentId>('monarchy');
  const [population, setPopulation] = useState(2_000_000);
  const [resources, setResources] = useState<'scarce' | 'standard' | 'abundant'>('standard');
  const [techEra, setTechEra] = useState(() => eraIndex(eraForYear(1200)));
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [meta, setMeta] = useState<ProvinceMeta[] | null>(null);
  const [adj, setAdj] = useState<number[][] | null>(null);
  const key = mapKeyForYear(year);
  const { data } = useDataset(key);
  useEffect(() => { void loadMeta().then(setMeta); void loadStatic().then((s) => setAdj(s.st.adjacency)); }, []);
  useEffect(() => { setTechEra(eraIndex(eraForYear(year))); }, [year]);

  const territory = useMemo(() => {
    if (capital === null || !adj) return [] as number[];
    const out = [capital]; const seen = new Set(out);
    for (let i = 0; i < out.length && out.length < size; i++) for (const j of adj[out[i]]) if (!seen.has(j)) { seen.add(j); out.push(j); if (out.length >= size) break; }
    return out;
  }, [capital, size, adj]);
  const highlight = useMemo(() => new Set(territory), [territory]);
  const focusProvince = useMemo(() => {
    if (!meta) return null;
    if (capital !== null) return capital;
    const f = FOCI.find((x) => x.id === focus)!;
    if (f.id === 'world') return null;
    let best = 0, bd = Infinity;
    meta.forEach((m, i) => { const d = distanceKm(m.x, m.y, f.lon, f.lat); if (d < bd) { bd = d; best = i; } });
    return best;
  }, [meta, focus, capital]);
  const govOptions = (Object.values(GOVERNMENTS)).filter((g) => g.minEra <= eraIndex(eraForYear(year)));
  const fills = useMemo(() => {
    if (!data) return [];
    return data.fills.map((f, i) => (highlight.has(i) ? color : setting === 'empty' ? '#cbb88f' : f));
  }, [data, highlight, color, setting]);

  const create = async () => {
    if (capital === null) return;
    await startGame(key, {
      name, start: { y: year, m: 0 }, mode: 'sandbox', difficulty, politicalSetting: setting,
      sandbox: { name, flag, color, government: gov, capital, provinces: territory, population, resources, techEra, rulerName: ruler },
    });
    navigate('/game');
  };

  return (
    <div>
      <SectionTitle kicker="Game mode two · Imperial Sandbox">Forge your own empire</SectionTitle>
      <div className="mb-4"><Tabs value={step} onChange={setStep} tabs={[{ id: 'world', label: '1 · World' }, { id: 'territory', label: '2 · Territory & capital' }, { id: 'nation', label: '3 · Nation' }]} /></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Panel className="!p-0 overflow-hidden">
          <div className="relative h-[560px]">
            {data && <WorldMap owners={data.owners} fills={fills} fillVersion={territory.length + color.length + (setting === 'empty' ? 1 : 0)} borderVersion={year} labels={setting === 'historical' ? data.labels : []} year={year} highlight={highlight} focusProvince={focusProvince}
              onProvinceClick={(id) => { setCapital(id); if (step === 'world') setStep('territory'); }} />}
            <div className="pointer-events-none absolute left-3 top-3 rounded bg-ink-950/80 px-3 py-1.5 text-xs text-parchment-100 ring-1 ring-gold-600/40"><MapPin className="mr-1 inline h-3.5 w-3.5 text-gold-300" />{capital === null ? 'Click the map to place your capital' : `Capital: ${meta?.[capital].n} · ${territory.length} provinces`}</div>
          </div>
        </Panel>
        <div className="space-y-4">
          {step === 'world' && (
            <Panel title="Era & world">
              <Field label={`Starting year: ${formatYear(year)}`} hint={`Supported ${formatYear(SUPPORTED_RANGE[0])} – ${SUPPORTED_RANGE[1]}. Borders from dataset ${formatYear(MAP_YEARS.find((m) => m.key === key)!.year)}.`}>
                <input type="range" min={SUPPORTED_RANGE[0]} max={SUPPORTED_RANGE[1]} value={year} onChange={(e) => { setYear(Number(e.target.value)); setCapital(null); }} className="w-full accent-gold-400" />
              </Field>
              <div className="mt-2 flex flex-wrap gap-1">{ERAS.map((e) => <button key={e.id} onClick={() => { setYear(e.defaultYear); setCapital(null); }} className={cx('rounded px-2 py-1 text-[11px]', eraForYear(year) === e.id ? 'bg-gold-400 text-ink-950' : 'bg-ink-950/60 text-parchment-200 hover:bg-ink-800')}>{e.name.replace(' Era', '')}</button>)}</div>
              <div className="mt-4"><span className="label">Geographic focus</span><div className="grid grid-cols-2 gap-1">{FOCI.map((f) => <button key={f.id} onClick={() => setFocus(f.id)} className={cx('rounded px-2 py-1.5 text-xs', focus === f.id ? 'bg-gold-500/20 ring-1 ring-gold-300' : 'bg-ink-950/50 hover:bg-ink-800')}>{f.label}</button>)}</div></div>
              <div className="mt-4"><span className="label">Political map</span>
                <div className="grid gap-1.5">
                  {([['historical', 'Historical world', 'Your nation is carved out of documented borders; historical states surround you.'], ['empty', 'Open world', 'Only your nation exists; all other land is unclaimed and can be settled.']] as const).map(([v, l, d]) => (
                    <button key={v} onClick={() => setSetting(v)} className={cx('rounded px-3 py-2 text-left ring-1', setting === v ? 'bg-gold-500/15 ring-gold-300' : 'ring-gold-700/30 hover:ring-gold-500')}><div className="text-sm font-semibold text-parchment-50">{l}</div><div className="text-xs text-parchment-300/70">{d}</div></button>
                  ))}
                </div>
              </div>
              <Button variant="gold" className="mt-4 w-full" onClick={() => setStep('territory')}>Next: territory</Button>
            </Panel>
          )}
          {step === 'territory' && (
            <Panel title="Territory & capital" subtitle="Click any land province to place the capital; territory grows outward along real borders.">
              <Field label={`Starting territory: ${size} provinces`}><Slider value={size} min={1} max={60} step={1} onChange={setSize} format={(v) => String(v)} /></Field>
              <Field label={`Initial population: ${fmtNum(population)}`}><Slider value={Math.log10(population)} min={4.7} max={8.3} step={0.01} onChange={(v) => setPopulation(Math.round(Math.pow(10, v)))} /></Field>
              <Field label="Starting resources"><Select value={resources} onChange={setResources} options={[{ value: 'scarce', label: 'Scarce — poor soils, empty treasury' }, { value: 'standard', label: 'Standard' }, { value: 'abundant', label: 'Abundant — fertile land, rich treasury' }]} /></Field>
              <div className="mt-3"><Field label="Technology level" hint="All technologies of earlier eras are known."><Select value={String(techEra)} onChange={(v) => setTechEra(Number(v))} options={ERAS.map((e, i) => ({ value: String(i), label: `${e.name} (${i * 6} techs)` }))} /></Field></div>
              {capital !== null && meta && <div className="mt-3 text-xs text-parchment-300/70">Capital province: <b className="text-gold-100">{meta[capital].n}</b> (modern {meta[capital].m}). {setting === 'historical' && data?.owners[capital] && <>Currently held by <Badge>{data.owners[capital]}</Badge></>}</div>}
              <Button variant="gold" className="mt-4 w-full" disabled={capital === null} onClick={() => setStep('nation')}>Next: nation</Button>
            </Panel>
          )}
          {step === 'nation' && (
            <Panel title="Your nation">
              <div className="mb-3 flex items-center gap-3"><Flag flag={flag} className="h-16 w-24 rounded shadow-panel" /><div><div className="title-display text-gold-100">{name}</div><div className="text-xs text-parchment-300/70">{GOVERNMENTS[gov].name}</div></div></div>
              <div className="space-y-3">
                <Field label="Country name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={48} /></Field>
                <Field label="Founding ruler"><input className="input" value={ruler} onChange={(e) => setRuler(e.target.value)} maxLength={40} /></Field>
                <Field label="Government"><Select value={gov} onChange={setGov} options={govOptions.map((g) => ({ value: g.id, label: g.name }))} /></Field>
                <p className="text-[11px] text-parchment-300/70">{GOVERNMENTS[gov].description}</p>
                <div><span className="label">Flag design</span>
                  <div className="grid grid-cols-6 gap-1">{PATTERNS.map((p) => <button key={p} onClick={() => setFlag({ ...flag, pattern: p })} className={cx('rounded p-0.5 ring-1', flag.pattern === p ? 'ring-gold-300' : 'ring-transparent')}><Flag flag={{ ...flag, pattern: p, emblem: 'none' }} className="h-6 w-9" /></button>)}</div>
                  {[0, 1, 2].map((ci) => <div key={ci} className="mt-1.5 flex flex-wrap gap-1"><span className="w-14 text-[10px] text-parchment-300/60">Colour {ci + 1}</span>{SWATCHES.map((s) => <button key={s} onClick={() => { const c = [...flag.colors] as FlagDesign['colors']; c[ci] = s; setFlag({ ...flag, colors: c }); }} className={cx('h-4 w-4 rounded-sm ring-1', flag.colors[ci] === s ? 'ring-gold-100' : 'ring-black/40')} style={{ background: s }} />)}</div>)}
                  <div className="mt-2 grid grid-cols-6 gap-1">{EMBLEMS.map((em) => <button key={em} onClick={() => setFlag({ ...flag, emblem: em })} className={cx('rounded p-0.5 ring-1', flag.emblem === em ? 'ring-gold-300' : 'ring-transparent')} title={em}><Flag flag={{ ...flag, emblem: em }} className="h-6 w-9" /></button>)}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1"><span className="w-14 text-[10px] text-parchment-300/60">Emblem</span>{SWATCHES.map((s) => <button key={s} onClick={() => setFlag({ ...flag, emblemColor: s })} className={cx('h-4 w-4 rounded-sm ring-1', flag.emblemColor === s ? 'ring-gold-100' : 'ring-black/40')} style={{ background: s }} />)}</div>
                  <button onClick={() => setFlag(generatedFlag(name + Math.random()))} className="mt-2 flex items-center gap-1 text-xs text-gold-300 hover:underline"><Dice5 className="h-3.5 w-3.5" />Randomise flag</button>
                </div>
                <div><span className="label">Map colour</span><div className="flex flex-wrap gap-1">{PALETTE.map((c) => <button key={c} onClick={() => setColor(c)} className={cx('h-5 w-5 rounded ring-1', color === c ? 'ring-gold-100' : 'ring-black/30')} style={{ background: c }} />)}</div></div>
                <Field label="Difficulty"><Select value={difficulty} onChange={setDifficulty} options={[{ value: 'story', label: 'Story' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }, { value: 'ironman', label: 'Ironman' }]} /></Field>
              </div>
              <Button variant="gold" size="lg" className="mt-4 w-full" disabled={capital === null || name.trim().length < 2} icon={<Crown className="h-4 w-4" />} onClick={() => void create()}>Found {name}</Button>
              <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-parchment-300/60"><Play className="h-3 w-3" />Starts paused — set your budget first.</div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
