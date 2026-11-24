'use client'
import { useEffect, useMemo, useState } from 'react'
import { EVENTS } from '@/data/events'
import { loadLand, landToPath, project, MAP_W, MAP_H } from '@/lib/geo'
import { Spinner, ErrorState } from './States'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  visited?: string[]
}

export default function WorldMap({ selectedId, onSelect, visited = [] }: Props) {
  const [path, setPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    loadLand()
      .then((l) => alive && setPath(landToPath(l)))
      .catch(() => alive && setError('The world map data could not be loaded.'))
    return () => {
      alive = false
    }
  }, [attempt])

  const pts = useMemo(() => EVENTS.map((e) => ({ e, xy: project(e.lat, e.lng) })), [])
  if (error) return <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
  if (!path) return <Spinner label="Drawing the world…" />

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-auto w-full rounded-xl bg-midnight-800" role="group" aria-label="Interactive historical map">
      <path d={path} fill="#262a36" stroke="rgba(212,182,108,.55)" strokeWidth={0.5} />
      {pts.map(({ e, xy }) => {
        const active = e.id === selectedId
        const seen = visited.includes(e.id)
        return (
          <g
            key={e.id}
            transform={`translate(${xy[0]},${xy[1]})`}
            tabIndex={0}
            role="button"
            aria-label={`${e.title}, ${e.dateLabel}`}
            className="cursor-pointer outline-none"
            onClick={() => onSelect(e.id)}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onSelect(e.id)}
            onMouseEnter={() => setHover(e.id)}
            onMouseLeave={() => setHover(null)}
          >
            <circle r={active ? 11 : 8} fill="rgba(212,182,108,.15)" />
            <circle r={active ? 5 : 3.5} fill={active ? '#e6cf9a' : seen ? '#7ee0b0' : '#c19a4a'} stroke="#05070d" strokeWidth={1} />
            {(hover === e.id || active) && (
              <text y={-14} textAnchor="middle" fontSize={11} fill="#e9e2d0" stroke="#05070d" strokeWidth={3} paintOrder="stroke">
                {e.title}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
