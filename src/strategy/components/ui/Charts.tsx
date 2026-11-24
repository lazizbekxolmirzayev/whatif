import { useMemo, useState } from 'react';

export interface Series { name: string; color: string; points: { x: number; y: number }[]; dashed?: boolean }

const fmtAxis = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return a < 10 ? v.toFixed(1) : v.toFixed(0);
};

/** Lightweight responsive multi-series line chart with hover readout. */
export function LineChart({ series, height = 180, xLabel = (x: number) => String(x), yFormat = fmtAxis, markers = [] }: { series: Series[]; height?: number; xLabel?: (x: number) => string; yFormat?: (v: number) => string; markers?: { x: number; label: string; color?: string }[] }) {
  const W = 640, H = height, P = { l: 48, r: 12, t: 10, b: 24 };
  const [hover, setHover] = useState<number | null>(null);
  const { xmin, xmax, ymin, ymax } = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    if (!xs.length) return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
    const lo = Math.min(0, ...ys), hi = Math.max(...ys);
    return { xmin: Math.min(...xs), xmax: Math.max(...xs) === Math.min(...xs) ? Math.min(...xs) + 1 : Math.max(...xs), ymin: lo, ymax: hi === lo ? lo + 1 : hi * 1.05 };
  }, [series]);
  const sx = (x: number) => P.l + ((x - xmin) / (xmax - xmin)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - ((y - ymin) / (ymax - ymin)) * (H - P.t - P.b);
  const ticks = 4;
  if (!series.some((s) => s.points.length)) return <div className="flex h-24 items-center justify-center text-xs text-parchment-300/50">No data yet — advance time to record history.</div>;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x = xmin + (((e.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r) * (xmax - xmin);
        setHover(x);
      }}>
        {Array.from({ length: ticks + 1 }, (_, i) => { const v = ymin + ((ymax - ymin) * i) / ticks; return (
          <g key={i}><line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} stroke="rgba(217,182,92,.12)" /><text x={P.l - 6} y={sy(v) + 3} textAnchor="end" fontSize="10" fill="rgba(236,223,192,.55)">{yFormat(v)}</text></g>
        ); })}
        {[xmin, (xmin + xmax) / 2, xmax].map((x, i) => <text key={i} x={sx(x)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgba(236,223,192,.55)">{xLabel(Math.round(x))}</text>)}
        {markers.map((m, i) => m.x >= xmin && m.x <= xmax && <g key={i}><line x1={sx(m.x)} x2={sx(m.x)} y1={P.t} y2={H - P.b} stroke={m.color ?? 'rgba(217,182,92,.5)'} strokeDasharray="3 3" /><text x={sx(m.x) + 3} y={P.t + 10} fontSize="9" fill={m.color ?? '#d9b65c'}>{m.label}</text></g>)}
        {series.map((s) => s.points.length > 0 && (
          <g key={s.name}>
            <path d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '5 4' : undefined} />
          </g>
        ))}
        {hover !== null && <line x1={sx(hover)} x2={sx(hover)} y1={P.t} y2={H - P.b} stroke="rgba(255,255,255,.25)" />}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute right-2 top-1 rounded bg-ink-950/90 px-2 py-1 text-[11px] ring-1 ring-gold-600/40">
          <div className="text-gold-200">{xLabel(Math.round(hover))}</div>
          {series.map((s) => { const p = s.points.reduce((a, b) => (Math.abs(b.x - hover) < Math.abs(a.x - hover) ? b : a), s.points[0]); return p && <div key={s.name} style={{ color: s.color }}>{s.name}: {yFormat(p.y)}</div>; })}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-3">{series.map((s) => <span key={s.name} className="flex items-center gap-1 text-[11px] text-parchment-300/80"><span className="h-0.5 w-4" style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}

export function BarList({ items, format = fmtAxis }: { items: { label: string; value: number; color?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="truncate text-parchment-200/80" title={i.label}>{i.label}</span>
          <div className="h-2 rounded-full bg-ink-950"><div className="h-full rounded-full" style={{ width: `${(Math.abs(i.value) / max) * 100}%`, background: i.color ?? 'linear-gradient(90deg,#a97f2a,#e8d08a)' }} /></div>
          <span className="stat-num text-right text-parchment-100">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ parts, size = 120, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  let acc = 0;
  const r = 40, C = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#0b0f19" strokeWidth="14" />
        {parts.map((p) => { const len = (Math.max(0, p.value) / total) * C; const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />; acc += len; return el; })}
        {center && <text x="50" y="54" textAnchor="middle" fontSize="12" fill="#f3e6bd" transform="rotate(90 50 50)">{center}</text>}
      </svg>
      <div className="space-y-1">{parts.map((p) => <div key={p.label} className="flex items-center gap-2 text-xs text-parchment-200"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.label} <span className="stat-num text-parchment-300/60">{Math.round((Math.max(0, p.value) / total) * 100)}%</span></div>)}</div>
    </div>
  );
}
