'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signIn, signUp } from '@/store/auth'

export default function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = 'w-full rounded-md border border-white/10 bg-charcoal-800 px-3 py-2 text-sm text-parchment focus:border-gold-500/60 focus:outline-none'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = mode === 'up' ? await signUp(name, email, password) : await signIn(email, password)
      if (r.ok) router.push('/timelines')
      else setError(r.error)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-2xl border border-white/5 bg-charcoal-900/70 p-6" noValidate>
      <h1 className="font-serif text-3xl text-parchment">{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
      {mode === 'up' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" autoComplete="name" className={input} />}
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" aria-label="Email" autoComplete="email" className={input} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password (8+ characters)" aria-label="Password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className={input} />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="w-full rounded-md bg-gold-500 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400 disabled:opacity-50">{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null) }} className="w-full text-xs text-parchment/60 underline">
        {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
      <p className="text-[11px] leading-relaxed text-parchment/40">
        Prototype notice: accounts are stored only in this browser. There is no server yet, so they do not sync across devices and can be lost if site data is cleared.
      </p>
    </form>
  )
}
