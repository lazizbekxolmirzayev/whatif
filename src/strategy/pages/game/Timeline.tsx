import { useMemo, useState } from 'react';
import { usePlayer } from './common';
import { Button, FactBadge, Panel, Tabs, cx } from '../../components/ui';
import { fmtDate } from '../../engine/date';
import { useGame } from '../../store/game';
import type { TimelineKind } from '../../types/game';

const KIND_COLOR: Partial<Record<TimelineKind, string>> = { war: '#c2493d', peace: '#4fa08b', collapse: '#7c271f', founding: '#d9b65c', divergence: '#a06cd5', historical: '#5f9fae', succession: '#c9925f', technology: '#7fa87a', rebellion: '#b8573a', disaster: '#8a6a9a' };
const PAGE = 30;
export default function TimelinePage() {
  const { w } = usePlayer();
  const select = useGame((s) => s.select);
  const [filter, setFilter] = useState<'major' | 'mine' | 'all' | 'facts'>('major');
  const [page, setPage] = useState(0);
  const items = useMemo(() => w.timeline.filter((t) => filter === 'all' || (filter === 'major' ? t.importance >= 2 : filter === 'facts' ? t.factual : w.player ? t.countries.includes(w.player) : true))
    .slice().sort((a, b) => (b.date.y * 12 + b.date.m) - (a.date.y * 12 + a.date.m)), [w.timeline.length, filter, w.player]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={filter} onChange={(f) => { setFilter(f); setPage(0); }} tabs={[{ id: 'major', label: 'Major events' }, { id: 'mine', label: 'My nation' }, { id: 'facts', label: 'Documented history' }, { id: 'all', label: `Everything (${w.timeline.length})` }]} />
        <div className="text-xs text-parchment-300/60">{fmtDate(w.startDate)} → {fmtDate(w.date)}</div>
      </div>
      <Panel>
        <ol className="relative ml-2 space-y-4 border-l border-gold-600/30 pl-6">
          {shown.map((t) => (
            <li key={t.id} className="relative">
              <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-ink-900" style={{ background: KIND_COLOR[t.kind] ?? '#d9b65c' }} />
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="title-display text-gold-300">{fmtDate(t.date)}</span><span className="uppercase tracking-wider text-parchment-300/50">{t.kind}</span><FactBadge factual={t.factual} /></div>
              <div className={cx('mt-0.5 font-semibold', t.importance >= 3 ? 'text-lg text-gold-50' : 'text-parchment-50')}>{t.title}</div>
              <p className="text-sm text-parchment-200/80">{t.text}</p>
              {t.countries.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{t.countries.slice(0, 5).map((id) => w.countries[id] && <button key={id} onClick={() => select(w.countries[id].capital, id)} className="text-[11px] text-gold-300 hover:underline">{w.countries[id].name}</button>)}</div>}
            </li>
          ))}
          {!shown.length && <li className="text-sm text-parchment-300/60">Nothing recorded yet — advance time.</li>}
        </ol>
        <div className="mt-4 flex items-center justify-center gap-2"><Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button><span className="text-xs">{page + 1} / {Math.max(1, Math.ceil(items.length / PAGE))}</span><Button size="sm" disabled={(page + 1) * PAGE >= items.length} onClick={() => setPage(page + 1)}>Older</Button></div>
      </Panel>
    </div>
  );
}
