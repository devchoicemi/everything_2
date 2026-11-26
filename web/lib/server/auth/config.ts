/** Auth configuration, read from the environment at call time (so tests can change it). */

export const isProd = () => process.env.NODE_ENV === 'production'

export const COOKIE_NAME = 'cm_auth'
export const SESSION_DAYS = 30
export const TERMS_VERSION = '2026-10'

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? '').trim().replace(/\/+$/, '')
}

/** Where the restaurant partner site lives. Links in emails to venue staff point here. */
export function partnerBaseUrl(): string {
  const set = (process.env.PARTNER_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (set) return set
  return isProd() ? 'https://restaurant.choicemi.com' : 'http://localhost:3200'
}

/** Where ChoiceMi's own staff sign in. Links in staff invitations point here. */
export function adminBaseUrl(): string {
  const set = (process.env.ADMIN_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (set) return set
  return isProd() ? 'https://admin.choicemi.com' : 'http://localhost:3300'
}

export function cookieSecure(): boolean {
  const base = appBaseUrl()
  return base ? base.startsWith('https://') : isProd()
}

export type MailProvider = 'ahasend' | 'resend'

const has = (name: string) => Boolean(process.env[name]?.trim())

/**
 * Which email service sends our mail. Set MAIL_PROVIDER=ahasend or resend to choose;
 * otherwise AhaSend is used when its key and account id are set, else Resend when its key is set.
 * Returns null when no provider is fully configured (MAIL_FROM is always required).
 */
export function mailProvider(): MailProvider | null {
  if (!has('MAIL_FROM')) return null
  const ahasend = has('AHASEND_API_KEY') && has('AHASEND_ACCOUNT_ID')
  const resend = has('RESEND_API_KEY')
  const wanted = process.env.MAIL_PROVIDER?.trim().toLowerCase()
  if (wanted === 'ahasend') return ahasend ? 'ahasend' : null
  if (wanted === 'resend') return resend ? 'resend' : null
  return ahasend ? 'ahasend' : resend ? 'resend' : null
}

export function mailConfigured(): boolean {
  return mailProvider() !== null
}

/** Splits MAIL_FROM ("ChoiceMi <no-reply@choicemi.com>" or a bare address) into name and email. */
export function mailFrom(): { name?: string; email: string } {
  const raw = (process.env.MAIL_FROM ?? '').trim()
  const m = /^(.*?)\s*<([^>]+)>$/.exec(raw)
  if (m) return { name: m[1].replace(/^["']|["']$/g, '').trim() || undefined, email: m[2].trim() }
  return { email: raw }
}

export function signicatConfigured(): boolean {
  return Boolean(
    process.env.SIGNICAT_DOMAIN?.trim() &&
      process.env.SIGNICAT_CLIENT_ID?.trim() &&
      process.env.SIGNICAT_CLIENT_SECRET?.trim(),
  )
}

/** Development-only stand-in for Signicat. Can never be switched on in production. */
export function signicatMock(): boolean {
  return !isProd() && process.env.SIGNICAT_MOCK === '1'
}

/**
 * What a member must complete before using the app.
 * - Email confirmation is required as soon as an email provider is configured.
 * - Identity verification is required as soon as Signicat is configured,
 *   or when REQUIRE_IDENTITY=1.
 * Until those connectors are added, the gates stay open so sign-up is usable.
 */
export function requirements() {
  return {
    emailVerification: process.env.REQUIRE_EMAIL_VERIFICATION
      ? process.env.REQUIRE_EMAIL_VERIFICATION === '1'
      : mailConfigured(),
    identity: process.env.REQUIRE_IDENTITY
      ? process.env.REQUIRE_IDENTITY === '1'
      : signicatConfigured() || signicatMock(),
  }
}

/** `invite` (default): an emailed invitation is needed to create an account. `open`: anyone can. */
export function signupMode(): 'invite' | 'open' {
  return process.env.SIGNUP_MODE === 'open' ? 'open' : 'invite'
}

export const INVITE_TTL_DAYS = 14

/** Bearer token for the admin API. Must be a long random value; otherwise the admin API is switched off. */
export function adminToken(): string | null {
  const t = process.env.ADMIN_TOKEN?.trim()
  return t && t.length >= 32 ? t : null
}

/** True when an email can really go out (production) or be captured (development and tests). */
export function canSendMail(): boolean {
  return mailConfigured() || !isProd()
}

/** Secret used to sign unsubscribe links. */
export function linkSecret(): string {
  return process.env.SESSION_SECRET?.trim() || (isProd() ? '' : 'dev-only-link-secret')
}

/**
 * Pre-launch switch. Until APP_LAUNCHED=1, signed-up members who have finished their
 * checks only see a "you are in, we will email you" screen. Admins are exempt so the
 * team can test. Set APP_LAUNCHED=1 in .env and run ./deploy.sh to open the app.
 */
export function appLaunched(): boolean {
  return process.env.APP_LAUNCHED === '1'
}
