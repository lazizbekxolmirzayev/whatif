export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { findUserByCredentials, startSession, validateEmail, validatePassword } from '@/server/auth'
import { checkMutation, clientIp, fail, json, rateLimited, readJson } from '@/server/http'

export async function POST(req: Request) {
  const bad = checkMutation(req)
  if (bad) return fail(bad, 403)
  const b = await readJson(req)
  if (!b) return fail('Invalid request body.')
  const err = validateEmail(b.email) ?? validatePassword(b.password)
  if (err) return fail(err, 422)
  const key = 'login:' + clientIp(req) + ':' + String(b.email).toLowerCase()
  if (rateLimited(key, 10, 15 * 60_000)) return fail('Too many attempts. Try again in a few minutes.', 429)
  const u = findUserByCredentials(b.email as string, b.password as string)
  if (!u) return fail('Incorrect email or password.', 401)
  await startSession(u.id)
  return json({ user: u })
}
