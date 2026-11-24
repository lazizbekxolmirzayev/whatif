export function VerifiedBadge({ label = 'Historical record' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-emerald-300">
      <span aria-hidden>✓</span> {label}
    </span>
  )
}
export function FictionalBadge({ label = 'Fictional possibility' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gold-300">
      <span aria-hidden>✦</span> {label}
    </span>
  )
}
export function PremiumBadge() {
  return (
    <span className="rounded-full bg-gradient-to-r from-gold-600 to-gold-400 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-midnight-950">
      Premium
    </span>
  )
}
