'use client'
import { createPersistentStore } from './createStore'
import type { Plan, User } from '@/types'

/**
 * IMPORTANT: accounts are stored ONLY in this browser (localStorage).
 * There is no backend yet. Passwords are salted+hashed with SHA-256 via Web Crypto,
 * which is NOT a replacement for a real server-side auth system.
 */
interface StoredUser extends User {
  salt: string
  hash: string
}
interface AuthState {
  users: StoredUser[]
  sessionUserId: string | null
}

const store = createPersistentStore<AuthState>('whatif.auth.v1', { users: [], sessionUserId: null })

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
function randomSalt() {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type AuthResult = { ok: true } | { ok: false; error: string }

export function validateCredentials(email: string, password: string, name?: string): string | null {
  if (name !== undefined && name.trim().length < 2) return 'Name must be at least 2 characters.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  const err = validateCredentials(email, password, name)
  if (err) return { ok: false, error: err }
  const s = store.get()
  const e = email.trim().toLowerCase()
  if (s.users.some((u) => u.email === e)) return { ok: false, error: 'An account with this email already exists on this device.' }
  const salt = randomSalt()
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: e,
    plan: 'free',
    createdAt: Date.now(),
    salt,
    hash: await sha256(salt + password),
  }
  store.set({ users: [...s.users, user], sessionUserId: user.id })
  return { ok: true }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const err = validateCredentials(email, password)
  if (err) return { ok: false, error: err }
  const s = store.get()
  const u = s.users.find((x) => x.email === email.trim().toLowerCase())
  if (!u || (await sha256(u.salt + password)) !== u.hash) return { ok: false, error: 'Incorrect email or password.' }
  store.set({ ...s, sessionUserId: u.id })
  return { ok: true }
}

export function signOut() {
  store.set({ ...store.get(), sessionUserId: null })
}

/** Development-only helper. Real plan changes must come from a verified payment provider webhook. */
export function devSetPlan(plan: Plan) {
  if (process.env.NODE_ENV === 'production') return
  const s = store.get()
  store.set({ ...s, users: s.users.map((u) => (u.id === s.sessionUserId ? { ...u, plan } : u)) })
}

export function useAuth() {
  const s = store.useStore()
  const u = s.users.find((x) => x.id === s.sessionUserId)
  const user: User | null = u ? { id: u.id, name: u.name, email: u.email, plan: u.plan, createdAt: u.createdAt } : null
  return { user, isPremium: user?.plan === 'premium' }
}
