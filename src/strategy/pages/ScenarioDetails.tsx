import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Heart, Play, Users } from 'lucide-react';
import { SCENARIO_BY_ID } from '../data/scenarios';
import { getCustom } from '../services/scenarios';
import type { Difficulty, ScenarioDefinition } from '../types/game';
import { ScenarioArt } from '../components/art/ScenarioArt';
import { Badge, Button, EmptyState, FactBadge, Loading, Panel, Select, cx } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import { PROFILES, generatedFlag } from '../data/polities';
import { formatYear } from '../data/eras';
import { MONTHS } from '../engine/date';
import { useGame } from '../store/game';
import { useProfile } from '../services/profile';
import { useDataset } from '../hooks/useDataset';
import { WorldMap } from '../components/map/WorldMap';

export default function ScenarioDetails() {
  const { id = '' } = useParams();
  const [def, setDef] = useState<ScenarioDefinition | null | undefined>(SCENARIO_BY_ID[id]);
  useEffect(() => { if (!SCENARIO_BY_ID[id]) void getCustom(id).then((d) => setDef(d ?? null)); }, [id]);
  if (def === undefined) return <Loading />;
  if (def === null) return <EmptyState title="Scenario not found" action={<Link className="btn-ghost mt-3" to="/library">Back to library</Link>} />;
  return <Details def={def} />;
}

