import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'

/**
 * A software passkey for tests: makes the same registration and sign-in answers a real
 * device would (ES256, "none" attestation, user verification on), so the server's real
 * WebAuthn checks run against them. Not used by the app.
 */

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url')
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest()

function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n])
  if (n < 256) return Buffer.from([(major << 5) | 24, n])
  return Buffer.from([(major << 5) | 25, n >> 8, n & 255])
}

type Cbor = number | string | Buffer | Map<Cbor, Cbor>

function cbor(v: Cbor): Buffer {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v)
  if (typeof v === 'string') {
    const b = Buffer.from(v, 'utf8')
    return Buffer.concat([head(3, b.length), b])
  }
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v])
  const parts: Buffer[] = [head(5, v.size)]
  for (const [k, val] of v) parts.push(cbor(k), cbor(val))
  return Buffer.concat(parts)
}

export class VirtualAuthenticator {
  readonly credentialId = randomBytes(32)
  private privateKey: KeyObject
  private x: Buffer
  private y: Buffer
  counter = 0

  constructor(
    private rpID: string,
    private origin: string,
    private userHandle: string,
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    this.privateKey = privateKey
    const jwk = publicKey.export({ format: 'jwk' })
    this.x = Buffer.from(jwk.x!, 'base64url')
    this.y = Buffer.from(jwk.y!, 'base64url')
  }

  get id() {
    return b64u(this.credentialId)
  }

  private clientData(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin = this.origin) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }))
  }

  /** The answer to the server's registration options. */
  register(options: { challenge: string }, opts: { userVerified?: boolean; origin?: string } = {}) {
    const cose = new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, this.x], [-3, this.y]])
    const flags = 0x01 | (opts.userVerified === false ? 0 : 0x04) | 0x40 // present, verified, attested data included
    const counter = Buffer.alloc(4)
    const idLen = Buffer.alloc(2)
    idLen.writeUInt16BE(this.credentialId.length)
    const authData = Buffer.concat([sha256(this.rpID), Buffer.from([flags]), counter, Buffer.alloc(16), idLen, this.credentialId, cbor(cose)])
    const attestationObject = cbor(new Map<Cbor, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64u(this.clientData('webauthn.create', options.challenge, opts.origin)),
        attestationObject: b64u(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    }
  }

  /** The answer to the server's sign-in options. */
  assert(options: { challenge: string }, opts: { userVerified?: boolean; origin?: string; credentialId?: string; replayCounter?: boolean } = {}) {
    if (!opts.replayCounter) this.counter += 1
    const flags = 0x01 | (opts.userVerified === false ? 0 : 0x04)
    const counter = Buffer.alloc(4)
    counter.writeUInt32BE(this.counter)
    const authData = Buffer.concat([sha256(this.rpID), Buffer.from([flags]), counter])
    const clientDataJSON = this.clientData('webauthn.get', options.challenge, opts.origin)
    const signature = sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), { key: this.privateKey, dsaEncoding: 'der' })
    const id = opts.credentialId ?? this.id
    return {
      id,
      rawId: id,
      type: 'public-key',
      response: {
        clientDataJSON: b64u(clientDataJSON),
        authenticatorData: b64u(authData),
        signature: b64u(signature),
        userHandle: b64u(Buffer.from(this.userHandle)),
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    }
  }
}
