export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-parchment/70">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-400" />
      {label}
    </div>
  )
}
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-charcoal-900/60 px-6 py-12 text-center">
      <p className="font-serif text-xl text-parchment">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm text-parchment/60">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/5 px-5 py-4 text-sm text-red-200">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-md border border-red-300/40 px-3 py-1 text-xs hover:bg-red-300/10">
          Try again
        </button>
      )}
    </div>
  )
}
