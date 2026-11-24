'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ERAS, EVENTS, REGIONS } from '@/data/events'
import { yearLabel } from '@/lib/format'
import { EmptyState } from './States'

export default function EventLibrary() {
  const [q, setQ] = useState('')
  const [era, setEra] = useState('')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return EVENTS.filter((e) => (!era || e.era === era) && (!region || e.region === region) && (!t || `${e.title} ${e.place} ${e.summary}`.toLowerCase().includes(t))).sort((a, b) => (sort === 'asc' ? a.year - b.year : b.year - a.year))
  }, [q, era, region, sort])

  const sel = 'rounded-md border border-white/10 bg-charcoal-800 px-3 py-2 text-sm text-parchment'
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, places…" aria-label="Search events" className={`${sel} w-full`} />
        <select value={era} onChange={(e) => setEra(e.target.value)} aria-label="Era" className={sel}>
          <option value="">All eras</option>
          {ERAS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region" className={sel}>
          <option value="">All regions</option>
          {REGIONS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'asc' | 'desc')} aria-label="Sort" className={sel}>
          <option value="asc">Oldest first</option>
          <option value="desc">Newest first</option>
        </select>
      </div>
      <p className="mt-3 text-xs text-parchment/50">{list.length} of {EVENTS.length} events</p>
      {list.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No events match" hint="Try a different search or clear the filters." action={<button className="rounded-md border border-gold-500/40 px-3 py-1.5 text-sm text-gold-300" onClick={() => { setQ(''); setEra(''); setRegion('') }}>Clear filters</button>} />
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="group flex h-full flex-col rounded-2xl border border-white/5 bg-charcoal-900/70 p-5 transition hover:border-gold-500/40 hover:shadow-gold">
                <p className="text-xs uppercase tracking-widest text-gold-400">{yearLabel(e.year)} · {e.era}</p>
                <h3 className="mt-2 font-serif text-2xl leading-snug text-parchment group-hover:text-gold-300">{e.title}</h3>
                <p className="mt-1 text-xs text-parchment/50">{e.place}</p>
                <p className="mt-3 line-clamp-3 text-sm text-parchment/70">{e.summary}</p>
                <p className="mt-auto pt-4 text-xs text-parchment/50">{e.scenarios.length} fictional scenarios{e.scenarios.some((s) => s.premium) ? ' · incl. Premium' : ''}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
