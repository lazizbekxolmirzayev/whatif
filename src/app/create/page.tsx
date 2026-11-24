import { Suspense } from 'react'
import CreateHistory from '@/components/CreateHistory'
import { Spinner } from '@/components/States'
export const metadata = { title: 'Create Your Own History — WHATIF' }
export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl text-parchment">Create your own history</h1>
      <Suspense fallback={<Spinner />}><CreateHistory /></Suspense>
    </div>
  )
}
