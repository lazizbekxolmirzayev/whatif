import { useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles, LineChart as LC } from 'lucide-react';
import { usePlayer } from './common';
import { Badge, Button, Panel, Select, cx } from '../../components/ui';
import { LineChart } from '../../components/ui/Charts';
import { answerQuestion, projectCommands, recommendations, type HistorianAnswer, type ProjectionResult } from '../../engine/historian';
import { askLLM, llmAvailable } from '../../services/historianApi';
import { useGame } from '../../store/game';
import type { Command } from '../../types/game';
import { fmtNum } from '../../engine/util';

interface Msg { role: 'user' | 'historian'; text?: string; answer?: HistorianAnswer; llm?: boolean; error?: string }
const SUGGEST = ['Why did my economy enter a crisis?', 'What made the strongest empire powerful?', 'Why did population decline?', 'What could happen if my alliance ends?', 'What are the possible consequences of my next decision?', 'How is my war going?'];

export default function HistorianPage() {
  const { w, c } = usePlayer();
  const st = useGame((s) => s.st)!;
  const selected = useGame((s) => s.selectedCountry);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [useLLM, setUseLLM] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setQ('');
    const local = answerQuestion(w, question, selected ?? w.player);
    if (useLLM && llmAvailable()) {
      setBusy(true);
      try { const text = await askLLM(w, question, selected ?? w.player); setMsgs((m) => [...m, { role: 'historian', text, llm: true, answer: local }]); }
      catch (e) { setMsgs((m) => [...m, { role: 'historian', answer: local, error: `AI service unavailable (${(e as Error).message}) — showing the built-in analysis.` }]); }
      setBusy(false);
    } else setMsgs((m) => [...m, { role: 'historian', answer: local }]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Panel title="AI Historian" subtitle="Answers are derived from this world's simulation data. Simulated events are never presented as documented history." actions={
        <div className="flex items-center gap-2 text-xs"><Badge tone={useLLM && llmAvailable() ? 'purple' : 'blue'}>{useLLM && llmAvailable() ? 'Language model + game data' : 'Built-in analysis engine'}</Badge>
          {llmAvailable() && <label className="flex items-center gap-1"><input type="checkbox" checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} />Use AI model</label>}</div>}>
        {!llmAvailable() && <p className="mb-3 rounded bg-sky-500/10 p-2 text-[11px] text-sky-200 ring-1 ring-sky-400/20">No AI API is configured (Supabase Edge Function “ai-historian” with a server-side key). You are using the clearly-labelled fallback: a rule-based historian that reads the simulation state, logs and snapshots.</p>}
        <div className="scroll-thin max-h-[55vh] min-h-[200px] space-y-3 overflow-y-auto pr-1">
          {!msgs.length && <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => void ask(s)} className="rounded-full bg-ink-950/60 px-3 py-1.5 text-xs text-parchment-100 ring-1 ring-gold-600/40 hover:ring-gold-300">{s}</button>)}</div>}
          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-gold-500/15 px-3 py-2 text-sm text-parchment-50 ring-1 ring-gold-400/30">{m.text}</div>
          ) : (
            <div key={i} className="max-w-[95%] rounded-lg bg-ink-950/60 px-4 py-3 ring-1 ring-gold-700/30">
              <div className="mb-1 flex items-center gap-2 text-xs text-gold-300"><Bot className="h-3.5 w-3.5" />{m.llm ? 'AI Historian (language model, grounded in game data)' : 'Historian (built-in analysis)'}</div>
              {m.error && <p className="mb-2 text-xs text-blood-400">{m.error}</p>}
              {m.llm && m.text ? <div className="whitespace-pre-wrap font-serif text-[16px] leading-relaxed text-parchment-100">{m.text}</div> : m.answer && <>
                <div className="title-display mb-1 text-sm text-gold-100">{m.answer.title}</div>
                {m.answer.paragraphs.map((p, j) => <p key={j} className="mb-1.5 font-serif text-[16px] leading-relaxed text-parchment-100">{p}</p>)}
                {m.answer.facts.length > 0 && <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">{m.answer.facts.map((f) => <div key={f.label} className="rounded bg-ink-900 px-2 py-1"><span className="text-parchment-300/60">{f.label}: </span>{f.value}</div>)}</div>}
                {m.answer.references.length > 0 && <details className="mt-2 text-[11px] text-parchment-300/70"><summary className="cursor-pointer">Sources in the simulation log ({m.answer.references.length})</summary><ul className="mt-1 list-disc pl-4">{m.answer.references.map((r, j) => <li key={j}>{r}</li>)}</ul></details>}
              </>}
            </div>
          ))}
          {busy && <div className="text-xs text-gold-300"><Sparkles className="mr-1 inline h-3.5 w-3.5 animate-pulse" />Consulting the archives…</div>}
          <div ref={endRef} />
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about any country, war, economy or decision… (names are recognised)" />
          <Button variant="gold" type="submit" icon={<Send className="h-4 w-4" />} disabled={busy}>Ask</Button>
        </form>
      </Panel>
      {c && c.alive && <Projection key={c.id} st={st} />}
    </div>
  );
}

