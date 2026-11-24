import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Play, Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
import type { ConditionStat, CustomEventDef, EffectKind, EventCondition, EventEffect, ScenarioDefinition } from '../types/game';
import { MAP_YEARS, SUPPORTED_RANGE, eraForYear, formatYear, mapKeyForYear } from '../data/eras';
import { getCustom, saveCustom, validateScenario } from '../services/scenarios';
import { useDataset } from '../hooks/useDataset';
import { Badge, Button, Field, Panel, SectionTitle, Select, Slider, cx } from '../components/ui';
import { MONTHS } from '../engine/date';
import { useGame } from '../store/game';
import { ScenarioArt } from '../components/art/ScenarioArt';

const STATS: { value: ConditionStat; label: string }[] = [
  { value: 'year', label: 'Year' }, { value: 'stability', label: 'Stability' }, { value: 'treasury', label: 'Treasury' }, { value: 'population', label: 'Population' },
  { value: 'provinces', label: 'Provinces owned' }, { value: 'atWar', label: 'At war (1/0)' }, { value: 'foodStock', label: 'Food stock (months)' }, { value: 'tech', label: 'Tech level' }, { value: 'relation', label: 'Opinion of…' },
];
const EFFECTS: { value: EffectKind; label: string; needsOther?: boolean }[] = [
  { value: 'treasury', label: 'Treasury ±' }, { value: 'stability', label: 'Stability ±' }, { value: 'population', label: 'Population ±%' }, { value: 'foodStock', label: 'Food ± months' },
  { value: 'research', label: 'Research points +' }, { value: 'manpower', label: 'Army ± (thousands)' }, { value: 'opinion', label: 'Opinion of… ±', needsOther: true },
  { value: 'war', label: 'Declare war on…', needsOther: true }, { value: 'peace', label: 'Make peace with…', needsOther: true }, { value: 'transferProvinces', label: 'Cede N provinces to…', needsOther: true }, { value: 'killRuler', label: 'Ruler dies' },
];

function blank(): ScenarioDefinition {
  return {
    id: `custom-${Date.now().toString(36)}`, title: '', subtitle: '', question: 'What if ', mapKey: '1492', start: { y: 1492, m: 0 }, era: 'renaissance',
    background: [''], sourcesNote: 'Custom scenario written by a player. Historical claims in this description are the author\'s own.', focusCountries: [], recommended: '',
    characters: [], originalTimeline: [], decisions: [], consequences: [], custom: true, customEvents: [], artHue: 30, author: 'you',
  };
}
const newEvent = (i: number, s: ScenarioDefinition): CustomEventDef => ({ id: `ev${i + 1}-${Date.now().toString(36)}`, title: '', description: '', date: { ...s.start, y: s.start.y + 1 }, probability: 1, conditions: [], options: [{ id: 'a', label: 'Accept', effects: [] }], once: true });

