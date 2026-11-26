import { MIGRATIONS } from './migrations'

/**
 * Database access for the API.
 *
 * - `DATABASE_URL=postgres://…`  → node-postgres pool (production: the Postgres
 *   container or managed PostgreSQL).
 * - `DATABASE_URL=pglite://memory` or `pglite://<dir>` → PGlite, a real Postgres
 *   engine running in-process. Used for local development and tests so nothing
 *   has to be installed. Refused in production.
 * - Unset outside production → PGlite persisted in ./.data/pgdata.
 */

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>
  close(): Promise<void>
}

const isProd = () => process.env.NODE_ENV === 'production'

type Holder = { db?: Promise<Db> }
const g = globalThis as unknown as { __cmDb?: Holder }
const holder: Holder = (g.__cmDb ??= {})

export function getDb(): Promise<Db> {
  holder.db ??= open().catch((e) => {
    holder.db = undefined
    throw e
  })
  return holder.db
}

/** Test helper: drop the cached connection so the next getDb() re-opens. */
export async function resetDb(): Promise<void> {
  const p = holder.db
  holder.db = undefined
  if (p) await (await p.catch(() => undefined))?.close()
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim() || (isProd() ? '' : 'pglite://./.data/pgdata')
  if (!url) throw new Error('DATABASE_URL is not set')

  let db: Db
  if (url.startsWith('pglite://')) {
    if (isProd()) throw new Error('PGlite is for development only; set DATABASE_URL to a Postgres URL')
    db = await openPglite(url.slice('pglite://'.length))
  } else {
    db = await openPg(url)
  }
  await migrate(db)
  return db
}

async function openPg(url: string): Promise<Db> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_MS ?? 30_000),
    connectionTimeoutMillis: 10_000,
    // Managed databases require TLS; a local container does not. Set DATABASE_SSL=1 to require it.
    ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: true } : undefined,
  })
  pool.on('error', (e) => console.error('[db] idle client error', e.message))
  return {
    query: (sql, params) => pool.query(sql, params as unknown[]) as never,
    async tx(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const out = await fn({ query: (sql, params) => client.query(sql, params as unknown[]) as never })
        await client.query('commit')
        return out
      } catch (e) {
        await client.query('rollback').catch(() => undefined)
        throw e
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

async function openPglite(target: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = new PGlite(target === 'memory' ? undefined : target)
  await pg.waitReady
  return {
    query: (sql, params) => pg.query(sql, params as unknown[]) as never,
    tx: (fn) => pg.transaction((t) => fn({ query: (sql, params) => t.query(sql, params as unknown[]) as never })),
    close: () => pg.close(),
  }
}

async function migrate(db: Db): Promise<void> {
  await db.query(
    'create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())',
  )
  const done = new Set((await db.query<{ id: string }>('select id from schema_migrations')).rows.map((r) => r.id))
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue
    await db.tx(async (q) => {
      // PGlite takes one statement per query() call unless using exec; split on the blank-line-safe `;` boundaries.
      for (const stmt of splitSql(m.sql)) await q.query(stmt)
      await q.query('insert into schema_migrations (id) values ($1)', [m.id])
    })
    console.log(`[db] applied migration ${m.id}`)
  }
}

/** Splits a migration into statements. Our migrations contain no `;` inside strings or function bodies. */
function splitSql(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}
