'use client'
import type { ReactNode } from 'react'
import type { Kind, Tone } from '@/game/types'

export function Panel({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`pointer-events-auto rounded-lg border border-gold-500/20 bg-midnight-950/85 p-4 shadow-2xl backdrop-blur-md ${className}`}>
      {children}
    </div>
  )
}

/** echo = a historical choice inside an already-diverged timeline */
export function kindLabel(kind: Kind, echo = false) {
  if (echo) return 'Alternate timeline · mirrors reality'
  return kind === 'historical' ? 'Documented history' : 'Alternate history · fiction'
}
export function KindBadge({ kind, echo = false, className = '' }: { kind: Kind; echo?: boolean; className?: string }) {
  const c = echo ? 'border-fuchsia-300/40 text-fuchsia-200' : kind === 'historical' ? 'border-emerald-400/40 text-emerald-300' : 'border-fuchsia-400/40 text-fuchsia-300'
  return <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${c} ${className}`}>{kindLabel(kind, echo)}</span>
}

export const toneText = (t?: Tone) => (t === 'good' ? 'text-emerald-300' : t === 'bad' ? 'text-rose-300' : 'text-parchment/85')

export function Btn({ children, onClick, primary, className = '', ...rest }: { children: ReactNode; onClick?: () => void; primary?: boolean; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? 'bg-gold-500 font-medium text-midnight-950 hover:bg-gold-400' : 'border border-white/15 bg-black/30 hover:border-gold-500/50'} ${className}`}
    >
      {children}
    </button>
  )
}

export const initials = (name: string) =>
  name
    .replace(/[^A-Za-zÀ-ÿĀ-ž\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')

/** Small branching-path icon (a font-independent replacement for the ⑂ glyph). */
export function ForkIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`inline-block h-3 w-3 align-[-2px] ${className}`} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <circle cx="4" cy="3" r="1.6" />
      <circle cx="4" cy="13" r="1.6" />
      <circle cx="12" cy="5" r="1.6" />
      <path d="M4 4.6v6.8M12 6.6c0 3-8 2.4-8 4.8" />
    </svg>
  )
}
