'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { EVENTS, EVENT_BY_ID } from '@/data/events'
import { yearLabel } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { useProgress } from '@/store/progress'
import WorldMap from './WorldMap'
import { Spinner } from './States'

const Globe = dynamic(() => import('./Globe'), { ssr: false, loading: () => <Spinner label="Loading 3D world…" /> })

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function WorldExplorer() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'globe' | 'map'>('globe')
  const [note, setNote] = useState<string | null>(null)
  const { user } = useAuth()
  const { visited } = useProgress(user?.id)
  const selected = selectedId ? EVENT_BY_ID[selectedId] : null

  const fail = useCallback((reason: string) => {
    setNote(`${reason} Showing the 2D map instead.`)
    setMode('map')
  }, [])

  const toggle = (m: 'globe' | 'map') => {
    if (m === 'globe' && !hasWebGL()) {
      setNote('WebGL is not available in this browser, so the 3D globe cannot run. Showing the 2D map.')
      return
    }
    setNote(null)
    setMode(m)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-midnight-800 to-midnight-950">
        <div className="absolute right-3 top-3 z-10 flex rounded-lg border border-white/10 bg-midnight-950/80 p-0.5 text-xs">
          {(['globe', 'map'] as const).map((m) => (
            <button key={m} onClick={() => toggle(m)} className={`rounded-md px-3 py-1 ${mode === m ? 'bg-gold-500 text-midnight-950' : 'text-parchment/70'}`}>
              {m === 'globe' ? '3D Globe' : '2D Map'}
            </button>
          ))}
        </div>
        {mode === 'globe' ? (
          <div className="h-[460px] sm:h-[560px]">
            <Globe selectedId={selectedId} onSelect={setSelectedId} onFail={fail} visited={visited} />
          </div>
        ) : (
          <div className="p-3 pt-12">
            <WorldMap selectedId={selectedId} onSelect={setSelectedId} visited={visited} />
          </div>
        )}
        {note && <p className="border-t border-white/5 px-4 py-2 text-xs text-gold-300">{note}</p>}
        <p className="border-t border-white/5 px-4 py-2 text-xs text-parchment/50">
          Drag to rotate · scroll to zoom · {EVENTS.length} events on the map · green markers are events you explored
        </p>
      </div>

      <aside className="rounded-2xl border border-white/5 bg-charcoal-900/70 p-5">
        {selected ? (
          <div>
            <p className="text-xs uppercase tracking-widest text-gold-400">
              {selected.dateLabel} · {selected.place}
            </p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-parchment">{selected.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-parchment/75">{selected.summary}</p>
            <p className="mt-4 text-xs text-parchment/50">{yearLabel(selected.year)} · {selected.scenarios.length} fictional scenarios</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/events/${selected.id}`} className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400">
                Explore event
              </Link>
              <Link href={`/create?event=${selected.id}`} className="rounded-md border border-gold-500/40 px-4 py-2 text-sm text-gold-300 hover:bg-gold-500/10">
                Change this history
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-serif text-3xl text-parchment">Choose a moment</h2>
            <p className="mt-3 text-sm text-parchment/70">
              Select a marker on the world to read what really happened, then explore how it might have gone differently.
            </p>
            <ul className="mt-5 space-y-1">
              {EVENTS.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setSelectedId(e.id)} className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5">
                    <span className="text-parchment/90">{e.title}</span>
                    <span className="shrink-0 text-xs text-parchment/40">{yearLabel(e.year)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
