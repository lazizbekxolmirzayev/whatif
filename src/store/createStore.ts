'use client'
import { useSyncExternalStore } from 'react'

/** Minimal localStorage-backed store. SSR-safe: server and first client render use `initial`. */
export function createPersistentStore<T>(key: string, initial: T) {
  let state: T = initial
  let loaded = false
  const listeners = new Set<() => void>()

  function load() {
    if (loaded || typeof window === 'undefined') return
    loaded = true
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) state = JSON.parse(raw) as T
    } catch {
      state = initial
    }
  }
  function emit() {
    listeners.forEach((l) => l())
  }
  function set(next: T) {
    state = next
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* storage may be full or blocked; state stays in memory */
    }
    emit()
  }
  function get(): T {
    load()
    return state
  }
  function subscribe(l: () => void) {
    listeners.add(l)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        loaded = false
        load()
        emit()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', onStorage)
    }
  }
  function useStore(): T {
    return useSyncExternalStore(subscribe, get, () => initial)
  }
  return { get, set, useStore }
}
