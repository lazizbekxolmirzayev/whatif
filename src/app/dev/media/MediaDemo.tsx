'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import MediaPlayer from '@/components/game/MediaPlayer'

function Inner() {
  const q = useSearchParams()
  const src = q.get('src')
  const vtt = q.get('vtt') ?? undefined
  const [fb, setFb] = useState('')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 font-serif text-2xl text-gold-300">MediaPlayer test harness (dev only)</h1>
      {!src ? (
        <p className="text-parchment/70">Pass ?src=&lt;video url&gt;&amp;vtt=&lt;captions url&gt;. No video is bundled; none is invented.</p>
      ) : (
        <MediaPlayer media={{ videoUrl: src, captionsUrl: vtt, description: 'Test clip supplied via query string.' }} title="Test clip" fictional onFallback={(r) => setFb(r)} />
      )}
      {fb && <p data-testid="fallback" className="mt-4 text-parchment/80">Fallback to 3D requested: {fb}</p>}
    </main>
  )
}
export default function MediaDemo() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
