import PremiumPanel from '@/components/PremiumPanel'
export const metadata = { title: 'Premium — WHATIF' }
export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-center font-serif text-4xl text-parchment">WHATIF Premium</h1>
      <PremiumPanel />
    </div>
  )
}
