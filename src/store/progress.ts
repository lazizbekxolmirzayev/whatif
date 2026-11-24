'use client'
import { createPersistentStore } from './createStore'
import type { CustomBranch } from '@/types'

interface ProgressState {
  /** userId -> event ids explored */
  visited: Record<string, string[]>
  /** userId -> scenario ids read */
  scenarios: Record<string, string[]>
  branches: CustomBranch[]
}

const store = createPersistentStore<ProgressState>('whatif.progress.v1', { visited: {}, scenarios: {}, branches: [] })

function addUnique(map: Record<string, string[]>, userId: string, id: string) {
  const cur = map[userId] ?? []
  return cur.includes(id) ? map : { ...map, [userId]: [...cur, id] }
}

export function markEventVisited(userId: string, eventId: string) {
  const s = store.get()
  const next = addUnique(s.visited, userId, eventId)
  if (next !== s.visited) store.set({ ...s, visited: next })
}
export function markScenarioRead(userId: string, scenarioId: string) {
  const s = store.get()
  const next = addUnique(s.scenarios, userId, scenarioId)
  if (next !== s.scenarios) store.set({ ...s, scenarios: next })
}
export function saveBranch(b: CustomBranch) {
  const s = store.get()
  store.set({ ...s, branches: [...s.branches.filter((x) => x.id !== b.id), b] })
}
export function deleteBranch(id: string) {
  const s = store.get()
  store.set({ ...s, branches: s.branches.filter((x) => x.id !== id) })
}
export function useProgress(userId: string | undefined) {
  const s = store.useStore()
  return {
    visited: userId ? s.visited[userId] ?? [] : [],
    scenariosRead: userId ? s.scenarios[userId] ?? [] : [],
    branches: userId ? s.branches.filter((b) => b.userId === userId) : [],
  }
}
