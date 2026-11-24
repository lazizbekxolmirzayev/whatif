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
    </main>
  )
}
