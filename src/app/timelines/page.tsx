import Timelines from '@/components/Timelines'
export const metadata = { title: 'My Timelines — WHATIF' }
export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl text-parchment">My timelines</h1>
      <Timelines />
    </div>
  )
}
