import type { HistoricalEvent } from '@/types'

export interface TimelineBranch {
  id: string
  label: string
  kind: 'scenario' | 'custom'
  locked?: boolean
}

interface Props {
  event: HistoricalEvent
  branches: TimelineBranch[]
  activeId?: string | null
  onPick?: (id: string) => void
}

/** SVG timeline: one solid verified line, dashed gold branches that diverge at the pivot. */
export default function BranchTimeline({ event, branches, activeId, onPick }: Props) {
  const W = 900
  const rowH = 54
  const H = Math.max(180, 110 + branches.length * rowH)
  const midY = 70
  const px = 300
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Timeline of ${event.title} with ${branches.length} alternate branches`}>
      <line x1={30} y1={midY} x2={px} y2={midY} stroke="#d4b66c" strokeWidth={3} />
      <line x1={px} y1={midY} x2={W - 30} y2={midY} stroke="#10b981" strokeWidth={3} />
      <text x={30} y={midY - 14} fill="#e9e2d0" fontSize={12} opacity={0.6}>Before</text>
      <text x={W - 30} y={midY - 14} fill="#6ee7b7" fontSize={12} textAnchor="end">What actually happened (verified)</text>
      <circle cx={px} cy={midY} r={9} fill="#05070d" stroke="#e6cf9a" strokeWidth={3} />
      <text x={px - 16} y={midY + 30} fill="#e6cf9a" fontSize={12} textAnchor="end">Decision point · {event.dateLabel}</text>
      {branches.map((b, i) => {
        const y = midY + 62 + i * rowH
        const active = b.id === activeId
        const color = b.kind === 'custom' ? '#a78bfa' : '#d4b66c'
        const d = `M${px},${midY} C${px + 50},${midY} ${px + 20},${y} ${px + 90},${y} L${W - 200},${y}`
        return (
          <g
            key={b.id}
            onClick={() => onPick?.(b.id)}
            className={onPick ? 'cursor-pointer' : ''}
            tabIndex={onPick ? 0 : undefined}
            role={onPick ? 'button' : undefined}
            aria-label={`Branch: ${b.label}`}
            onKeyDown={(e) => onPick && (e.key === 'Enter' || e.key === ' ') && onPick(b.id)}
          >
            <path d={d} fill="none" stroke={color} strokeWidth={active ? 3.5 : 2} strokeDasharray="7 6" opacity={active ? 1 : 0.7} />
            <circle cx={W - 200} cy={y} r={5} fill={color} />
            <text x={W - 188} y={y + 4} fill={active ? '#fff' : '#e9e2d0'} fontSize={13} opacity={active ? 1 : 0.85}>
              {b.label.length > 34 ? b.label.slice(0, 33) + '…' : b.label}
              {b.locked ? '  🔒' : ''}
            </text>
          </g>
        )
      })}
      <text x={30} y={H - 10} fill="#e9e2d0" fontSize={11} opacity={0.5}>Solid green = documented history · dashed = fictional branch (gold: curated, violet: yours)</text>
    </svg>
  )
}
