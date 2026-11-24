import { useMemo, useState } from 'react';
import { usePlayer } from './common';
import { Badge, FactBadge, Panel, Stat } from '../../components/ui';
import { WorldMap } from '../../components/map/WorldMap';
import { useDataset } from '../../hooks/useDataset';
import { MAP_YEARS, mapKeyForYear, formatYear } from '../../data/eras';
import { decodeOwners, encodeOwners } from '../../engine/tick';
import { fmtNum } from '../../engine/util';
import { worldPopulation } from '../../data/regions';
import { SCENARIO_BY_ID } from '../../data/scenarios';
import { fmtDate } from '../../engine/date';
import { mix } from '../../lib/mapColors';
import { LineChart } from '../../components/ui/Charts';

export default function ComparePage() {
  const { w } = usePlayer();
  const snaps = useMemo(() => (w.ownership.length && w.ownership[w.ownership.length - 1].year === w.date.y ? w.ownership : [...w.ownership, { year: w.date.y, owners: encodeOwners(w) }]), [w, w.date.y, w.stats.ticks]); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(snaps.length - 1);
  const snap = snaps[Math.max(0, Math.min(idx, snaps.length - 1))];
  const year = snap?.year ?? w.date.y;
  const histKey = mapKeyForYear(year);
  const histYear = MAP_YEARS.find((m) => m.key === histKey)!.year;
  const { data: hist } = useDataset(histKey);
  const alt = useMemo(() => {
    if (!snap) return null;
    const owners = decodeOwners(w, snap.owners);
    const fills = owners.map((o) => (o && w.countries[o] ? mix(w.countries[o].tribal ? '#9a9a8a' : w.countries[o].color, '#e3d2a8', 0.18) : '#cbb88f'));
    const names = owners.map((o) => (o ? w.countries[o]?.name ?? null : null));
    const labels = Array.from(new Set(owners.filter(Boolean) as string[])).filter((id) => !w.countries[id]?.tribal).map((id) => ({ owner: id, name: w.countries[id].name }));
    return { owners, fills, names, labels };
  }, [w, snap]);
  const diverged = useMemo(() => {
    if (!hist || !alt) return null;
    let diff = 0, n = 0;
    hist.owners.forEach((h, i) => { if (!h && !alt.names[i]) return; n++; if (h !== alt.names[i]) diff++; });
    return n ? diff / n : 0;
  }, [hist, alt]);
  const histStates = hist ? hist.polities.filter((p) => !p.tribal).length : 0;
  const altStates = alt ? new Set(alt.owners.filter((o) => o && !w.countries[o]?.tribal)).size : 0;
  const simPop = w.history.find((h) => h.year === year)?.world.pop ?? 0;
  const sc = w.scenarioId ? SCENARIO_BY_ID[w.scenarioId] : null;
  const altEvents = w.timeline.filter((t) => t.importance >= 2 && !t.factual).slice(-14).reverse();
  const created = Object.values(w.countries).filter((c) => !c.historical || c.origin !== 'dataset').length;
  const collapsed = Object.values(w.countries).filter((c) => !c.alive && c.collapsed).length;

  if (!snaps.length) return <p className="text-sm text-parchment-300/70">No snapshots yet.</p>;
  return (
    <div className="space-y-4">
      <Panel title="Compare year" subtitle={`Ownership snapshots every 5 years plus the present (${snaps.length}). The historical side shows the nearest documented dataset at or before that year.`}>
        <input type="range" min={0} max={snaps.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="w-full accent-gold-400" />
        <div className="mt-1 flex justify-between text-xs text-parchment-300/70"><span>{formatYear(snaps[0].year)}</span><span className="title-display text-gold-100">{formatYear(year)}</span><span>{formatYear(snaps[snaps.length - 1].year)}</span></div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-2">
        <Panel className="!p-0 overflow-hidden" title={undefined}>
          <div className="flex items-center justify-between px-3 py-2"><span className="title-display text-xs text-gold-200">Original history · {formatYear(histYear)}</span><FactBadge factual /></div>
          <div className="relative h-72">{hist && <WorldMap owners={hist.owners} fills={hist.fills} fillVersion={histYear} borderVersion={histYear} labels={hist.labels} year={histYear} showControls={false} />}</div>
        </Panel>
        <Panel className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2"><span className="title-display text-xs text-gold-200">Your timeline · {formatYear(year)}</span><FactBadge factual={false} /></div>
          <div className="relative h-72">{alt && <WorldMap owners={alt.owners} fills={alt.fills} fillVersion={year} borderVersion={year + 0.5} labels={alt.labels} year={year} showControls={false} />}</div>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Territory diverged" value={diverged === null ? '…' : `${Math.round(diverged * 100)}%`} sub="provinces under a different ruler" />
        <Stat label="States (historical vs yours)" value={`${histStates} / ${altStates}`} />
        <Stat label="World population" value={`${fmtNum(worldPopulation(year))} / ${simPop ? fmtNum(simPop) : '—'}`} sub="historical estimate / simulated" />
        <Stat label="States created / collapsed" value={`${created} / ${collapsed}`} sub="in this timeline" />
      </div>
      <Panel title="World population: historical estimate vs simulation">
        <LineChart xLabel={formatYear} series={[
          { name: 'Historical estimate (approx.)', color: '#5f9fae', dashed: true, points: w.history.map((h) => ({ x: h.year, y: worldPopulation(h.year) })) },
          { name: 'Your timeline', color: '#e8d08a', points: w.history.map((h) => ({ x: h.year, y: h.world.pop })) },
        ]} />
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Original timeline" subtitle={sc ? sc.title : 'Documented events for this start'}>
          {sc ? <ol className="space-y-2 text-sm">{sc.originalTimeline.map((e, i) => <li key={i} className="border-l-2 border-sky-400/60 pl-3"><div className="text-xs text-sky-300">{fmtDate(e.date)}</div><div className="font-semibold">{e.title}</div><div className="text-xs text-parchment-200/70">{e.text}</div></li>)}</ol>
            : <p className="text-sm text-parchment-300/70">This world was not started from a curated scenario; compare borders against the documented datasets above.</p>}
        </Panel>
        <Panel title="Alternative timeline" subtitle="Simulated events in your world">
          <ol className="space-y-2 text-sm">{altEvents.map((e) => <li key={e.id} className="border-l-2 border-purple-400/60 pl-3"><div className="flex items-center gap-2 text-xs text-purple-300">{fmtDate(e.date)} <Badge tone="gray">{e.kind}</Badge></div><div className="font-semibold">{e.title}</div><div className="text-xs text-parchment-200/70">{e.text}</div></li>)}</ol>
        </Panel>
      </div>
    </div>
  );
}
