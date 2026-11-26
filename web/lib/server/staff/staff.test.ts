// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { outbox } from '@/lib/server/auth/mailer'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { GET as me } from '@/app/api/v1/admin/me/route'
import { GET as sStaff } from '@/app/api/v1/admin/staff/route'
import { GET as sDirectory } from '@/app/api/v1/admin/staff/directory/route'
import { POST as sInvite } from '@/app/api/v1/admin/staff/invite/route'
import { POST as sRole } from '@/app/api/v1/admin/staff/[id]/role/route'
import { POST as sActive } from '@/app/api/v1/admin/staff/[id]/active/route'
import { GET as uList } from '@/app/api/v1/admin/users/route'
import { GET as uOne } from '@/app/api/v1/admin/users/[id]/route'
import { POST as uStatus } from '@/app/api/v1/admin/users/[id]/status/route'
import { POST as uSignOut } from '@/app/api/v1/admin/users/[id]/sign-out/route'
import { GET as kList } from '@/app/api/v1/admin/kyc/route'
import { POST as kOpen } from '@/app/api/v1/admin/kyc/cases/route'
import { POST as kDecide } from '@/app/api/v1/admin/kyc/cases/[id]/decide/route'
import { GET as hList } from '@/app/api/v1/admin/support/route'
import { GET as hOne } from '@/app/api/v1/admin/support/[id]/route'
import { POST as hReply } from '@/app/api/v1/admin/support/[id]/reply/route'
import { POST as hUpdate } from '@/app/api/v1/admin/support/[id]/update/route'
import { GET as aLog } from '@/app/api/v1/admin/audit/route'
import { GET as dTables } from '@/app/api/v1/admin/data/route'
import { GET as dTable } from '@/app/api/v1/admin/data/[table]/route'
import { GET as aSummary } from '@/app/api/v1/admin/summary/route'
import { GET as vQueue } from '@/app/api/v1/admin/venues/route'
import { GET as bLog } from '@/app/api/v1/admin/bookings/route'
import { GET as mQueue } from '@/app/api/v1/admin/moderation/route'
import { GET as myTickets, POST as openTicketRoute } from '@/app/api/v1/support/tickets/route'
import { GET as myTicket } from '@/app/api/v1/support/tickets/[id]/route'
import { POST as myReply } from '@/app/api/v1/support/tickets/[id]/reply/route'
import { GET as notifications } from '@/app/api/v1/notifications/route'
import { POST as sendOptions } from '@/app/api/v1/bookings/[id]/options/route'
import { POST as pick } from '@/app/api/v1/bookings/[id]/pick/route'
import { POST as confirm } from '@/app/api/v1/bookings/[id]/confirm/route'
import { POST as pConfirm } from '@/app/api/v1/partner/bookings/[id]/confirm/route'
import { POST as report } from '@/app/api/v1/bookings/[id]/report/route'
import { GET as getBooking } from '@/app/api/v1/bookings/[id]/route'
import { ROLE_PERMISSIONS, STAFF_ROLES, type StaffRole } from '@/lib/server/staff/access'
import { PW, cookieOf, freshOptions, get, j, matched, member, partnerFor, post, req } from '@/lib/server/testkit'

const ADMIN = 'a'.repeat(48)
const bearer = { authorization: `Bearer ${ADMIN}` }

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  process.env.ADMIN_TOKEN = ADMIN
  delete process.env.APP_LAUNCHED
  delete process.env.REQUIRE_EMAIL_VERIFICATION
  await getDb()
}, 60_000)
beforeEach(() => {
  outbox.length = 0
})
afterAll(async () => {
  delete process.env.ADMIN_TOKEN
  process.env.APP_LAUNCHED = '1'
  await resetDb()
})

type Staff = { id: string; email: string; cookie: string; role: StaffRole }
let n = 0

