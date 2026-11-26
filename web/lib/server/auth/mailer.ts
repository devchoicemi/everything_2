import { randomUUID } from 'node:crypto'
import { adminBaseUrl, appBaseUrl, isProd, linkSecret, mailFrom, mailProvider, partnerBaseUrl } from './config'
import { signValue } from './crypto'

export interface Mail {
  to: string
  subject: string
  text: string
  html?: string
  /** Extra headers, e.g. List-Unsubscribe for marketing-style mail. */
  headers?: Record<string, string>
}

/** Messages "sent" outside production, so tests (and you, in dev) can read the links. */
export const outbox: Mail[] = []

/**
 * Sends one email and reports whether it was accepted for delivery.
 * - With a provider configured (AhaSend or Resend, see mailProvider()): sent through its HTTP API.
 * - Otherwise outside production: kept in `outbox` and printed to the console.
 * - Otherwise in production: logged as NOT SENT (without the link, which is a secret) and false.
 * Swapping provider means changing only this function.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const provider = mailProvider()
  if (provider === 'ahasend') return sendViaAhaSend(mail)
  if (provider === 'resend') return sendViaResend(mail)
  if (!isProd()) {
    outbox.push(mail)
    if (outbox.length > 50) outbox.shift()
    console.log(`[mail:dev] to ${mail.to} — ${mail.subject}\n${mail.text}\n`)
    return true
  }
  console.warn(`[mail] NOT SENT (no provider configured): "${mail.subject}"`)
  return false
}

/** AhaSend API v2: POST /v2/accounts/{account_id}/messages. 202 with a per-recipient status. */
async function sendViaAhaSend(mail: Mail): Promise<boolean> {
  try {
    const base = (process.env.AHASEND_API_URL?.trim() || 'https://api.ahasend.com').replace(/\/+$/, '')
    const res = await fetch(`${base}/v2/accounts/${encodeURIComponent(process.env.AHASEND_ACCOUNT_ID!.trim())}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AHASEND_API_KEY!.trim()}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from: mailFrom(),
        recipients: [{ email: mail.to }],
        subject: mail.subject,
        text_content: mail.text,
        html_content: mail.html,
        headers: mail.headers,
        // Links in these emails carry one-time tokens, and our privacy policy promises no tracking.
        tracking: { open: false, click: false },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await res.json().catch(() => ({}))) as { message?: string; data?: { status?: string; error?: string | null }[] }
    if (res.status !== 202 && !res.ok) {
      console.error('[mail] AhaSend rejected the message', res.status, (body.message ?? '').slice(0, 300))
      return false
    }
    const first = body.data?.[0]
    if (first && first.status === 'error') {
      console.error('[mail] AhaSend could not queue the message', (first.error ?? '').slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('[mail] AhaSend send failed', (e as Error).message)
    return false
  }
}

/** Resend: POST /emails. */
async function sendViaResend(mail: Mail): Promise<boolean> {
  try {
    const from = mailFrom()
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from.name ? `${from.name} <${from.email}>` : from.email,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mail.headers,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error('[mail] Resend rejected the message', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('[mail] Resend send failed', (e as Error).message)
    return false
  }
}

const base = () => appBaseUrl() || 'http://localhost:3000'
const link = (path: string, site: string = base()) => `${site}${path}`

/* ------------------------------ unsubscribe ------------------------------ */

export function unsubscribeToken(email: string): string {
  return signValue(linkSecret(), `unsubscribe:${email}`)
}

export function unsubscribeUrl(email: string): string {
  return link(`/waitlist/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`)
}

const marketingHeaders = (email: string) => ({
  'List-Unsubscribe': `<${unsubscribeUrl(email)}>`,
})

/* -------------------------------- layout --------------------------------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function layout(opts: { heading: string; paragraphs: string[]; code?: string; cta?: { label: string; url: string }; footer: string }): string {
  const ps = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#3b2d5c">${esc(p)}</p>`).join('')
  const code = opts.code ? codeBlock(opts.code) : ''
  const cta = opts.cta
    ? `<p style="margin:26px 0"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:linear-gradient(90deg,#6d28d9,#c026d3,#ec4899);background-color:#c026d3;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px">${esc(opts.cta.label)}</a></p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f6f1ff;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ff;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px 28px">
<tr><td>
<div style="font-size:22px;font-weight:800;color:#6d28d9;margin-bottom:18px">ChoiceMi</div>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#1f1238">${esc(opts.heading)}</h1>
${ps}${code}${cta}
<p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:#8b7fa8">${opts.footer}</p>
</td></tr></table></td></tr></table></body></html>`
}

/* -------------------------------- messages -------------------------------- */

/** A big, readable code block for the HTML emails. */
const codeBlock = (code: string) =>
  `<p style="margin:18px 0;text-align:center;font-size:34px;letter-spacing:10px;font-weight:700;color:#1f1238;font-family:Menlo,Consolas,monospace">${esc(code)}</p>`

export function verifyEmailMail(to: string, token: string, code?: string, site?: string): Mail {
  const url = link(`/verify-email?token=${token}`, site)
  return {
    to,
    subject: code ? `${code} is your ChoiceMi code` : 'Confirm your email for ChoiceMi',
    text:
      `Welcome to ChoiceMi.\n\n` +
      (code ? `Your code to confirm your email: ${code}\n\nOr open this link instead:\n${url}\n\nThe code works for 10 minutes; the link for 24 hours.` : `Confirm your email address:\n${url}\n\nThe link works for 24 hours.`) +
      ` If you did not create an account, ignore this message.`,
    html: layout({
      heading: 'Confirm your email',
      paragraphs: [
        code ? 'Welcome to ChoiceMi. Enter this code to confirm your email address. It works for 10 minutes.' : 'Welcome to ChoiceMi. Confirm your email address to continue. The link works for 24 hours.',
        ...(code ? ['You can also use the button below instead (it works for 24 hours).'] : []),
      ],
      code,
      cta: { label: 'Confirm email', url },
      footer: 'If you did not create an account, ignore this message.',
    }),
  }
}

export function loginCodeMail(to: string, code: string): Mail {
  return {
    to,
    subject: `${code} is your ChoiceMi sign-in code`,
    text: `Your ChoiceMi sign-in code: ${code}\n\nIt works for 10 minutes. If you did not just try to sign in, someone may know your password: change it, and do not share this code with anyone.`,
    html: layout({
      heading: 'Your sign-in code',
      paragraphs: ['Enter this code to finish signing in to ChoiceMi. It works for 10 minutes.'],
      code,
      footer: 'If you did not just try to sign in, someone may know your password. Change it, and never share this code with anyone.',
    }),
  }
}

export function resetPasswordMail(to: string, token: string, site?: string): Mail {
  const url = link(`/reset-password?token=${token}`, site)
  return {
    to,
    subject: 'Reset your ChoiceMi password',
    text: `Someone asked to reset the password for this ChoiceMi account.\n\nChoose a new password:\n${url}\n\nThe link works for 1 hour. If this was not you, ignore this message; your password stays the same.`,
    html: layout({
      heading: 'Choose a new password',
      paragraphs: ['Someone asked to reset the password for this ChoiceMi account.', 'The link works for 1 hour.'],
      cta: { label: 'Reset password', url },
      footer: 'If this was not you, ignore this message. Your password stays the same.',
    }),
  }
}

export function waitlistWelcomeMail(to: string): Mail {
  const unsub = unsubscribeUrl(to)
  return {
    to,
    subject: 'You are on the ChoiceMi list',
    text: `You are on the list.\n\nChoiceMi is anonymous, compatibility-first dating: no profile photos, no endless small talk. We are opening to people in small groups, and we will email you your personal invitation when it is your turn.\n\nChanged your mind? Remove yourself here: ${unsub}`,
    html: layout({
      heading: 'You are on the list',
      paragraphs: [
        'ChoiceMi is anonymous, compatibility-first dating: no profile photos, no endless small talk.',
        'We are opening to people in small groups. We will email you your personal invitation when it is your turn.',
      ],
      footer: `Changed your mind? <a href="${esc(unsub)}" style="color:#6d28d9">Remove me from the list</a>.`,
    }),
    headers: marketingHeaders(to),
  }
}

export function inviteMail(to: string, token: string, days: number): Mail {
  const url = link(`/signup?invite=${token}`)
  const unsub = unsubscribeUrl(to)
  return {
    to,
    subject: 'Your ChoiceMi invitation is ready',
    text: `It is your turn.\n\nYou have been invited to join ChoiceMi. Create your account here:\n${url}\n\nThis personal link works once and expires in ${days} days.\n\nNot interested any more? Remove yourself: ${unsub}`,
    html: layout({
      heading: 'Your invitation is ready',
      paragraphs: [
        'You asked to hear when ChoiceMi opens, and it is your turn. Create your account to start.',
        `This personal link works once and expires in ${days} days.`,
      ],
      cta: { label: 'Create my account', url },
      footer: `Not interested any more? <a href="${esc(unsub)}" style="color:#6d28d9">Remove me from the list</a>.`,
    }),
    headers: marketingHeaders(to),
  }
}

/* ----------------------------- restaurant partners ----------------------------- */

export function staffInviteMail(to: string, token: string, roleLabel: string, days: number): Mail {
  const url = link(`/join?invite=${token}`, adminBaseUrl())
  return {
    to,
    subject: 'Your ChoiceMi staff account',
    text: `You have been added to the ChoiceMi team as ${roleLabel}.\n\nCreate your sign-in here:\n${url}\n\nThis personal link works once and expires in ${days} days. If you were not expecting it, ignore this message.`,
    html: layout({
      heading: 'Join the ChoiceMi team',
      paragraphs: [`You have been added as ${roleLabel}. Create your sign-in to open the staff dashboard.`, `This personal link works once and expires in ${days} days.`],
      cta: { label: 'Create my sign-in', url },
      footer: 'If you were not expecting this, ignore this message.',
    }),
  }
}

export function partnerInviteMail(to: string, token: string, venueName: string, days: number): Mail {
  const url = link(`/join?invite=${token}`, partnerBaseUrl())
  return {
    to,
    subject: `Your ChoiceMi partner account for ${venueName}`,
    text: `Welcome to ChoiceMi.\n\n${venueName} is set up as a ChoiceMi partner venue. Create your sign-in here:\n${url}\n\nThis personal link works once and expires in ${days} days. If you were not expecting it, ignore this message.`,
    html: layout({
      heading: 'Your partner account is ready',
      paragraphs: [`${venueName} is set up as a ChoiceMi partner venue. Create your sign-in to manage bookings, opening times and your offer.`, `This personal link works once and expires in ${days} days.`],
      cta: { label: 'Create my sign-in', url },
      footer: 'If you were not expecting this, ignore this message.',
    }),
  }
}

export function partnerApplicationReceivedMail(to: string, venueName: string): Mail {
  return {
    to,
    subject: 'We got your ChoiceMi partner request',
    text: `Thank you for applying to host ChoiceMi dates at ${venueName}.\n\nSomeone from ChoiceMi will read your request and write to you, usually within a few days. There is nothing more you need to do.`,
    html: layout({
      heading: 'We got your request',
      paragraphs: [`Thank you for applying to host ChoiceMi dates at ${venueName}.`, 'Someone from ChoiceMi will read your request and write to you, usually within a few days. There is nothing more you need to do.'],
      footer: 'You get this one message because you used the partner form on restaurant.choicemi.com.',
    }),
  }
}

export function partnerApplicationAdminMail(to: string, a: { venueName: string; contactName: string; email: string; phone: string; address: string; notes: string }): Mail {
  const lines = [`Restaurant: ${a.venueName}`, `Contact: ${a.contactName} <${a.email}>`, `Phone: ${a.phone || '-'}`, `Address: ${a.address || '-'}`, `Notes: ${a.notes || '-'}`]
  return {
    to,
    subject: `New partner request: ${a.venueName}`,
    text: `${lines.join('\n')}\n\nReview on the server: ./partners.sh list`,
    html: layout({ heading: 'New partner request', paragraphs: lines, footer: 'Review on the server with ./partners.sh list, then approve or reject.' }),
  }
}

/** A plain notification email in the standard layout: a heading, a few paragraphs and an optional button. */
export function noticeMail(to: string, subject: string, paragraphs: string[], cta?: { label: string; url: string }, footer = 'You get this because of your ChoiceMi account.'): Mail {
  const body = paragraphs.join('\n\n')
  const link = cta ? `\n\n${cta.label}: ${cta.url}` : ''
  return {
    to,
    subject,
    text: `${body}${link}\n\n${footer}`,
    html: layout({ heading: subject, paragraphs, cta, footer }),
  }
}
