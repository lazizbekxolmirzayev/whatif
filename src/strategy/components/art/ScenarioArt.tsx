import { memo } from 'react';

/** Procedural cinematic banner (no copyrighted imagery): sky gradient, sun, layered ridges, banners and the year. */
export const ScenarioArt = memo(function ScenarioArt({ hue, year, seed = 1, className = '' }: { hue: number; year: string; seed?: number; className?: string }) {
  const h = hue, s = seed;
  const ridge = (y: number, amp: number, k: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x <= 400; x += 20) d += ` L${x} ${y - Math.abs(Math.sin((x + s * 37) / (k * 13)) * amp + Math.sin((x + s * 11) / (k * 5)) * amp * 0.4)}`;
    return d + ' L400 220 L0 220 Z';
  };
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sky${h}${s}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 45% 12%)`} /><stop offset=".6" stopColor={`hsl(${(h + 20) % 360} 55% 30%)`} /><stop offset="1" stopColor={`hsl(${(h + 35) % 360} 70% 55%)`} />
        </linearGradient>
        <radialGradient id={`sun${h}${s}`}><stop offset="0" stopColor="#fff6d8" /><stop offset=".4" stopColor="#f3d88a" stopOpacity=".9" /><stop offset="1" stopColor="#f3d88a" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky${h}${s})`} />
      <circle cx={260 + (s % 5) * 15} cy="120" r="70" fill={`url(#sun${h}${s})`} opacity=".85" />
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 97 + s * 13) % 400} cy={(i * 53) % 90} r={i % 4 === 0 ? 1 : 0.5} fill="#fff" opacity=".5" />)}
      <path d={ridge(165, 30, 3)} fill={`hsl(${h} 35% 18%)`} opacity=".9" />
      <path d={ridge(185, 22, 2)} fill={`hsl(${h} 40% 11%)`} />
      <g fill={`hsl(${h} 40% 6%)`}>
        <path d={ridge(205, 10, 1)} />
        {[60, 90, 300, 330].map((x, i) => <g key={i} transform={`translate(${x + (s % 3) * 8} ${178 - (i % 2) * 6})`}><rect x="-0.8" y="-26" width="1.6" height="30" /><path d={`M0.8 -26 L16 -21 L0.8 -16 Z`} fill={`hsl(${(h + 180) % 360} 60% 40%)`} /></g>)}
      </g>
      <text x="22" y="200" fontFamily="Cinzel, serif" fontWeight="800" fontSize="44" fill="#fbf6e6" opacity=".14" letterSpacing="4">{year}</text>
    </svg>
  );
});
