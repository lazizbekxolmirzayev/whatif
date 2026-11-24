import WorldExplorer from '@/components/WorldExplorer'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Alternate history, explored</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight text-parchment sm:text-6xl">What if history had turned the other way?</h1>
        <p className="mt-4 text-parchment/70">Spin the world, read what truly happened, then step into the decision that changed everything.</p>
      </section>
      <WorldExplorer />
    </div>
  )
}
