import fs from 'node:fs'
import path from 'node:path'

/**
 * SQLite via Node's built-in `node:sqlite` (Node >= 22.13; marked experimental by Node).
 * Loaded with process.getBuiltinModule so the bundler never tries to resolve it.
 * Data file: $WHATIF_DB_PATH or ./data/whatif.db. Needs a persistent disk, so it suits
 * self-hosting/VPS/Docker with a volume, not ephemeral serverless filesystems.
 */
export type Row = Record<string, unknown>
interface Stmt {
  run(...a: unknown[]): { changes: number | bigint }
  get(...a: unknown[]): Row | undefined
  all(...a: unknown[]): Row[]
}
interface DB {
  exec(sql: string): void
  prepare(sql: string): Stmt
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pw_salt TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  change_text TEXT NOT NULL,
  character_json TEXT,
  ripples_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branches_user ON branches(user_id);
CREATE TABLE IF NOT EXISTS visited (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);
CREATE TABLE IF NOT EXISTS scenarios_read (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  PRIMARY KEY (user_id, scenario_id)
);
`

const g = globalThis as unknown as { __whatifDb?: DB }

export function getDb(): DB {
  if (g.__whatifDb) return g.__whatifDb
  const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule
  const mod = getBuiltin?.('node:sqlite') as { DatabaseSync: new (p: string) => DB } | undefined
  if (!mod) throw new Error('node:sqlite is unavailable. WHATIF server needs Node.js >= 22.13.')
  const file = process.env.WHATIF_DB_PATH || path.join(process.cwd(), 'data', 'whatif.db')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new mod.DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  db.exec(SCHEMA)
  g.__whatifDb = db
  return db
}