function Projection({ st }: { st: NonNullable<ReturnType<typeof useGame.getState>['st']> }) {
  const { w, c } = usePlayer();
  const [kind, setKind] = useState('tax+5');
  const [target, setTarget] = useState('');
  const [res, setRes] = useState<ProjectionResult | null>(null);
  const [running, setRunning] = useState(false);
  const recs = useMemo(() => (c ? recommendations(w, c) : []), [w, c]);
  if (!c) return null;
  const others = Object.values(w.countries).filter((o) => o.alive && !o.tribal && o.id !== c.id).sort((a, b) => b.pop.total - a.pop.total).slice(0, 60);
  const build = (): Command[] => {
    switch (kind) {
      case 'tax+5': return [{ type: 'setTax', country: c.id, rate: c.economy.taxRate + 0.05 }];
      case 'tax-5': return [{ type: 'setTax', country: c.id, rate: Math.max(0, c.economy.taxRate - 0.05) }];
      case 'agri': return [{ type: 'setBudget', country: c.id, spendingRate: c.economy.spendingRate, budget: { ...c.economy.budget, agriculture: c.economy.budget.agriculture + 0.25 } }];
      case 'army': return [{ type: 'recruit', country: c.id, amount: Math.floor(c.military.manpower * 0.5) }];
      case 'war': return target ? [{ type: 'diplo', country: c.id, target, action: 'declareWar' }] : [];
      case 'break': return target ? [{ type: 'diplo', country: c.id, target, action: 'breakAlliance' }] : [];
      case 'food': return [{ type: 'buyFood', country: c.id, amount: 3 }];
      default: return [];
    }
  };
  const run = () => { setRunning(true); setTimeout(() => { setRes(projectCommands(w, st, c.id, build(), 12)); setRunning(false); }, 30); };
  return (
    <Panel title="Project consequences" subtitle="Runs the real simulation 12 months ahead on two copies of this world — with and without the decision — using the same random seed.">
      <div className="space-y-2">
        <Select value={kind} onChange={setKind} options={[{ value: 'tax+5', label: 'Raise taxes by 5 points' }, { value: 'tax-5', label: 'Lower taxes by 5 points' }, { value: 'agri', label: 'Shift budget toward agriculture' }, { value: 'army', label: 'Recruit half of available manpower' }, { value: 'food', label: 'Import 3 months of grain' }, { value: 'war', label: 'Declare war on…' }, { value: 'break', label: 'End alliance with…' }]} />
        {(kind === 'war' || kind === 'break') && <Select value={target} onChange={setTarget} options={[{ value: '', label: 'Choose a country' }, ...others.map((o) => ({ value: o.id, label: o.name }))]} />}
        <Button variant="gold" icon={<LC className="h-4 w-4" />} loading={running} disabled={(kind === 'war' || kind === 'break') && !target} onClick={run}>Simulate 12 months</Button>
      </div>
      {res && <div className="mt-4">
        {res.message && <p className="mb-2 text-xs text-parchment-300/70">Command check: {res.message}</p>}
        <LineChart xLabel={(x) => `+${x}m`} series={[{ name: 'Treasury (decision)', color: '#e8d08a', points: res.variant.map((p) => ({ x: p.month, y: p.treasury })) }, { name: 'Treasury (no change)', color: '#5f9fae', dashed: true, points: res.baseline.map((p) => ({ x: p.month, y: p.treasury })) }]} />
        <LineChart height={130} xLabel={(x) => `+${x}m`} series={[{ name: 'Stability (decision)', color: '#c2493d', points: res.variant.map((p) => ({ x: p.month, y: p.stability })) }, { name: 'Stability (no change)', color: '#4fa08b', dashed: true, points: res.baseline.map((p) => ({ x: p.month, y: p.stability })) }]} />
        <ul className="mt-2 space-y-0.5 text-xs text-parchment-100">{res.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="mt-2 text-[10px] text-parchment-300/50">Projection only — the real world is unchanged.</p>
      </div>}
      <div className="mt-4"><div className="label">Recommended now</div><ul className="space-y-1 text-xs">{recs.map((r, i) => <li key={i} className={cx('rounded bg-ink-950/50 px-2 py-1')}>{r.text}</li>)}{!recs.length && <li className="text-parchment-300/60">No urgent issues. Treasury {fmtNum(c.economy.treasury)}.</li>}</ul></div>
    </Panel>
  );
}
