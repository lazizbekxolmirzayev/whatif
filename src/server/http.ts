import { NextResponse } from 'next/server'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
export const fail = (error: string, status = 400) => json({ error }, status)

/** CSRF defence in depth (cookies are SameSite=Lax): JSON content type + same-origin Origin header. */
export function checkMutation(req: Request): string | null {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return 'Expected application/json.'
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get('host')) return 'Cross-origin request blocked.'
    } catch {
      return 'Bad origin.'
    }
  }
  return null
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json()
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Simple in-memory fixed-window limiter (per process). Use a shared store if you run several instances. */
const hits = new Map<string, { n: number; reset: number }>()
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs })
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    return false
  }
  h.n++
  return h.n > max
}
/** Behind a trusted proxy, x-forwarded-for is set by it; otherwise this header is client-controlled. */
export function clientIp(req: Request) {
  return (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
}
