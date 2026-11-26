/**
 * Text messages (SMS), for venue booking alerts and for checking a venue's phone number.
 *
 * - SMS_PROVIDER=46elks (ELKS_USERNAME, ELKS_PASSWORD) or twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
 *   with SMS_FROM as the sender name or number.
 * - Outside production nothing is sent: messages are kept in `smsOutbox` and printed, so tests can read the codes.
 * - In production with no provider configured the message is logged as NOT SENT (without its content) and
 *   `false` is returned, so callers can tell the person.
 */
export interface Sms {
  to: string
  text: string
}

export const smsOutbox: Sms[] = []

export type SmsProvider = '46elks' | 'twilio'

export function smsProvider(): SmsProvider | null {
  const want = process.env.SMS_PROVIDER?.trim().toLowerCase()
  const from = process.env.SMS_FROM?.trim()
  if (!from) return null
  if (want === '46elks' && process.env.ELKS_USERNAME && process.env.ELKS_PASSWORD) return '46elks'
  if (want === 'twilio' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio'
  return null
}

export const smsConfigured = () => smsProvider() !== null

/** International format only: +358401234567. Returns the cleaned number or null. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\s()-]/g, '')
  return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null
}

export async function sendSms(sms: Sms): Promise<boolean> {
  const provider = smsProvider()
  const from = (process.env.SMS_FROM ?? '').trim()
  try {
    if (provider === '46elks') {
      const res = await fetch('https://api.46elks.com/a1/sms', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${process.env.ELKS_USERNAME}:${process.env.ELKS_PASSWORD}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ from, to: sms.to, message: sms.text }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) console.error('[sms] 46elks rejected the message', res.status)
      return res.ok
    }
    if (provider === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID!
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: sms.to, Body: sms.text }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) console.error('[sms] Twilio rejected the message', res.status)
      return res.ok
    }
  } catch (e) {
    console.error('[sms] send failed', (e as Error).message)
    return false
  }
  if (process.env.NODE_ENV !== 'production') {
    smsOutbox.push(sms)
    if (smsOutbox.length > 50) smsOutbox.shift()
    console.log(`[sms:dev] to ${sms.to}: ${sms.text}`)
    return true
  }
  console.warn('[sms] NOT SENT (no provider configured)')
  return false
}
