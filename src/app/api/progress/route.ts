export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCurrentUser } from '@/server/auth'
import { getDb } from '@/server/db'
import { EVENT_BY_ID, EVENTS } from '@/data/events'
import { checkMutation, fail, json, readJson } from '@/server/http'
import { rowToBranch } from '@/server/branches'

const SCENARIO_IDS = new Set(EVENTS.flatMap((e) => e.scenarios.map((s) => s.id)))

export async function GET() {
  const u = getCurrentUser()
  if (!u) return fail('Not signed in.', 401)
  const db = getDb()
  return json({
    visited: db.prepare('SELECT event_id FROM visited WHERE user_id = ?').all(u.id).map((r) => String(r.event_id)),
    scenariosRead: db.prepare('SELECT scenario_id FROM scenarios_read WHERE user_id = ?').all(u.id).map((r) => String(r.scenario_id)),
    branches: db.prepare('SELECT * FROM branches WHERE user_id = ? ORDER BY created_at DESC').all(u.id).map(rowToBranch),
  })
}

export async function POST(req: Request) {
  const bad = checkMutation(req)
  if (bad) return fail(bad, 403)
  const u = getCurrentUser()
  if (!u) return fail('Not signed in.', 401)
  const b = await readJson(req)
  if (!b || typeof b.id !== 'string') return fail('Invalid request body.')
  const db = getDb()
  if (b.kind === 'event' && EVENT_BY_ID[b.id]) {
    db.prepare('INSERT OR IGNORE INTO visited (user_id,event_id) VALUES (?,?)').run(u.id, b.id)
  } else if (b.kind === 'scenario' && SCENARIO_IDS.has(b.id)) {
    db.prepare('INSERT OR IGNORE INTO scenarios_read (user_id,scenario_id) VALUES (?,?)').run(u.id, b.id)
  } else return fail('Unknown event or scenario.', 422)
  return json({ ok: true })
}
