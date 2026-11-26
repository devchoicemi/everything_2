import { getDb, type Queryable } from '../db'
import { ApiError, clientIp } from '../auth/http'
import { adminToken } from '../auth/config'
import { safeEqual } from '../auth/crypto'
import { rateLimit } from '../auth/rateLimit'
import { getAuth, type PublicUser } from '../auth/service'

/**
 * Who on ChoiceMi's team can do what. A staff account has one role; each role holds a fixed list of
 * permissions, and every admin endpoint asks for the one permission it needs. The same permissions decide
 * what the staff site shows, so a person only ever sees the parts they can use.
 */
export const PERMISSIONS = [
  'staff.manage', // invite staff, change roles, switch accounts off
  'users.read', // find members and partners, see account status
  'users.manage', // suspend, reactivate, sign out everywhere
  'kyc.read', // see identity-check results
  'kyc.decide', // approve, reject or revoke an identity check
  'support.read', // see tickets
  'support.reply', // answer, assign, close tickets
  'venues.review', // review venue applications and approve them
  'bookings.read', // the booking log
  'bookings.manage', // move a stuck booking along
  'moderation.manage', // comments, reports, no-shows
  'audit.read', // the staff activity log
  'data.read', // browse the database (read only, sensitive columns hidden)
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const STAFF_ROLES = ['super_admin', 'admin', 'support_agent', 'kyc_officer', 'partner_manager', 'moderator', 'auditor'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  support_agent: 'Support agent',
  kyc_officer: 'KYC officer',
  partner_manager: 'Partner manager',
  moderator: 'Moderator',
  auditor: 'Auditor',
}

export const ROLE_SUMMARY: Record<StaffRole, string> = {
  super_admin: 'Everything, including who is on the team and what they may do.',
  admin: 'Everything except managing the team.',
  support_agent: 'Answers the helpdesk and looks up accounts and bookings.',
  kyc_officer: 'Reviews and decides identity checks.',
  partner_manager: 'Reviews restaurant applications and watches bookings.',
  moderator: 'Checks comments, concerns and no-shows.',
  auditor: 'Read-only view of everything, including the activity log.',
}

const ALL = [...PERMISSIONS]
const READ_ALL: Permission[] = ['users.read', 'kyc.read', 'support.read', 'bookings.read', 'audit.read', 'data.read']

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  super_admin: ALL,
  admin: ALL.filter((p) => p !== 'staff.manage'),
  support_agent: ['users.read', 'support.read', 'support.reply', 'bookings.read'],
  kyc_officer: ['users.read', 'kyc.read', 'kyc.decide', 'support.read'],
  partner_manager: ['users.read', 'venues.review', 'bookings.read', 'support.read', 'support.reply'],
  moderator: ['users.read', 'bookings.read', 'moderation.manage', 'support.read'],
  auditor: READ_ALL,
}

export interface StaffContext {
  /** null when the call used the server's admin token (the command-line tools) */
  userId: string | null
  user: PublicUser | null
  role: StaffRole
  permissions: Permission[]
  label: string
  can(p: Permission): boolean
}

function context(userId: string | null, user: PublicUser | null, role: StaffRole, label: string): StaffContext {
  const permissions = [...ROLE_PERMISSIONS[role]]
  const set = new Set<Permission>(permissions)
  return { userId, user, role, permissions, label, can: (p) => set.has(p) }
}

/** Resolves who is calling. Throws unless it is an active member of staff (or the server's admin token). */
export async function staffFromRequest(req: Request): Promise<StaffContext> {
  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Bearer ')) {
    const expected = adminToken()
    if (!expected) throw new ApiError(503, 'admin_disabled', 'The admin API is not switched on.')
    await rateLimit('admin-ip', clientIp(req), 120, 900)
    if (!safeEqual(header.slice(7).trim(), expected)) throw new ApiError(401, 'unauthorized', 'Not authorised.')
    return context(null, null, 'super_admin', 'admin token')
  }
  const auth = await getAuth(req)
  if (!auth) throw new ApiError(401, 'unauthenticated', 'Please sign in.')
  if (auth.user.role !== 'admin') throw new ApiError(403, 'not_staff', 'This is for ChoiceMi staff.')
  const db = await getDb()
  const row = (await db.query<{ role: StaffRole; active: boolean }>('select role, active from staff where user_id = $1', [auth.user.id])).rows[0]
  if (!row || !row.active) throw new ApiError(403, 'not_staff', 'Your staff access is switched off. Ask a super admin.')
  return context(auth.user.id, auth.user, row.role, auth.user.username)
}

/** The guard every admin endpoint starts with. */
export async function requireStaff(req: Request, permission?: Permission): Promise<StaffContext> {
  const ctx = await staffFromRequest(req)
  if (permission && !ctx.can(permission)) throw new ApiError(403, 'forbidden', 'Your role does not include this.')
  return ctx
}

/** Records something staff did. Always called inside the same transaction as the change itself. */
export async function audit(q: Queryable, ctx: StaffContext, req: Request, action: string, target?: { type: string; id: string }, meta?: Record<string, unknown>): Promise<void> {
  await q.query('insert into audit_log (actor_id, actor_label, action, target_type, target_id, meta, ip) values ($1, $2, $3, $4, $5, $6::jsonb, $7)', [
    ctx.userId,
    ctx.label,
    action,
    target?.type ?? null,
    target?.id ?? null,
    meta ? JSON.stringify(meta) : null,
    clientIp(req),
  ])
}

/** What the staff site needs to draw itself: who this is and what they may open. */
export function describeStaff(ctx: StaffContext) {
  return {
    userId: ctx.userId,
    email: ctx.user?.email ?? null,
    username: ctx.user?.username ?? ctx.label,
    role: ctx.role,
    roleLabel: ROLE_LABEL[ctx.role],
    permissions: ctx.permissions,
  }
}
