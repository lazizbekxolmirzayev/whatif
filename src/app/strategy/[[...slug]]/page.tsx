import type { Metadata } from 'next'
import StrategyEntry from '@/components/StrategyEntry'

export const metadata: Metadata = {
  title: 'Grand Strategy · WHATIF',
  description: 'Alternative-history grand strategy on historical borders: economy, population, diplomacy, war and events simulated month by month.',
}

/** Every /strategy/* path renders the same client app; the game's own router picks the screen. */
export default function StrategyPage() {
  return <StrategyEntry />
}
