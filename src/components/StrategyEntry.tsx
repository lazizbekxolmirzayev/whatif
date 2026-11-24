'use client'
import dynamic from 'next/dynamic'

const StrategyApp = dynamic(() => import('@/strategy/StrategyApp'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center font-serif text-lg tracking-[0.2em] text-gold-400">Unrolling the maps…</div>,
})

/** Full-screen container for the Grand Strategy game; its styles are scoped to #strategy-root. */
export default function StrategyEntry() {
  return (
    <div id="strategy-root" className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden">
      <StrategyApp />
    </div>
  )
}
