import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/health: used by Docker, the load balancer and uptime monitors. No auth, no data. */
export function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() })
}
