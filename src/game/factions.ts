import type { FactionId } from './types.ts'

export const FACTION_COLOR: Record<FactionId, string> = {
  ottoman: '#b3262e',
  timurid: '#1f9bb0',
  byzantine: '#8d5bd0',
  beylik: '#58a84f',
  rumelian: '#d8892a',
  neutral: '#8a8f9c',
}

export const FACTION_NAME: Record<FactionId, string> = {
  ottoman: 'Ottoman',
  timurid: 'Timurid',
  byzantine: 'Byzantine',
  beylik: 'Anatolian principalities',
  rumelian: 'Ottoman Rumelia (Balkan princes)',
  neutral: 'Unaligned',
}
