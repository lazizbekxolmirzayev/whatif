import { notFound } from 'next/navigation'
import GameClient from '@/components/game/GameClient'
import { SCENARIOS, getScenario } from '@/game/scenarios'

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ id: s.id }))
}

export default function PlayPage({ params }: { params: { id: string } }) {
  const sc = getScenario(params.id)
  if (!sc) notFound()
  return <GameClient scenario={sc} />
}
