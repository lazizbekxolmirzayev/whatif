'use client'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import { createMemoryStore } from './createStore'
import { loadProgress, resetProgress } from './progress'
import type { Plan, User } from '@/types'

/** Session state comes from the server (httpOnly cookie). Nothing secret is kept in the browser. */
interface AuthState {
  status: 'idle' | 'loading' | 'ready'
  user: User | null
}
const store = createMemoryStore<AuthState>({ status: 'idle', user: null })

export type AuthResult = { ok: true } | { ok: false; error: string }

export function validateCredentials(email: string, password: string, name?: string): string | null {
  if (name !== undefined && name.trim().length < 2) return 'Name must be at least 2 characters.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}

async function refresh() {
  if (store.get().status === 'loading') return
  store.set({ ...store.get(), status: 'loading' })
  const r = await api<{ user: User | null }>('/api/auth/me')
  const user = r.ok ? r.data.user : null
  store.set({ status: 'ready', user })
  if (user) await loadProgress()
  else resetProgress()
}

async function enter(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  const r = await api<{ user: User }>(path, { body })
  if (!r.ok) return r
  store.set({ status: 'ready', user: r.data.user })
  await loadProgress()
  return { ok: true }
}

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  const err = validateCredentials(email, password, name)
  return err ? { ok: false, error: err } : enter('/api/auth/signup', { name, email, password })
}
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const err = validateCredentials(email, password)
  return err ? { ok: false, error: err } : enter('/api/auth/login', { email, password })
}
export async function signOut() {
  await api('/api/auth/logout', { body: {} })
  store.set({ status: 'ready', user: null })
  resetProgress()
}

/** Development-only (the server route returns 404 in production). */
export async function devSetPlan(plan: Plan) {
  const r = await api<{ user: User }>('/api/dev/plan', { body: { plan } })
  if (r.ok) store.set({ status: 'ready', user: r.data.user })
}

export function useAuth() {
  const s = store.useStore()
  useEffect(() => {
    if (store.get().status === 'idle') void refresh()
  }, [])
  return { user: s.user, isPremium: s.user?.plan === 'premium', loading: s.status !== 'ready' }
}
