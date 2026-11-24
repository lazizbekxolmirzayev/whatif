import Link from 'next/link'
import WorldExplorer from '@/components/WorldExplorer'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Alternate history, explored</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight text-parchment sm:text-6xl">What if history had turned the other way?</h1>
        <p className="mt-4 text-parchment/70">Spin the world, read what truly happened, then step into the decision that changed everything.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2" aria-label="Game modes">
        <Link href="/play" className="group rounded-lg border border-gold-500/20 bg-white/[0.03] p-6 transition hover:border-gold-500/60">
          <p className="text-xs uppercase tracking-[0.25em] text-gold-400">Story mode · 3D</p>
          <h2 className="mt-1 font-serif text-2xl text-parchment">Change one decision</h2>
          <p className="mt-2 text-sm text-parchment/70">Step into a turning point on a 3D globe, watch the consequences as a cinematic, branch history and compare it with what really happened.</p>
          <p className="mt-3 text-sm text-gold-300 group-hover:text-gold-400">Play Ankara 1402 →</p>
        </Link>
        <Link href="/strategy" className="group rounded-lg border border-gold-500/20 bg-white/[0.03] p-6 transition hover:border-gold-500/60">
          <p className="text-xs uppercase tracking-[0.25em] text-gold-400">Grand strategy · simulation</p>
          <h2 className="mt-1 font-serif text-2xl text-parchment">Rule a whole state</h2>
          <p className="mt-2 text-sm text-parchment/70">Pick an era on historical borders and run economy, population, technology, diplomacy and war month by month, or rewrite a historical scenario. UZ / EN / RU.</p>
          <p className="mt-3 text-sm text-gold-300 group-hover:text-gold-400">Open Grand Strategy →</p>
        </Link>
      </section>
      <WorldExplorer />
    </div>
  )
}
