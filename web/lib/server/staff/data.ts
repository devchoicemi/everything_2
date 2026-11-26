import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { audit, type StaffContext } from './access'

/**
 * A read-only look at the database for the roles that hold `data.read`. Secrets never leave it: password hashes,
 * session and token hashes, one-time codes, passkey keys and QR numbers are replaced with a marker.
 */
const HIDDEN = new Set(['password_hash', 'token_hash', 'code_hash', 'challenge_hash', 'challenge', 'public_key', 'credential_id', 'qr_nonce', 'booking_code', 'subject', 'secret', 'ip', 'user_agent'])
const SKIP_TABLES = new Set(['migrations', 'schema_migrations', 'rate_limits'])

async function tableNames(): Promise<string[]> {
  const db = await getDb()
  const { rows } = await db.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)
  return rows.map((r) => r.table_name).filter((t) => !SKIP_TABLES.has(t) && !t.startsWith('_'))
}

export async function listTables() {
  const db = await getDb()
  const names = await tableNames()
  const out: { name: string; rows: number }[] = []
  for (const name of names) out.push({ name, rows: (await db.query<{ n: number }>(`select count(*)::int as n from "${name}"`)).rows[0].n })
  return { tables: out }
}

export async function browseTable(ctx: StaffContext, req: Request, name: string, url: URL) {
  const names = await tableNames()
  if (!names.includes(name)) throw new ApiError(404, 'not_found', 'No such table.')
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const db = await getDb()
  const cols = (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [name])).rows.map((c) => c.column_name)
  const order = ['created_at', 'at', 'id'].find((c) => cols.includes(c))
  const { rows } = await db.query<Record<string, unknown>>(`select * from "${name}" ${order ? `order by "${order}" desc` : ''} limit ${limit} offset ${offset}`)
  const total = (await db.query<{ n: number }>(`select count(*)::int as n from "${name}"`)).rows[0].n
  if (offset === 0) await audit(db, ctx, req, 'data.viewed', { type: 'table', id: name })
  return {
    table: name,
    columns: cols.map((c) => ({ name: c, hidden: HIDDEN.has(c) })),
    total,
    rows: rows.map((r) => Object.fromEntries(cols.map((c) => [c, HIDDEN.has(c) ? '••••' : r[c] instanceof Date ? (r[c] as Date).toISOString() : r[c]]))),
  }
}
