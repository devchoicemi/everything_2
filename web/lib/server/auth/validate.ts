import { ApiError } from './http'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Passwords that are on every attacker's first list. Length is the main rule; this just catches the worst. */
const COMMON = new Set([
  'password1234',
  '1234567890',
  '12345678910',
  'qwertyuiop',
  'qwerty123456',
  'password123',
  'letmein1234',
  'iloveyou123',
  'welcome1234',
  'abcdefghij',
  'choicemi123',
  'choicemi2026',
])

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_email', 'Enter a valid email address.', { email: 'Enter a valid email address.' })
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'invalid_email', 'Enter a valid email address.', { email: 'Enter a valid email address.' })
  }
  return email
}

export function checkNewPassword(value: unknown, email?: string): string {
  const fail = (message: string) => new ApiError(400, 'weak_password', message, { password: message })
  if (typeof value !== 'string') throw fail('Enter a password.')
  if (value.length < 10) throw fail('Use at least 10 characters.')
  if (value.length > 128) throw fail('Use 128 characters or fewer.')
  const lower = value.toLowerCase()
  if (COMMON.has(lower) || /^(.)\1+$/.test(value)) throw fail('That password is too easy to guess. Try a short phrase instead.')
  if (email && (lower === email || lower.includes(email.split('@')[0]) && email.split('@')[0].length >= 6)) {
    throw fail('Your password should not contain your email address.')
  }
  return value
}

export function requireString(value: unknown, name: string, max = 512): string {
  if (typeof value !== 'string' || !value || value.length > max) {
    throw new ApiError(400, 'invalid_request', `Missing ${name}.`)
  }
  return value
}
