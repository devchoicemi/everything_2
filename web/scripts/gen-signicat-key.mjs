// Generates the RSA key pair used to encrypt Signicat ID tokens (JWK, RSA-OAEP, 3072-bit).
//   node scripts/gen-signicat-key.mjs [output-folder]      (default: ~/choicemi-signicat-keys)
//
// Writes two files and prints only the PUBLIC key:
//   choicemi-signicat-public.jwk.json   upload to Signicat: client > Advanced > Public keys (Usage: Encryption)
//   choicemi-signicat-private.jwk.json  SECRET. Goes only on the server (SIGNICAT_ENC_PRIVATE_JWK). Never commit or share it.
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { exportJWK, generateKeyPair } from 'jose'

const dir = path.resolve(process.argv[2] ?? path.join(homedir(), 'choicemi-signicat-keys'))
mkdirSync(dir, { recursive: true })

const { publicKey, privateKey } = await generateKeyPair('RSA-OAEP', { modulusLength: 3072, extractable: true })
const kid = `choicemi-enc-${new Date().toISOString().slice(0, 10)}`
const pub = { ...(await exportJWK(publicKey)), kid, alg: 'RSA-OAEP', use: 'enc' }
const prv = { ...(await exportJWK(privateKey)), kid, alg: 'RSA-OAEP', use: 'enc' }

const pubFile = path.join(dir, 'choicemi-signicat-public.jwk.json')
const prvFile = path.join(dir, 'choicemi-signicat-private.jwk.json')
writeFileSync(pubFile, JSON.stringify(pub, null, 2))
writeFileSync(prvFile, JSON.stringify(prv), { mode: 0o600 })
try {
  chmodSync(prvFile, 0o600)
} catch {
  // Windows ignores POSIX modes; the folder lives in your own profile.
}

console.log(`Public key file : ${pubFile}`)
console.log(`Private key file: ${prvFile}   (secret: back it up in your password manager, never share it)\n`)
console.log('--- PUBLIC key (safe to paste into Signicat) ---')
console.log(JSON.stringify(pub, null, 2))
