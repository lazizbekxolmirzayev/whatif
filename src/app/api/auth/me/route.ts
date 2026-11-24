export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCurrentUser } from '@/server/auth'
import { json } from '@/server/http'

export async function GET() {
  return json({ user: getCurrentUser() })
}
