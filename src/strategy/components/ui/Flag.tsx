import { memo } from 'react';
import type { FlagDesign } from '../../types/game';

function Emblem({ kind, color }: { kind: FlagDesign['emblem']; color: string }) {
  const c = color;
  switch (kind) {
    case 'star': return <polygon points="45.0,11.0 47.2,16.9 53.6,17.2 48.6,21.2 50.3,27.3 45.0,23.8 39.7,27.3 41.4,21.2 36.4,17.2 42.8,16.9" fill={c} />;
    case 'crescent': return <g transform="translate(45,20)"><circle r="10" fill={c} /><circle r="8.4" cx="3.2" fill="var(--flag-bg)" /><polygon points="9,0 11,4 15.5,4 12,7 13,11 9,8.5 5,11 6,7 2.5,4 7,4" transform="translate(0,-5.5) scale(.6)" fill={c} /></g>;
    case 'sun': return <g transform="translate(45,20)" fill={c}><circle r="6" />{Array.from({ length: 12 }, (_, i) => <rect key={i} x="-0.9" y="-11" width="1.8" height="4" transform={`rotate(${i * 30})`} />)}</g>;
    case 'cross': return <g fill={c}><rect x="41" y="8" width="8" height="24" /><rect x="33" y="16" width="24" height="8" /></g>;
    case 'circle': return <circle cx="45" cy="20" r="8" fill={c} />;
    case 'crown': return <path d="M34 26 L36 14 L40 20 L45 11 L50 20 L54 14 L56 26 Z M34 27 h22 v3 h-22z" fill={c} />;
    case 'eagle': return <path d="M45 10 c-2 3-2 5 0 6 c2-1 2-3 0-6z M45 16 c-6 -3 -12 -2 -14 2 c4 0 7 1 9 3 c-4 0 -7 2 -8 5 c4-1 7 -1 9 0 l-1 6 l4 -3 l4 3 l-1 -6 c2 -1 5 -1 9 0 c-1 -3 -4 -5 -8 -5 c2 -2 5 -3 9 -3 c-2 -4 -8 -5 -14 -2z" fill={c} />;
    case 'rings': return <g fill="none" stroke={c} strokeWidth="2.2"><circle cx="45" cy="15" r="4" /><circle cx="40.5" cy="23" r="4" /><circle cx="49.5" cy="23" r="4" /></g>;
    case 'tower': return <path d="M38 30 V16 h3 v-3 h2 v3 h4 v-3 h2 v3 h3 V30 z M43 30 v-5 a2 2 0 0 1 4 0 v5z" fill={c} />;
    case 'lion': return <path d="M36 28 c0-6 3-10 8-11 c1-3 4-5 7-4 c-1 2 0 3 2 4 c-1 2-3 2-4 2 c1 3 1 6 -1 9 h-2 l1-4 c-2 1-4 1-6 0 l-1 4z" fill={c} />;
    case 'wheel': return <g transform="translate(45,20)" stroke={c} strokeWidth="1.6" fill="none"><circle r="8" />{Array.from({ length: 8 }, (_, i) => <line key={i} x1="0" y1="0" x2="0" y2="-8" transform={`rotate(${i * 45})`} />)}</g>;
    default: return null;
  }
}

/** Procedural heraldic flag (60×40 viewBox). */
export const Flag = memo(function Flag({ flag, className = 'h-6 w-9', title }: { flag: FlagDesign; className?: string; title?: string }) {
  const [a, b, c] = flag.colors;
  let body: JSX.Element;
  switch (flag.pattern) {
    case 'hbi': body = <><rect width="60" height="20" fill={a} /><rect y="20" width="60" height="20" fill={b} /></>; break;
    case 'htri': body = <><rect width="60" height="13.4" fill={a} /><rect y="13.3" width="60" height="13.4" fill={b} /><rect y="26.6" width="60" height="13.4" fill={c} /></>; break;
    case 'vtri': body = <><rect width="20" height="40" fill={a} /><rect x="20" width="20" height="40" fill={b} /><rect x="40" width="20" height="40" fill={c} /></>; break;
    case 'vbi': body = <><rect width="30" height="40" fill={a} /><rect x="30" width="30" height="40" fill={b} /></>; break;
    case 'nordic': body = <><rect width="60" height="40" fill={a} /><rect x="16" width="8" height="40" fill={b} /><rect y="16" width="60" height="8" fill={b} /></>; break;
    case 'saltire': body = <><rect width="60" height="40" fill={a} /><path d="M0 0 L60 40 M60 0 L0 40" stroke={b} strokeWidth="8" /><path d="M0 0 L60 40 M60 0 L0 40" stroke={c} strokeWidth="3" /><rect x="25" width="10" height="40" fill={b} /><rect y="15" width="60" height="10" fill={b} /><rect x="27" width="6" height="40" fill={c} /><rect y="17" width="60" height="6" fill={c} /></>; break;
    case 'canton': body = <><rect width="60" height="40" fill={a} /><rect width="26" height="20" fill={b} /></>; break;
    case 'diagonal': body = <><rect width="60" height="40" fill={a} /><path d="M0 40 L60 0 L60 40 Z" fill={b} /></>; break;
    case 'border': body = <><rect width="60" height="40" fill={b} /><rect x="4" y="4" width="52" height="32" fill={a} /></>; break;
    case 'quartered': body = <><rect width="30" height="20" fill={a} /><rect x="30" width="30" height="20" fill={b} /><rect y="20" width="30" height="20" fill={b} /><rect x="30" y="20" width="30" height="20" fill={a} /></>; break;
    case 'stripes': body = <>{Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 5.72} width="60" height="5.72" fill={i % 2 ? b : a} />)}<rect width="26" height="20" fill={c} /></>; break;
    default: body = <rect width="60" height="40" fill={a} />;
  }
  const emblemPos = flag.pattern === 'stripes' || flag.pattern === 'canton' ? 'translate(13,10) scale(0.55) translate(-45,-20)' : 'translate(-15,0)';
  return (
    <svg viewBox="0 0 60 40" className={className} style={{ ['--flag-bg' as string]: flag.pattern === 'stripes' ? c : a }} role="img" aria-label={title ?? 'Flag'}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id="flagShade" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset=".5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".25" /></linearGradient>
      </defs>
      {body}
      {flag.emblem !== 'none' && <g transform={emblemPos}><Emblem kind={flag.emblem} color={flag.emblemColor} /></g>}
      <rect width="60" height="40" fill="url(#flagShade)" />
      <rect width="60" height="40" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.2" />
    </svg>
  );
});
