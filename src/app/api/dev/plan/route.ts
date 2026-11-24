export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCurrentUser } from '@/server/auth'
import { getDb } from '@/server/db'
import { checkMutation, fail, json, readJson } from '@/server/http'

/** Development-only. In production this route does not exist for callers (404). Real plan changes must come from a verified payment webhook. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return fail('Not found.', 404)
  const bad = checkMutation(req)
  if (bad) return fail(bad, 403)
  const u = getCurrentUser()
  if (!u) return fail('Not signed in.', 401)
  const b = await readJson(req)
  if (!b || (b.plan !== 'free' && b.plan !== 'premium')) return fail('Invalid plan.', 422)
  getDb().prepare('UPDATE users SET plan = ? WHERE id = ?').run(b.plan, u.id)
  return json({ user: { ...u, plan: b.plan } })
}
