export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

/** Thin fetch wrapper: never throws, always returns a user-presentable error. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? `Request failed (${res.status}).`, status: res.status }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.', status: 0 }
  }
}