/** Invites someone with the server's admin token, then they create their sign-in from the link, as in real life. */
async function staffUser(role: StaffRole): Promise<Staff> {
  const email = `staff${++n}-${Date.now()}@choicemi.test`
  const inv = await sInvite(req('/api/v1/admin/staff/invite', { method: 'POST', headers: bearer, body: { email, role } }))
  expect(inv.status).toBe(200)
  const mail = outbox.find((m) => m.to === email)!
  expect(mail.text).toMatch(/http:\/\/localhost:3300\/join\?invite=/)
  const token = /invite=([\w-]+)/.exec(mail.text)![1]
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true, inviteToken: token } }))
  expect(res.status).toBe(201)
  const user = (await j(res)).user
  expect(user.role).toBe('admin')
  return { id: user.id, email, cookie: cookieOf(res), role }
}

const as = (s: { cookie: string }) => ({ cookie: s.cookie })
const GET = (h: (r: Request) => Promise<Response>, path: string, s?: { cookie: string }) => h(req(path, s ? { cookie: s.cookie } : { headers: bearer }))
const POST = (h: (r: Request) => Promise<Response>, path: string, s: { cookie: string } | null, body: unknown = {}) => h(req(path, { method: 'POST', body, ...(s ? { cookie: s.cookie } : { headers: bearer }) }))

