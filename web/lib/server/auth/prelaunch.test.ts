// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { GET as session } from '@/app/api/v1/auth/session/route'

const BASE = 'http://localhost:3000'
const j = async (r: Response) => r.json() as Promise<any>
let n = 0

async function register() {
  const email = `pre${++n}-${Date.now()}@example.com`
  const res = await signup(
    new Request(`${BASE}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.30.0.${n}` },
      body: JSON.stringify({ email, password: 'correct horse battery', acceptTerms: true, over18: true }),
    }),
  )
  return { email, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] }
}
const me = async (cookie: string) => j(await session(new Request(`${BASE}/api/v1/auth/session`, { headers: { cookie } })))

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  delete process.env.APP_LAUNCHED
  delete process.env.RESEND_API_KEY
  await getDb()
}, 60_000)
afterAll(async () => {
  process.env.APP_LAUNCHED = '1'
  await resetDb()
})

describe('pre-launch holding', () => {
  it('keeps a finished member on the "you are in" step until launch', async () => {
    const { cookie } = await register()
    const body = await me(cookie)
    expect(body.next).toBe('prelaunch')
    expect(body.config.launched).toBe(false)
  })

  it('still asks for identity verification first when it is required', async () => {
    const { cookie } = await register()
    process.env.REQUIRE_IDENTITY = '1'
    try {
      expect((await me(cookie)).next).toBe('verify_identity')
    } finally {
      delete process.env.REQUIRE_IDENTITY
    }
  })

  it('lets admins through so the team can test', async () => {
    const { email, cookie } = await register()
    await (await getDb()).query(`update users set role = 'admin' where email = $1`, [email])
    expect((await me(cookie)).next).toBe('continue')
  })

  it('opens the app for everyone when APP_LAUNCHED=1', async () => {
    const { cookie } = await register()
    expect((await me(cookie)).next).toBe('prelaunch')
    process.env.APP_LAUNCHED = '1'
    try {
      const body = await me(cookie)
      expect(body.next).toBe('continue')
      expect(body.config.launched).toBe(true)
    } finally {
      delete process.env.APP_LAUNCHED
    }
  })
})
