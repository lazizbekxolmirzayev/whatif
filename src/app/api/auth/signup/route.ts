export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createUser, startSession, validateEmail, validateName, validatePassword } from '@/server/auth'
import { checkMutation, clientIp, fail, json, rateLimited, readJson } from '@/server/http'

export async function POST(req: Request) {
  const bad = checkMutation(req)
  if (bad) return fail(bad, 403)
  if (rateLimited('signup:' + clientIp(req), 10, 3600_000)) return fail('Too many sign-ups. Try again later.', 429)
  const b = await readJson(req)
  if (!b) return fail('Invalid request body.')
  const err = validateName(b.name) ?? validateEmail(b.email) ?? validatePassword(b.password)
  if (err) return fail(err, 422)
  const u = createUser(b.name as string, b.email as string, b.password as string)
  if (u === 'exists') return fail('An account with this email already exists.', 409)
  await startSession(u.id)
  return json({ user: u }, 201)
}