describe('who gets in', () => {
  it('needs sign-in, then a staff account', async () => {
    expect((await me(req('/api/v1/admin/me'))).status).toBe(401)
    const m = await member('man', ['Women'])
    const r = await get(me, '/api/v1/admin/me', m)
    expect(r.status).toBe(403)
    expect((await j(r)).error.code).toBe('not_staff')
    expect((await me(req('/api/v1/admin/me', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401)
    expect((await GET(me, '/api/v1/admin/me')).status).toBe(200) // the server token is a super admin
  })

  it('an invited person signs up as staff with exactly the role they were invited to', async () => {
    const s = await staffUser('support_agent')
    const out = await j(await get(me, '/api/v1/admin/me', s))
    expect(out).toMatchObject({ role: 'support_agent', roleLabel: 'Support agent', email: s.email })
    expect(out.permissions).toEqual([...ROLE_PERMISSIONS.support_agent])
    // staff skip identity verification and the pre-launch wait
    process.env.REQUIRE_IDENTITY = '1'
    try {
      expect((await j(await session(req('/api/v1/auth/session', { cookie: s.cookie })))).next).toBe('continue')
    } finally {
      delete process.env.REQUIRE_IDENTITY
    }
  })

  it('an existing account cannot be turned into staff by invitation, and bad roles are refused', async () => {
    const m = await member('man', ['Women'])
    const db = await getDb()
    const email = (await db.query<{ email: string }>('select email from users where id = $1', [m.id])).rows[0].email
    expect((await POST(sInvite, '/api/v1/admin/staff/invite', null, { email, role: 'admin' })).status).toBe(409)
    expect((await POST(sInvite, '/api/v1/admin/staff/invite', null, { email: 'new@choicemi.test', role: 'god' })).status).toBe(400)
  })
})

describe('each role sees only what it should', () => {
  const endpoints: { name: string; call: (s: { cookie: string }) => Promise<Response>; perm: string }[] = [
    { name: 'team', call: (s) => get(sStaff, '/api/v1/admin/staff', s), perm: 'staff.manage' },
    { name: 'users', call: (s) => get(uList, '/api/v1/admin/users', s), perm: 'users.read' },
    { name: 'kyc', call: (s) => get(kList, '/api/v1/admin/kyc', s), perm: 'kyc.read' },
    { name: 'helpdesk', call: (s) => get(hList, '/api/v1/admin/support', s), perm: 'support.read' },
    { name: 'venues', call: (s) => get(vQueue, '/api/v1/admin/venues', s), perm: 'venues.review' },
    { name: 'bookings', call: (s) => get(bLog, '/api/v1/admin/bookings', s), perm: 'bookings.read' },
    { name: 'moderation', call: (s) => get(mQueue, '/api/v1/admin/moderation', s), perm: 'moderation.manage' },
    { name: 'audit', call: (s) => get(aLog, '/api/v1/admin/audit', s), perm: 'audit.read' },
    { name: 'data', call: (s) => get(dTables, '/api/v1/admin/data', s), perm: 'data.read' },
  ]

  for (const role of STAFF_ROLES) {
    it(`${role}: allowed where the role says so, refused everywhere else`, async () => {
      const s = await staffUser(role)
      for (const e of endpoints) {
        const res = await e.call(s)
        const allowed = (ROLE_PERMISSIONS[role] as readonly string[]).includes(e.perm)
        expect([e.name, res.status]).toEqual([e.name, allowed ? 200 : 403])
      }
      // anyone on staff can open the dashboard summary and the assignee list
      expect((await get(aSummary, '/api/v1/admin/summary', s)).status).toBe(200)
      expect((await get(sDirectory, '/api/v1/admin/staff/directory', s)).status).toBe(200)
    })
  }

  it('read-only roles cannot change anything', async () => {
    const auditor = await staffUser('auditor')
    const m = await member('man', ['Women'])
    expect((await POST(uStatus, `/api/v1/admin/users/${m.id}/status`, auditor, { status: 'suspended', reason: 'x' })).status).toBe(403)
    expect((await POST(kOpen, '/api/v1/admin/kyc/cases', auditor, { userId: m.id, reason: 'x' })).status).toBe(403)
    expect((await POST(sRole, `/api/v1/admin/staff/${auditor.id}/role`, auditor, { role: 'admin' })).status).toBe(403)
  })
})

describe('the team', () => {
  it('a super admin changes roles and switches people off; the last super admin is protected', async () => {
    const boss = await staffUser('super_admin')
    const other = await staffUser('support_agent')
    expect((await POST(sRole, `/api/v1/admin/staff/${other.id}/role`, boss, { role: 'kyc_officer' })).status).toBe(200)
    expect((await j(await get(me, '/api/v1/admin/me', other))).role).toBe('kyc_officer')
    expect((await POST(sRole, `/api/v1/admin/staff/${boss.id}/role`, boss, { role: 'admin' })).status).toBe(400) // not yourself
    expect((await POST(sRole, `/api/v1/admin/staff/${other.id}/role`, boss, { role: 'nope' })).status).toBe(400)

    // switching off ends their sessions at once
    expect((await POST(sActive, `/api/v1/admin/staff/${other.id}/active`, boss, { active: false })).status).toBe(200)
    expect((await get(me, '/api/v1/admin/me', other)).status).toBe(401)
    expect((await POST(sActive, `/api/v1/admin/staff/${other.id}/active`, boss, { active: true })).status).toBe(200)

    // make sure nobody else is a super admin, then try to demote the only one through the token
    const db = await getDb()
    await db.query(`update staff set role = 'admin' where role = 'super_admin' and user_id <> $1`, [boss.id])
    const demote = await POST(sRole, `/api/v1/admin/staff/${boss.id}/role`, null, { role: 'admin' })
    expect(demote.status).toBe(409)
    expect((await j(demote)).error.code).toBe('last_super_admin')
    expect((await POST(sActive, `/api/v1/admin/staff/${boss.id}/active`, null, { active: false })).status).toBe(409)
    const list = await j(await get(sStaff, '/api/v1/admin/staff', boss))
    expect(list.staff.some((s: any) => s.id === boss.id && s.role === 'super_admin')).toBe(true)
    expect(list.roles).toHaveLength(STAFF_ROLES.length)
  })

  it('an admin cannot manage the team', async () => {
    const admin = await staffUser('admin')
    const other = await staffUser('moderator')
    expect((await POST(sRole, `/api/v1/admin/staff/${other.id}/role`, admin, { role: 'admin' })).status).toBe(403)
    expect((await POST(sInvite, '/api/v1/admin/staff/invite', admin, { email: 'x@choicemi.test', role: 'admin' })).status).toBe(403)
  })
})

describe('members and venues', () => {
  it('search finds accounts, and the detail page shows only the sections a role may see', async () => {
    const m = await member('woman', ['Men'])
    const agent = await staffUser('support_agent')
    const officer = await staffUser('kyc_officer')
    const found = await j(await get(uList, `/api/v1/admin/users?q=${m.username.toLowerCase()}`, agent))
    expect(found.users.map((u: any) => u.id)).toContain(m.id)
    expect((await j(await get(uList, '/api/v1/admin/users?role=nope', agent))).error).toBeTruthy()
    expect((await j(await get(uList, '/api/v1/admin/users?role=partner', agent))).users.every((u: any) => u.role === 'partner')).toBe(true)

    const forAgent = await j(await get(uOne, `/api/v1/admin/users/${m.id}`, agent))
    expect(forAgent.sections).toEqual(expect.arrayContaining(['bookings', 'support']))
    expect(forAgent.sections).not.toContain('kyc')
    expect(forAgent.identity).toBeUndefined()
    const forOfficer = await j(await get(uOne, `/api/v1/admin/users/${m.id}`, officer))
    expect(forOfficer.sections).toContain('kyc')
    expect(forOfficer.sections).not.toContain('bookings')
    expect(JSON.stringify(forAgent)).not.toMatch(/password|token_hash/)
  })

  it('suspending needs a reason, ends their sessions, and staff accounts are off limits', async () => {
    const m = await member('man', ['Women'])
    const admin = await staffUser('admin')
    expect((await POST(uStatus, `/api/v1/admin/users/${m.id}/status`, admin, { status: 'suspended' })).status).toBe(400)
    expect((await POST(uStatus, `/api/v1/admin/users/${m.id}/status`, admin, { status: 'suspended', reason: 'Harassment reports' })).status).toBe(200)
    expect((await get(notifications, '/api/v1/notifications', m)).status).toBe(401) // signed out
    expect((await POST(uStatus, `/api/v1/admin/users/${m.id}/status`, admin, { status: 'active' })).status).toBe(200)
    const other = await staffUser('auditor')
    expect((await POST(uStatus, `/api/v1/admin/users/${other.id}/status`, admin, { status: 'suspended', reason: 'x' })).status).toBe(403)
    const m2 = await member('man', ['Women'])
    expect((await POST(uSignOut, `/api/v1/admin/users/${m2.id}/sign-out`, admin)).status).toBe(200)
    expect((await get(notifications, '/api/v1/notifications', m2)).status).toBe(401)
  })
})

describe('identity checks (KYC)', () => {
  it('open a case, decide it with a note, and the member\'s verification follows', async () => {
    const officer = await staffUser('kyc_officer')
    const m = await member('man', ['Women'])
    const db = await getDb()
    await db.query('update users set identity_verified_at = null where id = $1', [m.id])
    expect((await POST(kOpen, '/api/v1/admin/kyc/cases', officer, { userId: m.id })).status).toBe(400) // needs a reason
    const opened = await j(await POST(kOpen, '/api/v1/admin/kyc/cases', officer, { userId: m.id, reason: 'Bank check failed twice' }))
    expect(opened.id).toBeTruthy()
    expect((await POST(kOpen, '/api/v1/admin/kyc/cases', officer, { userId: m.id, reason: 'again' })).status).toBe(409)
    const queue = await j(await get(kList, '/api/v1/admin/kyc', officer))
    expect(queue.counts.open).toBeGreaterThan(0)
    expect(queue.rows.some((r: any) => r.id === opened.id)).toBe(true)

    const decide = (body: unknown) => POST(kDecide, `/api/v1/admin/kyc/cases/${opened.id}/decide`, officer, body)
    expect((await decide({ decision: 'approve' })).status).toBe(400) // note
    expect((await decide({ decision: 'approve', note: 'ID seen on video call' })).status).toBe(400) // over 18 not confirmed
    expect((await decide({ decision: 'maybe', note: 'x' })).status).toBe(400)
    expect((await decide({ decision: 'approve', note: 'ID seen on video call', over18Confirmed: true })).status).toBe(200)
    expect((await db.query('select identity_verified_at from users where id = $1', [m.id])).rows[0].identity_verified_at).not.toBeNull()
    expect((await db.query(`select provider, over18 from identities where user_id = $1`, [m.id])).rows[0]).toEqual({ provider: 'manual', over18: true })
    expect((await decide({ decision: 'reject', note: 'again' })).status).toBe(409)

    // revoking takes it away again
    const second = await j(await POST(kOpen, '/api/v1/admin/kyc/cases', officer, { userId: m.id, reason: 'Fraud report' }))
    expect((await POST(kDecide, `/api/v1/admin/kyc/cases/${second.id}/decide`, officer, { decision: 'revoke', note: 'Documents did not match' })).status).toBe(200)
    expect((await db.query('select identity_verified_at from users where id = $1', [m.id])).rows[0].identity_verified_at).toBeNull()
    expect((await db.query('select 1 from identities where user_id = $1', [m.id])).rows).toHaveLength(0)
  })

  it('lists members stuck without a verification', async () => {
    const officer = await staffUser('kyc_officer')
    const m = await member('man', ['Women'])
    const db = await getDb()
    await db.query(`update users set role = 'member', identity_verified_at = null, created_at = now() - interval '3 days' where id = $1`, [m.id])
    const stuck = await j(await get(kList, '/api/v1/admin/kyc?view=stuck', officer))
    expect(stuck.rows.some((r: any) => r.id === m.id)).toBe(true)
  })
})

describe('the helpdesk', () => {
  it('a member writes in; staff answer; the thread, the notice and the deadline all work', async () => {
    const agent = await staffUser('support_agent')
    const m = await member('man', ['Women'])
    const open = (body: unknown) => openTicketRoute(req('/api/v1/support/tickets', { method: 'POST', cookie: m.cookie, body }))
    expect((await open({ category: 'nope', subject: 'Help me please', body: 'My message' })).status).toBe(400)
    expect((await open({ category: 'account', subject: 'x', body: 'My message' })).status).toBe(400)
    expect((await open({ category: 'account', subject: 'Cannot change my email', body: '' })).status).toBe(400)
    const created = await open({ category: 'account', subject: 'Cannot change my email', body: 'The button does nothing.' })
    expect(created.status).toBe(201)
    const { id, ref } = await j(created)
    expect(ref).toMatch(/^HD-\d{5}$/)

    const mine = await j(await get(myTickets, '/api/v1/support/tickets', m))
    expect(mine.tickets[0]).toMatchObject({ id, ref, status: 'open' })
    const queue = await j(await get(hList, '/api/v1/admin/support?status=active', agent))
    const row = queue.tickets.find((t: any) => t.id === id)
    expect(row).toMatchObject({ requester: m.username, priority: 'normal', breached: false, assignee: null })
    expect(queue.counts.unassigned).toBeGreaterThan(0)

    // a deadline that has passed shows up as breached
    const db = await getDb()
    await db.query(`update support_tickets set first_response_due_at = now() - interval '1 hour' where id = $1`, [id])
    expect((await j(await get(hList, '/api/v1/admin/support?breached=1', agent))).tickets.map((t: any) => t.id)).toContain(id)

    // an internal note is invisible to the member; a reply is emailed and shown in the app
    const reply = (body: unknown) => POST(hReply, `/api/v1/admin/support/${id}/reply`, agent, body)
    expect((await reply({ body: 'Checking with the team.', internal: true })).status).toBe(200)
    outbox.length = 0
    expect((await reply({ body: 'Fixed. Please try again.' })).status).toBe(200)
    expect(outbox.some((mm) => /HD-/.test(mm.subject) && mm.text.includes('Fixed. Please try again.'))).toBe(true)
    const thread = await j(await get(myTicket, `/api/v1/support/tickets/${id}`, m))
    expect(thread.messages.map((x: any) => x.body)).toEqual(['The button does nothing.', 'Fixed. Please try again.'])
    expect(thread.ticket.status).toBe('waiting_customer')
    const staffView = await j(await get(hOne, `/api/v1/admin/support/${id}`, agent))
    expect(staffView.messages).toHaveLength(3)
    expect(staffView.ticket).toMatchObject({ assignee: expect.any(String), breached: false })
    expect(staffView.ticket.first_response_at).toBeTruthy()
    expect(staffView.events.map((e: any) => e.event)).toEqual(expect.arrayContaining(['opened', 'internal_note', 'replied']))
    expect((await j(await get(notifications, '/api/v1/notifications', m))).notifications.some((x: any) => x.code === 'support_reply')).toBe(true)

    // the member answers: it comes back to the queue
    expect((await post(myReply, `/api/v1/support/tickets/${id}/reply`, m, { body: 'Works now, thank you.' })).status).toBe(200)
    expect((await j(await get(hOne, `/api/v1/admin/support/${id}`, agent))).ticket.status).toBe('open')

    // staff: priority, assignment, closing; a closed ticket takes no more replies
    const upd = (body: unknown) => POST(hUpdate, `/api/v1/admin/support/${id}/update`, agent, body)
    expect((await upd({ priority: 'urgent' })).status).toBe(200)
    expect((await upd({ priority: 'huge' })).status).toBe(400)
    expect((await upd({ assignee: 'me' })).status).toBe(200)
    expect((await upd({ assignee: agent.id })).status).toBe(200)
    expect((await upd({ assignee: '00000000-0000-0000-0000-000000000000' })).status).toBe(400)
    expect((await upd({ status: 'closed' })).status).toBe(200)
    expect((await post(myReply, `/api/v1/support/tickets/${id}/reply`, m, { body: 'One more thing' })).status).toBe(409)
  })

  it('other people cannot read or answer a ticket, and a member cannot reach the staff queue', async () => {
    const m = await member('man', ['Women'])
    const stranger = await member('woman', ['Men'])
    const { id } = await j(await openTicketRoute(req('/api/v1/support/tickets', { method: 'POST', cookie: m.cookie, body: { category: 'bug', subject: 'Something broke', body: 'Details here' } })))
    expect((await get(myTicket, `/api/v1/support/tickets/${id}`, stranger)).status).toBe(404)
    expect((await post(myReply, `/api/v1/support/tickets/${id}/reply`, stranger, { body: 'hi' })).status).toBe(404)
    expect((await get(hList, '/api/v1/admin/support', m)).status).toBe(403)
    expect((await get(myTickets, '/api/v1/support/tickets', stranger).then(j)).tickets).toHaveLength(0)
  })

  it('a venue writes in from its portal and is marked as a partner', async () => {
    const agent = await staffUser('support_agent')
    const p = await partnerFor('kaffa-roastery')
    const res = await openTicketRoute(req('/api/v1/support/tickets', { method: 'POST', cookie: p.cookie, body: { category: 'venue', subject: 'SMS alerts not arriving', body: 'We changed our number.' } }))
    expect(res.status).toBe(201)
    const t = (await j(await get(hList, '/api/v1/admin/support?q=sms', agent))).tickets[0]
    expect(t).toMatchObject({ requester_kind: 'partner', source: 'portal' })
    const detail = await j(await get(hOne, `/api/v1/admin/support/${t.id}`, agent))
    expect(detail.ticket.venue).toBe('Kaffa Roastery')
  })

  it('a safety concern raised after a date opens an urgent ticket with the booking attached', async () => {
    const agent = await staffUser('support_agent')
    const m = await matched()
    const opts = freshOptions('kaffa-roastery')
    await post(sendOptions, `/api/v1/bookings/${m.bookingId}/options`, m.a, { options: opts })
    const view = async () => (await j(await get(getBooking, `/api/v1/bookings/${m.bookingId}`, m.b))).booking
    await post(pick, `/api/v1/bookings/${m.bookingId}/pick`, m.b, { optionId: (await view()).options[0].id })
    await post(confirm, `/api/v1/bookings/${m.bookingId}/confirm`, m.a)
    const partner = await partnerFor('kaffa-roastery')
    await post(pConfirm, `/api/v1/partner/bookings/${m.bookingId}/confirm`, partner)
    expect((await post(report, `/api/v1/bookings/${m.bookingId}/report`, m.b, { category: 'felt_unsafe', details: 'They would not leave me alone' })).status).toBe(200)
    const t = (await j(await get(hList, '/api/v1/admin/support?priority=urgent', agent))).tickets.find((x: any) => x.source === 'report')
    expect(t).toMatchObject({ priority: 'urgent', category: 'safety', requester: m.b.username })
    const detail = await j(await get(hOne, `/api/v1/admin/support/${t.id}`, agent))
    expect(detail.ticket.booking_ref).toMatch(/^CM-/)
    expect(detail.messages[0].body).toContain('felt unsafe')
  })
})

describe('the activity log and the data browser', () => {
  it('records what staff do, and only roles with audit.read can see it', async () => {
    const admin = await staffUser('admin')
    const auditor = await staffUser('auditor')
    const m = await member('man', ['Women'])
    await POST(uStatus, `/api/v1/admin/users/${m.id}/status`, admin, { status: 'suspended', reason: 'Test reason' })
    await POST(sInvite, '/api/v1/admin/staff/invite', null, { email: `log${++n}@choicemi.test`, role: 'moderator' })
    expect((await get(aLog, '/api/v1/admin/audit', admin)).status).toBe(200) // admin holds audit.read too
    const log = await j(await get(aLog, `/api/v1/admin/audit?action=user.`, auditor))
    const e = log.entries.find((x: any) => x.action === 'user.suspended' && x.target_id === m.id)
    expect(e).toBeTruthy()
    expect(e.actor_label).toBeTruthy()
    expect(e.meta).toEqual({ reason: 'Test reason' })
    const byToken = (await j(await get(aLog, '/api/v1/admin/audit?action=staff.invited', auditor))).entries
    expect(byToken[0].actor_label).toBe('admin token')
    const agent = await staffUser('support_agent')
    expect((await get(aLog, '/api/v1/admin/audit', agent)).status).toBe(403)
  })

  it('lets the right roles browse tables, with secrets hidden', async () => {
    const auditor = await staffUser('auditor')
    const agent = await staffUser('support_agent')
    const tables = await j(await get(dTables, '/api/v1/admin/data', auditor))
    expect(tables.tables.map((t: any) => t.name)).toEqual(expect.arrayContaining(['users', 'bookings', 'venues', 'support_tickets', 'audit_log']))
    expect(tables.tables.map((t: any) => t.name)).not.toContain('rate_limits')
    const users = await j(await get(dTable, '/api/v1/admin/data/users?limit=5', auditor))
    expect(users.rows.length).toBeGreaterThan(0)
    expect(users.columns.find((c: any) => c.name === 'password_hash').hidden).toBe(true)
    expect(users.rows.every((r: any) => r.password_hash === '••••')).toBe(true)
    expect((await get(dTable, '/api/v1/admin/data/nope', auditor)).status).toBe(404)
    expect((await get(dTable, '/api/v1/admin/data/users;drop', auditor)).status).toBe(404)
    expect((await get(dTable, '/api/v1/admin/data/users', agent)).status).toBe(403)
    const guests = await j(await get(dTable, '/api/v1/admin/data/booking_guests', auditor))
    expect(guests.columns.find((c: any) => c.name === 'qr_nonce').hidden).toBe(true)
  })
})
