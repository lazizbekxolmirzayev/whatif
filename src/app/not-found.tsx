import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="font-serif text-5xl text-parchment">This page was never written</h1>
      <p className="mt-3 text-parchment/60">In this timeline, at least.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950">Back to the world</Link>
    </div>
  )
}
