'use client'
import { useEffect, useState } from 'react'
import type { FactionId, Scenario } from '@/game/types'
import { FACTION_COLOR } from '@/game/factions'
import { landToPath, loadLand, project } from '@/lib/geo'

let landD: Promise<string> | null = null

/** Flat schematic map of the scenario's regions, for side-by-side comparison. Not historical borders. */
export default function MiniMap({ sc, control, differs, title, tone }: { sc: Scenario; control: Record<string, FactionId>; differs: string[]; title: string; tone: 'a' | 'b' }) {
  const [d, setD] = useState('')
  useEffect(() => {
    let alive = true
    ;(landD ??= loadLand().then((l) => landToPath(l)))
      .then((x) => alive && setD(x))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  const dif = new Set(differs)
  return (
    <figure className="min-w-0 flex-1" data-testid={`minimap-${tone}`}>
      <figcaption className={`mb-1 text-[10px] uppercase tracking-widest ${tone === 'a' ? 'text-emerald-300' : 'text-fuchsia-300'}`}>{title}</figcaption>
      <svg viewBox="540 95 185 88" className="w-full rounded border border-white/10 bg-[#0a1020]">
        {d && <path d={d} fill="#1a2234" stroke="#d4b66c" strokeOpacity={0.3} strokeWidth={0.25} />}
        {sc.territories.map((t) => {
          const [cx, cy] = project(t.lat, t.lng)
          const ry = (t.radius / 180) * 500
          const rx = ry / Math.cos((t.lat * Math.PI) / 180)
          const f = control[t.id] ?? t.initial
          return (
            <ellipse
              key={t.id}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill={FACTION_COLOR[f]}
              fillOpacity={0.5}
              stroke={dif.has(t.id) ? '#f3d27a' : FACTION_COLOR[f]}
              strokeWidth={dif.has(t.id) ? 0.7 : 0.3}
              strokeDasharray={dif.has(t.id) ? '1.5 1' : undefined}
              style={{ transition: 'fill 0.8s' }}
            >
              <title>{t.name}</title>
            </ellipse>
          )
        })}
        {sc.sites.map((s) => {
          const [x, y] = project(s.lat, s.lng)
          return <circle key={s.id} cx={x} cy={y} r={0.7} fill="#f3e9cf" />
        })}
      </svg>
    </figure>
  )
}
