export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCurrentUser } from '@/server/auth'
import { getDb } from '@/server/db'
import { fail, json } from '@/server/http'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const u = getCurrentUser()
  if (!u) return fail('Not signed in.', 401)
  const origin = req.headers.get('origin')
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail('Cross-origin request blocked.', 403)
  const r = getDb().prepare('DELETE FROM branches WHERE id = ? AND user_id = ?').run(params.id, u.id)
  return Number(r.changes) ? json({ ok: true }) : fail('Timeline not found.', 404)
}
