import EventLibrary from '@/components/EventLibrary'
export const metadata = { title: 'Events — WHATIF' }
export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl text-parchment">Historical events</h1>
      <EventLibrary />
    </div>
  )
}
