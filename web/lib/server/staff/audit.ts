import { getDb } from '../db'

/** The staff activity log: who did what, to what, and when. Needs `audit.read`. */
export async function listAudit(url: URL) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 300)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const action = url.searchParams.get('action')?.trim().slice(0, 60) || null
  const actor = url.searchParams.get('actor')?.trim().toLowerCase().slice(0, 60) || null
  const target = url.searchParams.get('target')?.trim().slice(0, 80) || null
  const db = await getDb()
  const params: unknown[] = []
  const where: string[] = []
  if (action) {
    params.push(`${action}%`)
    where.push(`a.action like $${params.length}`)
  }
  if (actor) {
    params.push(`%${actor}%`)
    where.push(`lower(a.actor_label) like $${params.length}`)
  }
  if (target) {
    params.push(target)
    where.push(`a.target_id = $${params.length}`)
  }
  const sql = where.length ? `where ${where.join(' and ')}` : ''
  const { rows } = await db.query(`select a.id, a.at, a.actor_label, a.action, a.target_type, a.target_id, a.meta, a.ip from audit_log a ${sql} order by a.at desc, a.id desc limit ${limit} offset ${offset}`, params)
  const total = (await db.query<{ n: number }>(`select count(*)::int as n from audit_log a ${sql}`, params)).rows[0].n
  return { total, entries: rows }
}
