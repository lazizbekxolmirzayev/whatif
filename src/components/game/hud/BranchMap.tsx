'use client'
import { useMemo } from 'react'
import type { Scenario } from '@/game/types'
import { enumeratePaths, evaluateEnding, getNode, replay } from '@/game/engine'
import { originalBranch } from '@/game/branches'

interface TNode {
  prefix: string[]
  label: string
  children: TNode[]
  x: number
  y: number
  ending: string | null
}

const COL = 172
const ROW = 15
const startsWith = (a: readonly string[], p: readonly string[]) => p.length <= a.length && p.every((x, i) => a[i] === x)

/** Every possible path of the scenario as a tree: documented path, explored branches and the unexplored. */
export default function BranchMap({ sc, explored, activePath, onPick }: { sc: Scenario; explored: string[][]; activePath: string[]; onPick: (prefix: string[]) => void }) {
  const { root, nodes, width, height } = useMemo(() => {
    const paths = enumeratePaths(sc)
    const depth = Math.max(...paths.map((p) => p.length))
    const root: TNode = { prefix: [], label: '', children: [], x: 0, y: 0, ending: null }
    const all: TNode[] = [root]
    for (const p of paths) {
      let cur = root
      p.forEach((id, i) => {
        const prefix = p.slice(0, i + 1)
        let next = cur.children.find((c) => c.prefix[i] === id)
        if (!next) {
          const node = getNode(sc, replay(sc, p.slice(0, i)).state)
          const label = node?.choices.find((c) => c.id === id)?.label ?? id
          next = { prefix, label: label.length > 30 ? label.slice(0, 29) + '…' : label, children: [], x: (i + 1) * COL, y: 0, ending: null }
          cur.children.push(next)
          all.push(next)
        }
        cur = next
      })
      cur.ending = evaluateEnding(sc, replay(sc, p).state)?.title ?? null
    }
    let leaf = 0
    const place = (n: TNode): number => {
      if (!n.children.length) return (n.y = 14 + leaf++ * ROW)
      const ys = n.children.map(place)
      return (n.y = (ys[0] + ys[ys.length - 1]) / 2)
    }
    place(root)
    return { root, nodes: all, width: depth * COL + 190, height: 14 + leaf * ROW }
  }, [sc])
  const canon = originalBranch(sc).choices
  const isExplored = (p: string[]) => explored.some((b) => startsWith(b, p))
  const edges: { from: TNode; to: TNode }[] = []
  const walk = (n: TNode) => n.children.forEach((c) => (edges.push({ from: n, to: c }), walk(c)))
  walk(root)

  return (
    <svg viewBox={`-8 0 ${width + 8} ${height + 6}`} className="w-full" style={{ maxHeight: 300 }} data-testid="branch-map" role="img" aria-label="Map of all possible branches">
      {edges.map(({ from, to }) => {
        const orig = startsWith(canon, to.prefix)
        const active = startsWith(activePath, to.prefix)
        const exp = isExplored(to.prefix)
        const color = active ? '#f3d27a' : orig ? '#34d399' : exp ? '#e879f9' : '#ffffff'
        return (
          <g key={to.prefix.join('>')} className="cursor-pointer" onClick={() => onPick(to.prefix)} data-explored={exp ? '1' : '0'}>
            <path d={`M ${from.x} ${from.y} C ${from.x + COL * 0.45} ${from.y}, ${to.x - COL * 0.55} ${to.y}, ${to.x} ${to.y}`} fill="none" stroke={color} strokeOpacity={exp || orig ? 0.85 : 0.18} strokeWidth={active ? 2.4 : 1.4} strokeDasharray={exp || orig ? undefined : '3 3'} />
            <text x={from.x + 8} y={to.y - 3} fontSize={8.5} fill={color} fillOpacity={exp || orig ? 0.95 : 0.4} stroke="#0b0f1a" strokeWidth={2.5} strokeOpacity={0.9} paintOrder="stroke">
              {to.label}
            </text>
            <circle cx={to.x} cy={to.y} r={3} fill={exp || orig ? color : '#0b0f1a'} stroke={color} strokeOpacity={0.8} />
            {to.ending && (
              <text x={to.x + 8} y={to.y + 3} fontSize={8.5} fill={exp || orig ? '#e8dcc0' : '#e8dcc0'} fillOpacity={exp || orig ? 0.9 : 0.3} fontStyle="italic">
                {exp || orig ? to.ending : '? undiscovered'}
              </text>
            )}
          </g>
        )
      })}
      <circle cx={0} cy={root.y} r={4} fill="#f3d27a" />
      {nodes.length === 0 && null}
    </svg>
  )
}
