import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getDb } from './db'
import type { Plan, User } from '@/types'

export const COOKIE = 'whatif_session'
const SESSION_MS = 30 * 24 * 3600 * 1000

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function hashPassword(password: string, saltHex = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex')
  return { salt: saltHex, hash }
}
export function verifyPassword(password: string, saltHex: string, hashHex: string) {
  const a = Buffer.from(hashPassword(password, saltHex).hash, 'hex')
  const b = Buffer.from(hashHex, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function validateEmail(email: unknown): string | null {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address.'
}
export function validatePassword(p: unknown): string | null {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128 ? null : 'Password must be 8–128 characters.'
}
export function validateName(n: unknown): string | null {
  return typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 60 ? null : 'Name must be 2–60 characters.'
}

export function createUser(name: string, email: string, password: string): User | 'exists' {
  const db = getDb()
  const e = email.trim().toLowerCase()
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) return 'exists'
  const { salt, hash } = hashPassword(password)
  const u: User = { id: randomUUID(), name: name.trim(), email: e, plan: 'free', createdAt: Date.now() }
  db.prepare('INSERT INTO users (id,name,email,pw_salt,pw_hash,plan,created_at) VALUES (?,?,?,?,?,?,?)').run(u.id, u.name, u.email, salt, hash, u.plan, u.createdAt)
  return u
}

function rowToUser(r: Record<string, unknown>): User {
  return { id: String(r.id), name: String(r.name), email: String(r.email), plan: r.plan as Plan, createdAt: Number(r.created_at) }
}

export function findUserByCredentials(email: string, password: string): User | null {
  const r = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
  // Always run a hash so response time does not reveal whether the email exists.
  if (!r) {
    hashPassword(password, '00'.repeat(16))
    return null
  }
  return verifyPassword(password, String(r.pw_salt), String(r.pw_hash)) ? rowToUser(r) : null
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(sha256(token), userId, Date.now() + SESSION_MS)
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_MS / 1000 })
}

export async function endSession() {
  const token = cookies().get(COOKIE)?.value
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
  cookies().set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
}

export function getCurrentUser(): User | null {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  const r = getDb()
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(sha256(token), Date.now())
  return r ? rowToUser(r) : null
}
