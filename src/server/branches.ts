import type { CustomBranch } from '@/types'
import type { Row } from './db'

export function rowToBranch(r: Row): CustomBranch {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    eventId: String(r.event_id),
    title: String(r.title),
    change: String(r.change_text),
    character: r.character_json ? JSON.parse(String(r.character_json)) : null,
    ripples: JSON.parse(String(r.ripples_json)),
    createdAt: Number(r.created_at),
  }
}
