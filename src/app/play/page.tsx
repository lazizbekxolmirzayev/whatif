import Link from 'next/link'
import { SCENARIOS } from '@/game/scenarios'

export const metadata = { title: 'Play · WHATIF' }

export default function PlayIndex() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-serif text-4xl text-gold-300">Play a scenario</h1>
      <p className="mt-2 text-parchment/70">Enter a 3D world, change a decision and watch the consequences unfold. One complete scenario is available.</p>
      <div className="mt-8 grid gap-4">
        {SCENARIOS.map((s) => (
          <Link key={s.id} href={`/play/${s.id}`} className="rounded-lg border border-gold-500/20 bg-white/[0.03] p-6 transition hover:border-gold-500/60">
            <p className="text-xs uppercase tracking-widest text-gold-400">{s.startYear}</p>
            <h2 className="font-serif text-2xl">{s.title}</h2>
            <p className="mt-1 italic text-parchment/70">{s.tagline}</p>
          </Link>
        ))}
      </div>
      <section className="mt-10 rounded-lg border border-white/10 bg-white/[0.02] p-6">
        <p className="text-xs uppercase tracking-widest text-gold-400">Also on WHATIF · Grand Strategy</p>
        <h2 className="mt-1 font-serif text-2xl">Rule the whole world, month by month</h2>
        <p className="mt-1 text-sm text-parchment/70">
          A simulation of economy, population, technology, diplomacy and war on historical borders, with eight historical scenarios. After Ankara, try{' '}
          <Link href="/strategy/scenarios/timur-east" className="text-gold-300 underline hover:text-gold-400">Timur’s Eastern Campaign</Link>: what if Timur had survived 1405?
        </p>
        <Link href="/strategy" className="mt-3 inline-block rounded-md border border-gold-500/40 px-4 py-2 text-sm text-gold-300 hover:border-gold-500/80">Open Grand Strategy →</Link>
      </section>
    </main>
  )
}
