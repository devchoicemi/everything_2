/** Calls the ChoiceMi API (/api/v1/...) on this same address. Cookies carry the sign-in. */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('Could not reach ChoiceMi. Check your connection and try again.', 'network', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; fields?: Record<string, string> } }).error ?? {}
    throw new ApiError(e.message ?? 'Something went wrong. Please try again.', e.code ?? 'error', res.status, e.fields)
  }
  return data as T
}

export const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

/* ----------------------------------- types ---------------------------------- */

export type Permission =
  | 'staff.manage'
  | 'users.read'
  | 'users.manage'
  | 'kyc.read'
  | 'kyc.decide'
  | 'support.read'
  | 'support.reply'
  | 'venues.review'
  | 'bookings.read'
  | 'bookings.manage'
  | 'moderation.manage'
  | 'audit.read'
  | 'data.read'

export type StaffRole = 'super_admin' | 'admin' | 'support_agent' | 'kyc_officer' | 'partner_manager' | 'moderator' | 'auditor'

export interface SessionUser {
  id: string
  email: string
  username: string
  role: 'member' | 'partner' | 'admin' | 'tester'
  emailVerified: boolean
}

export interface SessionState {
  authenticated: boolean
  user?: SessionUser
  next?: 'verify_email' | 'verify_identity' | 'prelaunch' | 'continue'
}

export interface Me {
  userId: string | null
  email: string | null
  username: string
  role: StaffRole
  roleLabel: string
  permissions: Permission[]
}

export interface Summary {
  counts: { submitted: number; requested: number; stalled: number; reports: number; comments: number; no_shows7: number; late7: number }
  alerts: { id: string; code: string; title: string; body: string; created_at: string; read_at: string | null }[]
}
