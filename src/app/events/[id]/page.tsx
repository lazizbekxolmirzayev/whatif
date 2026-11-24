import { notFound } from 'next/navigation'
import EventView from '@/components/EventView'
import { EVENTS, EVENT_BY_ID } from '@/data/events'

export function generateStaticParams() {
  return EVENTS.map((e) => ({ id: e.id }))
}
export function generateMetadata({ params }: { params: { id: string } }) {
  const e = EVENT_BY_ID[params.id]
  return { title: e ? `${e.title} — WHATIF` : 'Event — WHATIF' }
}
export default function Page({ params }: { params: { id: string } }) {
  const event = EVENT_BY_ID[params.id]
  if (!event) notFound()
  return <EventView event={event} />
}
