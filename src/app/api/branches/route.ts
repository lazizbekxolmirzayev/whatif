export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { randomUUID } from 'node:crypto'
import { getCurrentUser } from '@/server/auth'
import { getDb } from '@/server/db'
import { EVENT_BY_ID } from '@/data/events'
import { FREE_BRANCH_LIMIT, HORIZONS } from '@/lib/limits'
import { checkMutation, fail, json, rateLimited, readJson } from '@/server/http'
import { rowToBranch } from '@/server/branches'

const str = (v: unknown, min: number, max: number) => (typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : null)

export async function POST(req: Request) {
  const bad = checkMutation(req)
  if (bad) return fail(bad, 403)
  const u = getCurrentUser()
  if (!u) return fail('Sign in to save timelines.', 401)
  if (rateLimited('branch:' + u.id, 60, 3600_000)) return fail('Too many saves. Try again later.', 429)
  const b = await readJson(req)
  if (!b) return fail('Invalid request body.')

  if (typeof b.eventId !== 'string' || !EVENT_BY_ID[b.eventId]) return fail('Unknown event.', 422)
  const change = str(b.change, 15, 400)
  if (!change) return fail('The change must be 15–400 characters.', 422)
  const title = b.title === undefined || b.title === '' ? 'What if: ' + change.slice(0, 48) : str(b.title, 1, 80)
  if (!title) return fail('Title must be at most 80 characters.', 422)

  if (!Array.isArray(b.ripples)) return fail('Consequences are required.', 422)
  const ripples: { horizon: string; text: string }[] = []
  for (const r of b.ripples as Record<string, unknown>[]) {
    if (!r || !(HORIZONS as readonly string[]).includes(r.horizon as string) || typeof r.text !== 'string' || r.text.length > 600) return fail('Invalid consequence entry.', 422)
    if (r.text.trim()) ripples.push({ horizon: r.horizon as string, text: r.text.trim() })
  }
  if (!ripples.some((r) => r.text.length >= 20)) return fail('Write at least one consequence (20+ characters).', 422)

  let character: unknown = null
  if (b.character) {
    const c = b.character as Record<string, unknown>
    const name = str(c.name, 2, 60)
    const role = str(c.role, 2, 60)
    const motivation = typeof c.motivation === 'string' ? c.motivation.trim().slice(0, 250) : ''
    const traits = Array.isArray(c.traits) ? c.traits.filter((t): t is string => typeof t === 'string' && t.length <= 30).slice(0, 4) : []
    if (!name || !role) return fail('Character needs a name and a role.', 422)
    character = { name, role, traits, motivation }
  }

  const db = getDb()
  if (u.plan !== 'premium') {
    const n = Number(db.prepare('SELECT COUNT(*) AS n FROM branches WHERE user_id = ?').get(u.id)?.n ?? 0)
    if (n >= FREE_BRANCH_LIMIT) return fail(`Free accounts can save up to ${FREE_BRANCH_LIMIT} timelines. Delete one or upgrade.`, 403)
  }
  const id = randomUUID()
  db.prepare('INSERT INTO branches (id,user_id,event_id,title,change_text,character_json,ripples_json,created_at) VALUES (?,?,?,?,?,?,?,?)').run(
    id, u.id, b.eventId, title, change, character ? JSON.stringify(character) : null, JSON.stringify(ripples), Date.now(),
  )
  return json({ branch: rowToBranch(db.prepare('SELECT * FROM branches WHERE id = ?').get(id)!) }, 201)
}
