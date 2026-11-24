export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { endSession } from '@/server/auth'
import { checkMutation, fail, json } from '@/server/http'

export async function POST(req: Request) {
  const bad = checkMutation(req)
  if (bad) return fail(bad, 403)
  await endSession()
  return json({ ok: true })
}
