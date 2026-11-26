import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/* ------------------------------ passwords ------------------------------ */

// scrypt (memory-hard, built into Node, no native modules to break the Alpine image).
// N=2^15, r=8, p=1 ≈ 32 MiB and ~70 ms per hash.
const N = 1 << 15
const R = 8
const P = 1
const KEYLEN = 32
const MAXMEM = 128 * N * R * 2

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r, p, maxmem: MAXMEM }
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize('NFKC'), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, N, R, P, KEYLEN)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const got = await scrypt(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p), expected.length)
  return got.length === expected.length && timingSafeEqual(got, expected)
}

let dummy: Promise<string> | undefined
/** Verifies against a throwaway hash so "no such user" takes as long as "wrong password". */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword('not-a-real-password')
  await verifyPassword(password, await dummy)
}

/* ------------------------------- tokens -------------------------------- */

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Stateless signature for links in emails (unsubscribe), so no token has to be stored. */
export function signValue(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}
