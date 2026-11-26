/* ============================================================================
   Client for the auth API (/api/v1/auth/*). Real server calls only; the offline
   Android build has no server, so it gets a signed-in demo session instead.
   ========================================================================== */

export interface AuthUser {
  id: string
  email: string
  /** the anonymous handle other members see */
  username: string
  role: 'member' | 'partner' | 'admin' | 'tester'
  emailVerified: boolean
  identityVerified: boolean
  onboarded: boolean
  createdAt: string
}

export type NextStep = 'verify_email' | 'verify_identity' | 'prelaunch' | 'continue'

export interface SessionState {
  authenticated: boolean
  user?: AuthUser
  next?: NextStep
  requirements: { emailVerification: boolean; identity: boolean }
  config?: { identityProvider: 'signicat' | 'mock' | null; emailDelivery: boolean; signupMode: 'invite' | 'open'; launched: boolean }
  /** how this account signs in: test accounts are exempt from codes and passkeys */
  security?: { exempt: boolean; loginCode: boolean; passkeys: number; suggestPasskey: boolean }
}

/** The answer to a correct password when a code has been emailed: nothing is signed in yet. */
export interface OtpChallenge {
  otpRequired: true
  challenge: string
  emailHint: string
}

export interface PasskeyInfo {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  backedUp: boolean
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

const STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === '1'

export async function apiCall<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
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
    throw new AuthError('Could not reach ChoiceMi. Check your connection and try again.', 'network', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = data?.error ?? {}
    throw new AuthError(e.message ?? 'Something went wrong. Please try again.', e.code ?? 'error', res.status, e.fields)
  }
  return data as T
}

const DEMO: SessionState = {
  authenticated: true,
  next: 'continue',
  requirements: { emailVerification: false, identity: false },
  config: { identityProvider: null, emailDelivery: false, signupMode: 'open', launched: true },
  user: {
    id: 'demo',
    email: 'demo@choicemi.app',
    username: 'Birch_Storm',
    role: 'member',
    emailVerified: true,
    identityVerified: true,
    onboarded: true,
    createdAt: new Date(0).toISOString(),
  },
}

export const auth = {
  session: (): Promise<SessionState> => (STANDALONE ? Promise.resolve(DEMO) : apiCall('/auth/session')),

  signUp: (input: { email: string; password: string; acceptTerms: boolean; over18: boolean; inviteToken?: string }) =>
    apiCall<SessionState>('/auth/signup', { body: input }),

  /** A signed-in session, or a challenge to answer with the emailed code (see logInWithCode). */
  logIn: (input: { email: string; password: string }) => apiCall<SessionState | OtpChallenge>('/auth/login', { body: input }),

  logInWithCode: (challenge: string, code: string) => apiCall<SessionState>('/auth/login/verify', { body: { challenge, code } }),

  resendLoginCode: (challenge: string) => apiCall<{ ok: true }>('/auth/login/resend', { body: { challenge } }),

  checkInvite: (token: string) => apiCall<{ valid: boolean; email?: string }>(`/invites/check?token=${encodeURIComponent(token)}`),

  logOut: () => apiCall<{ ok: true }>('/auth/logout', { body: {} }),

  unsubscribeWaitlist: (email: string, token: string) => apiCall<{ ok: true }>('/waitlist/unsubscribe', { body: { email, token } }),

  forgotPassword: (email: string) => apiCall<{ ok: true }>('/auth/password/forgot', { body: { email } }),

  resetPassword: (token: string, password: string) =>
    apiCall<{ ok: true }>('/auth/password/reset', { body: { token, password } }),

  verifyEmail: (token: string) => apiCall<{ ok: true }>('/auth/email/verify', { body: { token } }),

  /** Confirms the email with the 6-digit code from the message (signed-in members). */
  verifyEmailCode: (code: string) => apiCall<{ ok: true }>('/auth/email/verify', { body: { code } }),

  resendVerification: () => apiCall<{ ok: true }>('/auth/email/resend', { body: {} }),

  passkeys: () => apiCall<{ passkeys: PasskeyInfo[] }>('/auth/passkeys'),

  /** "Not now" on the passkey suggestion: it stays away for a week. */
  snoozePasskeyPrompt: () => apiCall<{ ok: true }>('/auth/passkeys/snooze', { body: {} }),

  removePasskey: (id: string) => apiCall<{ ok: true }>(`/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Starts identity verification; returns the URL to send the browser to. */
  startIdentity: (returnTo = '/onboarding?step=1') =>
    apiCall<{ authorizeUrl: string }>('/auth/signicat/start', { body: { returnTo } }),
}

/**
 * Where a signed-in member should go next. Members who have not finished profile setup always
 * go to onboarding; everyone else goes where they were heading, or to Discover.
 */
export function destinationFor(s: SessionState, requested?: string | null): string {
  if (s.next === 'verify_email') return '/verify-email'
  if (s.next === 'verify_identity') return '/verify'
  if (s.next === 'prelaunch') return '/you-are-in'
  const safe = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : null
  if (s.user && !s.user.onboarded) return safe?.startsWith('/onboarding') ? safe : '/onboarding?step=1'
  return safe && !safe.startsWith('/onboarding') && !safe.startsWith('/verify') ? safe : '/discover'
}