function Details({ def }: { def: ScenarioDefinition }) {
  const navigate = useNavigate();
  const startGame = useGame((s) => s.startGame);
  const favorites = useProfile((s) => s.favorites);
  const toggleFav = useProfile((s) => s.toggleFavorite);
  const [choices, setChoices] = useState<Record<string, string>>(() => Object.fromEntries(def.decisions.map((d) => [d.id, d.options.find((o) => o.historical)?.id ?? d.options[0].id])));
  const [player, setPlayer] = useState(def.recommended);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const { data } = useDataset(def.mapKey);
  const active = (d: ScenarioDefinition['decisions'][number]) => !d.dependsOn || choices[d.dependsOn.decision] === d.dependsOn.option;
  const divergent = def.decisions.filter((d) => active(d) && !d.options.find((o) => o.id === choices[d.id])?.historical);
  const consequences = def.consequences.filter((c) => choices[c.decision] === c.option && active(def.decisions.find((d) => d.id === c.decision)!));
  const highlight = useMemo(() => (data ? new Set(data.owners.map((o, i) => (o && def.focusCountries.includes(o) ? i : -1)).filter((i) => i >= 0)) : null), [data, def]);

  const start = async () => {
    const decisions: Record<string, string> = {};
    for (const d of def.decisions) if (active(d)) decisions[d.id] = choices[d.id];
    await startGame(def.mapKey, { name: def.title, start: def.start, mode: def.custom ? 'custom' : 'scenario', scenarioId: def.custom ? null : def.id, decisions, player, difficulty }, def.custom ? def : null);
    navigate('/game');
  };

  return (
    <div>
      <Link to="/scenarios" className="mb-4 inline-flex items-center gap-1 text-xs text-gold-300 hover:underline"><ArrowLeft className="h-3.5 w-3.5" />All scenarios</Link>
      <div className="panel relative mb-6 h-64 overflow-hidden">
        <ScenarioArt hue={def.artHue} year={formatYear(def.start.y)} seed={def.id.length} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/60 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-6">
          <div className="text-[11px] uppercase tracking-[0.3em] text-gold-300">{def.subtitle} · {MONTHS[def.start.m]} {formatYear(def.start.y)}</div>
          <h1 className="title-display gold-text mt-1 text-3xl md:text-4xl">{def.title}</h1>
          <p className="mt-2 max-w-2xl font-serif text-xl italic text-parchment-50">{def.question}</p>
          <button onClick={() => toggleFav(def.id)} className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-ink-950/70 px-3 py-1.5 text-xs text-parchment-100 ring-1 ring-gold-600/40 hover:ring-gold-300"><Heart className={cx('h-3.5 w-3.5', favorites.includes(def.id) && 'fill-blood-400 text-blood-400')} />{favorites.includes(def.id) ? 'Favourite' : 'Add to favourites'}</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Historical background" subtitle={<FactBadge factual />}>
            <div className="space-y-3 font-serif text-[17px] leading-relaxed text-parchment-100/90">{def.background.map((p, i) => <p key={i}>{p}</p>)}</div>
            <p className="mt-3 text-[11px] text-parchment-300/60">{def.sourcesNote}</p>
            {def.sensitivity && <div className="mt-3 flex gap-2 rounded-md bg-blood-600/10 p-3 text-sm text-parchment-100 ring-1 ring-blood-400/30"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blood-400" /><span>{def.sensitivity}</span></div>}
          </Panel>
          <Panel title="Divergence points" subtitle="Choose how history turns. Options marked “historical” reproduce documented events.">
            <div className="space-y-4">
              {def.decisions.map((d) => (
                <div key={d.id} className={cx('rounded-md p-3 ring-1', active(d) ? 'ring-gold-600/30' : 'opacity-40 ring-white/5')}>
                  <div className="font-semibold text-gold-100">{d.question}</div>
                  <div className="mb-2 text-xs text-parchment-300/60">{d.context}{!active(d) && ' — not applicable with your other choices.'}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {d.options.map((o) => (
                      <button key={o.id} disabled={!active(d)} onClick={() => setChoices({ ...choices, [d.id]: o.id })} className={cx('rounded-md px-3 py-2 text-left ring-1 transition', choices[d.id] === o.id ? 'bg-gold-500/15 ring-gold-300' : 'bg-ink-950/50 ring-gold-700/30 hover:ring-gold-500')}>
                        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-parchment-50">{o.label}{o.historical ? <Badge tone="blue">historical</Badge> : <Badge tone="purple">alternative</Badge>}</div>
                        <div className="mt-0.5 text-xs text-parchment-300/70">{o.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!def.decisions.length && <p className="text-sm text-parchment-300/70">This custom scenario uses scripted events instead of pre-game decisions.</p>}
            </div>
          </Panel>
          <Panel title="Original timeline" subtitle={<FactBadge factual />}>
            <ol className="relative space-y-3 border-l border-gold-600/30 pl-5">
              {def.originalTimeline.map((e, i) => (
                <li key={i}><span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-sky-400" /><div className="text-xs text-sky-300">{MONTHS[e.date.m]} {formatYear(e.date.y)}</div><div className="font-semibold text-parchment-50">{e.title}</div><div className="text-sm text-parchment-200/70">{e.text}</div></li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Starting world" className="!p-0 overflow-hidden"><div className="relative h-56">{data && <WorldMap owners={data.owners} fills={data.fills} fillVersion={1} borderVersion={2} labels={data.labels} year={def.start.y} highlight={highlight} showControls={false} />}</div></Panel>
          <Panel title="Expected consequences of your choices" subtitle={divergent.length ? `${divergent.length} divergence(s) from documented history` : 'Following documented history at the start'}>
            {consequences.length ? <ul className="space-y-2 text-sm text-parchment-100">{consequences.map((c, i) => <li key={i} className="rounded bg-purple-500/10 px-3 py-2 ring-1 ring-purple-400/20">{c.text}</li>)}</ul> : <p className="text-sm text-parchment-300/70">No immediate setup changes.</p>}
            <p className="mt-3 text-[11px] text-parchment-300/60">These are initial state changes only. Everything afterwards — wars, successions, collapse or survival — is resolved by the simulation, so replays diverge.</p>
          </Panel>
          <Panel title="Main historical characters">
            <div className="space-y-2">{def.characters.map((c) => <div key={c.name} className="rounded bg-ink-950/50 px-3 py-2 ring-1 ring-gold-700/20"><div className="flex justify-between text-sm"><span className="font-semibold text-gold-100">{c.name}</span><span className="text-[11px] text-parchment-300/60">{c.years}</span></div><div className="text-[11px] text-gold-300/80">{c.role}</div><div className="text-xs text-parchment-200/70">{c.bio}</div></div>)}</div>
          </Panel>
          <Panel title="Play as">
            <div className="space-y-1.5">
              {def.focusCountries.map((n) => (
                <button key={n} onClick={() => setPlayer(n)} className={cx('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm', player === n ? 'bg-gold-500/15 ring-1 ring-gold-300' : 'hover:bg-ink-800')}>
                  <Flag flag={PROFILES[n]?.flag ?? generatedFlag(n)} className="h-5 w-7 rounded-sm" /><span className="flex-1 text-parchment-50">{n}</span>{n === def.recommended && <Badge>recommended</Badge>}
                </button>
              ))}
            </div>
            <div className="mt-3"><span className="label">Difficulty</span><Select value={difficulty} onChange={setDifficulty} options={[{ value: 'story', label: 'Story' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }, { value: 'ironman', label: 'Ironman' }]} /></div>
            <Button variant="gold" size="lg" className="mt-4 w-full" icon={<Play className="h-4 w-4" />} onClick={() => void start()}>Begin the timeline</Button>
            <Link to={`/multiplayer?scenario=${def.id}`} className="mt-2 flex items-center justify-center gap-1 text-xs text-gold-300 hover:underline"><Users className="h-3.5 w-3.5" />Play this scenario in multiplayer</Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}
