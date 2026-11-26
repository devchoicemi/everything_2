// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { POST as startIdentity } from '@/app/api/v1/auth/signicat/start/route'

/**
 * Production talks to PostgreSQL through node-postgres. This runs the same
 * routes through that driver, over the real Postgres wire protocol, against an
 * in-process server, so the pool, transactions and parameter handling are exercised.
 */
let pg: PGlite
let server: PGLiteSocketServer

beforeAll(async () => {
  pg = await PGlite.create()
  server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1' })
  await server.start()
  const addr = (server as unknown as { server: { address(): { port: number } } }).server.address()
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${addr.port}/postgres`
  process.env.DATABASE_POOL_MAX = '1' // PGlite serves one connection at a time
  process.env.SIGNICAT_MOCK = '1'
  await resetDb()
  await getDb()
}, 90_000)

afterAll(async () => {
  await resetDb()
  await server.stop()
  await pg.close()
})

const BASE = 'http://localhost:3000'
const req = (path: string, body: unknown, cookie?: string) =>
  new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.20.0.1', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })

describe('node-postgres driver', () => {
  it('applied the migrations', async () => {
    const db = await getDb()
    const { rows } = await db.query<{ id: string }>('select id from schema_migrations')
    expect(rows.map((r) => r.id)).toContain('0001_auth')
  })

  it('signs up, signs in and reads the session through a transaction-backed flow', async () => {
    const email = `pg-${Date.now()}@example.com`
    const created = await signup(req('/api/v1/auth/signup', { email, password: 'correct horse battery', acceptTerms: true, over18: true }))
    expect(created.status).toBe(201)

    const out = await login(req('/api/v1/auth/login', { email, password: 'correct horse battery' }))
    expect(out.status).toBe(200)
    const cookie = (out.headers.get('set-cookie') ?? '').split(';')[0]

    const me = await (await session(new Request(`${BASE}/api/v1/auth/session`, { headers: { cookie } }))).json()
    expect(me.authenticated).toBe(true)
    expect(me.user.email).toBe(email)

    const start = await startIdentity(req('/api/v1/auth/signicat/start', {}, cookie))
    expect(start.status).toBe(200)
  })

  it('rolls a failed transaction back completely', async () => {
    const db = await getDb()
    await expect(
      db.tx(async (q) => {
        await q.query(
          `insert into users (email, username, password_hash, terms_version, terms_accepted_at, over18_declared_at)
           values ('rollback@example.com', 'Roll_Back', 'x', 't', now(), now())`,
        )
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect((await db.query('select 1 from users where email = $1', ['rollback@example.com'])).rows).toHaveLength(0)
  })
})