export default function ScenarioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useGame((s) => s.toast);
  const startGame = useGame((s) => s.startGame);
  const [s, setS] = useState<ScenarioDefinition>(blank);
  const [q, setQ] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (id) void getCustom(id).then((d) => d && setS(d)); }, [id]);
  const { data } = useDataset(s.mapKey);
  const polities = useMemo(() => new Set((data?.polities ?? []).map((p) => p.name)), [data]);
  const errors = useMemo(() => validateScenario(s, polities), [s, polities]);
  const up = (p: Partial<ScenarioDefinition>) => { setS({ ...s, ...p }); setTouched(true); };
  const setYear = (y: number) => { const key = mapKeyForYear(y); up({ start: { ...s.start, y }, mapKey: key, era: eraForYear(y), focusCountries: key === s.mapKey ? s.focusCountries : [], recommended: key === s.mapKey ? s.recommended : '' }); };
  const events = s.customEvents ?? [];
  const setEvent = (i: number, e: CustomEventDef) => up({ customEvents: events.map((x, j) => (j === i ? e : x)) });
  const countryOpts = [{ value: 'player', label: 'Player country' }, ...s.focusCountries.map((c) => ({ value: c, label: c }))];

  const save = async () => { if (errors.length) { toast('Fix validation errors first.', 'bad'); return; } await saveCustom(s); setTouched(false); toast('Scenario saved.', 'good'); if (!id) navigate(`/editor/${s.id}`, { replace: true }); };
  const play = async () => { if (errors.length) return; await saveCustom(s); await startGame(s.mapKey, { name: s.title, start: s.start, mode: 'custom', player: s.recommended }, s); navigate('/game'); };

  return (
    <div>
      <SectionTitle kicker="What If scenario editor">{s.title || 'New scenario'}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Panel title="1 · The question">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" error={touched && s.title.trim().length < 3 ? 'Required' : null}><input className="input" value={s.title} onChange={(e) => up({ title: e.target.value })} placeholder="The Lost Armada" /></Field>
              <Field label="Subtitle"><input className="input" value={s.subtitle} onChange={(e) => up({ subtitle: e.target.value })} placeholder="English Channel, 1588" /></Field>
            </div>
            <div className="mt-3"><Field label="What if…?"><input className="input" value={s.question} onChange={(e) => up({ question: e.target.value })} /></Field></div>
            <div className="mt-3"><Field label="Background (one paragraph per line)" hint="Clearly distinguish documented facts from your alternative premise."><textarea className="input h-28" value={s.background.join('\n')} onChange={(e) => up({ background: e.target.value.split('\n') })} /></Field></div>
            <div className="mt-3"><span className="label">Banner hue</span><Slider value={s.artHue} min={0} max={359} step={1} onChange={(v) => up({ artHue: v })} format={(v) => `${v}°`} /></div>
          </Panel>
          <Panel title="2 · Starting date & world">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Start year" hint={`${formatYear(SUPPORTED_RANGE[0])} – ${SUPPORTED_RANGE[1]}`}><input type="number" className="input" value={s.start.y} onChange={(e) => setYear(Number(e.target.value))} /></Field>
              <Field label="Month"><Select value={String(s.start.m)} onChange={(v) => up({ start: { ...s.start, m: Number(v) } })} options={MONTHS.map((m, i) => ({ value: String(i), label: m }))} /></Field>
              <Field label="Border dataset" hint="Must not be later than the start"><Select value={s.mapKey} onChange={(v) => up({ mapKey: v, focusCountries: [], recommended: '' })} options={MAP_YEARS.filter((m) => m.year <= s.start.y).map((m) => ({ value: m.key, label: formatYear(m.year) }))} /></Field>
            </div>
          </Panel>
          <Panel title="3 · Countries" subtitle={`${s.focusCountries.length} selected from ${polities.size} polities in the dataset`}>
            <input className="input mb-2" placeholder="Search polities…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="scroll-thin grid max-h-52 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {(data?.polities ?? []).filter((p) => !p.tribal && p.name.toLowerCase().includes(q.toLowerCase())).map((p) => {
                const on = s.focusCountries.includes(p.name);
                return <label key={p.name} className={cx('flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm', on ? 'bg-gold-500/15' : 'hover:bg-ink-800')}><input type="checkbox" checked={on} onChange={() => up({ focusCountries: on ? s.focusCountries.filter((x) => x !== p.name) : [...s.focusCountries, p.name] })} /><span className="truncate">{p.name}</span><span className="ml-auto text-[10px] text-parchment-300/50">{p.provinces}</span></label>;
              })}
            </div>
            <div className="mt-3"><Field label="Player country"><Select value={s.recommended} onChange={(v) => up({ recommended: v })} options={[{ value: '', label: '— choose —' }, ...s.focusCountries.map((c) => ({ value: c, label: c }))]} /></Field></div>
          </Panel>
          <Panel title="4 · Custom events" subtitle="Events fire when their date is reached and all conditions hold. Player events offer choices; AI countries take the first outcome." actions={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => up({ customEvents: [...events, newEvent(events.length, s)] })}>Add event</Button>}>
            {!events.length && <p className="text-sm text-parchment-300/60">No events yet.</p>}
            <div className="space-y-4">
              {events.map((e, i) => (
                <div key={e.id} className="rounded-md bg-ink-950/40 p-3 ring-1 ring-gold-700/30">
                  <div className="flex items-center gap-2"><Badge>Event {i + 1}</Badge><input className="input flex-1" placeholder="Event title" value={e.title} onChange={(x) => setEvent(i, { ...e, title: x.target.value })} /><button onClick={() => up({ customEvents: events.filter((_, j) => j !== i) })} className="rounded p-1.5 hover:bg-ink-800"><Trash2 className="h-4 w-4 text-blood-400" /></button></div>
                  <textarea className="input mt-2 h-16" placeholder="What happens (shown to the player)" value={e.description} onChange={(x) => setEvent(i, { ...e, description: x.target.value })} />
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Field label="Not before year"><input type="number" className="input" value={e.date?.y ?? s.start.y} onChange={(x) => setEvent(i, { ...e, date: { y: Number(x.target.value), m: e.date?.m ?? 0 } })} /></Field>
                    <Field label="Month"><Select value={String(e.date?.m ?? 0)} onChange={(v) => setEvent(i, { ...e, date: { y: e.date?.y ?? s.start.y, m: Number(v) } })} options={MONTHS.map((m, k) => ({ value: String(k), label: m.slice(0, 3) }))} /></Field>
                    <Field label="Monthly probability"><input type="number" step="0.05" min="0.01" max="1" className="input" value={e.probability} onChange={(x) => setEvent(i, { ...e, probability: Number(x.target.value) })} /></Field>
                    <label className="mt-6 flex items-center gap-2 text-xs"><input type="checkbox" checked={e.once} onChange={(x) => setEvent(i, { ...e, once: x.target.checked })} />Fire once</label>
                  </div>
                  <div className="mt-3"><span className="label">Conditions (all must hold)</span>
                    {e.conditions.map((c, k) => <CondRow key={k} c={c} countries={countryOpts} onChange={(nc) => setEvent(i, { ...e, conditions: e.conditions.map((x, j) => (j === k ? nc : x)) })} onRemove={() => setEvent(i, { ...e, conditions: e.conditions.filter((_, j) => j !== k) })} />)}
                    <button className="text-xs text-gold-300 hover:underline" onClick={() => setEvent(i, { ...e, conditions: [...e.conditions, { country: 'player', stat: 'stability', op: '<', value: 30 }] })}>+ condition</button>
                  </div>
                  <div className="mt-3"><span className="label">Outcomes</span>
                    {e.options.map((o, k) => (
                      <div key={o.id} className="mb-2 rounded bg-ink-900/60 p-2 ring-1 ring-gold-700/20">
                        <div className="flex gap-2"><input className="input" value={o.label} onChange={(x) => setEvent(i, { ...e, options: e.options.map((y, j) => (j === k ? { ...o, label: x.target.value } : y)) })} />{e.options.length > 1 && <button onClick={() => setEvent(i, { ...e, options: e.options.filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4 text-blood-400" /></button>}</div>
                        {o.effects.map((ef, m) => <EffRow key={m} ef={ef} countries={countryOpts} onChange={(ne) => setEvent(i, { ...e, options: e.options.map((y, j) => (j === k ? { ...o, effects: o.effects.map((z, n) => (n === m ? ne : z)) } : y)) })} onRemove={() => setEvent(i, { ...e, options: e.options.map((y, j) => (j === k ? { ...o, effects: o.effects.filter((_, n) => n !== m) } : y)) })} />)}
                        <button className="text-xs text-gold-300 hover:underline" onClick={() => setEvent(i, { ...e, options: e.options.map((y, j) => (j === k ? { ...o, effects: [...o.effects, { kind: 'treasury', country: 'player', value: 100 }] } : y)) })}>+ effect</button>
                      </div>
                    ))}
                    <button className="text-xs text-gold-300 hover:underline" onClick={() => setEvent(i, { ...e, options: [...e.options, { id: String.fromCharCode(97 + e.options.length), label: 'Alternative', effects: [] }] })}>+ alternative outcome</button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Panel className="!p-0 overflow-hidden"><div className="relative h-36"><ScenarioArt hue={s.artHue} year={formatYear(s.start.y)} className="absolute inset-0 h-full w-full" /><div className="absolute bottom-3 left-4"><div className="title-display text-lg text-gold-50">{s.title || 'Untitled'}</div><div className="font-serif italic text-parchment-100">{s.question}</div></div></div></Panel>
          <Panel title="Validation">
            {errors.length ? <ul className="space-y-1 text-sm text-blood-400">{errors.map((e, i) => <li key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{e}</li>)}</ul> : <div className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />Scenario is valid and playable.</div>}
            <div className="mt-4 grid gap-2">
              <Button variant="gold" icon={<Save className="h-4 w-4" />} disabled={!!errors.length} onClick={() => void save()}>Save scenario</Button>
              <Button icon={<Play className="h-4 w-4" />} disabled={!!errors.length} onClick={() => void play()}>Save & play test</Button>
            </div>
            <p className="mt-3 text-[11px] text-parchment-300/60">Share or publish it from the Scenario Library → My scenarios.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CondRow({ c, countries, onChange, onRemove }: { c: EventCondition; countries: { value: string; label: string }[]; onChange: (c: EventCondition) => void; onRemove: () => void }) {
  return (
    <div className="mb-1.5 grid grid-cols-[1fr_1fr_3.5rem_5rem_auto] items-center gap-1.5">
      <Select value={c.country} onChange={(v) => onChange({ ...c, country: v })} options={countries} className="!py-1 !text-xs" />
      <Select value={c.stat} onChange={(v) => onChange({ ...c, stat: v })} options={STATS} className="!py-1 !text-xs" />
      <Select value={c.op} onChange={(v) => onChange({ ...c, op: v })} options={[{ value: '<', label: '<' }, { value: '>', label: '>' }, { value: '=', label: '=' }]} className="!py-1 !text-xs" />
      <input type="number" className="input !py-1 !text-xs" value={c.value} onChange={(e) => onChange({ ...c, value: Number(e.target.value) })} />
      <button onClick={onRemove}><Trash2 className="h-3.5 w-3.5 text-blood-400" /></button>
      {c.stat === 'relation' && <div className="col-span-5"><Select value={c.other ?? ''} onChange={(v) => onChange({ ...c, other: v })} options={[{ value: '', label: 'towards…' }, ...countries]} className="!py-1 !text-xs" /></div>}
    </div>
  );
}
function EffRow({ ef, countries, onChange, onRemove }: { ef: EventEffect; countries: { value: string; label: string }[]; onChange: (e: EventEffect) => void; onRemove: () => void }) {
  const needs = EFFECTS.find((x) => x.value === ef.kind)?.needsOther;
  return (
    <div className="my-1.5 grid grid-cols-[1fr_1fr_5rem_auto] items-center gap-1.5">
      <Select value={ef.country} onChange={(v) => onChange({ ...ef, country: v })} options={countries} className="!py-1 !text-xs" />
      <Select value={ef.kind} onChange={(v) => onChange({ ...ef, kind: v })} options={EFFECTS} className="!py-1 !text-xs" />
      <input type="number" className="input !py-1 !text-xs" value={ef.value} onChange={(e) => onChange({ ...ef, value: Number(e.target.value) })} />
      <button onClick={onRemove}><Trash2 className="h-3.5 w-3.5 text-blood-400" /></button>
      {needs && <div className="col-span-4"><Select value={ef.other ?? ''} onChange={(v) => onChange({ ...ef, other: v })} options={[{ value: '', label: 'target country…' }, ...countries]} className="!py-1 !text-xs" /></div>}
    </div>
  );
}
