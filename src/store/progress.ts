'use client'
import { api } from '@/lib/api'
import { createMemoryStore } from './createStore'
import type { CustomBranch, CustomCharacter } from '@/types'

interface ProgressState {
  loaded: boolean
  error: string | null
  visited: string[]
  scenariosRead: string[]
  branches: CustomBranch[]
}
const EMPTY: ProgressState = { loaded: false, error: null, visited: [], scenariosRead: [], branches: [] }
const store = createMemoryStore<ProgressState>(EMPTY)

export function resetProgress() {
  store.set(EMPTY)
}

/** Loads the signed-in user's progress from the server. */
export async function loadProgress() {
  const r = await api<{ visited: string[]; scenariosRead: string[]; branches: CustomBranch[] }>('/api/progress')
  if (r.ok) store.set({ loaded: true, error: null, ...r.data })
  else store.set({ ...EMPTY, loaded: true, error: r.status === 401 ? null : r.error })
}

function track(kind: 'event' | 'scenario', id: string) {
  const s = store.get()
  const key = kind === 'event' ? 'visited' : 'scenariosRead'
  if (s[key].includes(id)) return
  store.set({ ...s, [key]: [...s[key], id] }) // optimistic; failure is harmless and retried on next visit
  void api('/api/progress', { body: { kind, id } })
}
export const markEventVisited = (_userId: string, eventId: string) => track('event', eventId)
export const markScenarioRead = (_userId: string, scenarioId: string) => track('scenario', scenarioId)

export interface BranchInput {
  eventId: string
  title: string
  change: string
  character: CustomCharacter | null
  ripples: { horizon: string; text: string }[]
}
export type SaveResult = { ok: true; branch: CustomBranch } | { ok: false; error: string }

export async function saveBranch(input: BranchInput): Promise<SaveResult> {
  const r = await api<{ branch: CustomBranch }>('/api/branches', { body: input })
  if (!r.ok) return r
  const s = store.get()
  store.set({ ...s, branches: [r.data.branch, ...s.branches.filter((b) => b.id !== r.data.branch.id)] })
  return { ok: true, branch: r.data.branch }
}

export async function deleteBranch(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await api(`/api/branches/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) return r
  const s = store.get()
  store.set({ ...s, branches: s.branches.filter((b) => b.id !== id) })
  return { ok: true }
}

export function useProgress(userId: string | undefined) {
  const s = store.useStore()
  return userId
    ? { loaded: s.loaded, error: s.error, visited: s.visited, scenariosRead: s.scenariosRead, branches: s.branches }
    : { loaded: true, error: null, visited: [] as string[], scenariosRead: [] as string[], branches: [] as CustomBranch[] }
}
