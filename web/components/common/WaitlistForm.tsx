'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { WAITLIST_EMAIL } from '@/lib/config'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'sending' | 'done' | 'error'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Waitlist sign-up. Collects an email address only, behind an explicit
 * consent tick (GDPR: freely given, specific, withdrawable), and stores it
 * through POST /api/v1/waitlist. When ChoiceMi opens, each person is emailed a
 * personal invitation. If saving fails the visitor is told and given the
 * address to write to instead, so nobody is silently dropped.
 */
export function WaitlistForm({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const onDark = tone === 'dark'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setStatus('error')
      setMessage('Enter a valid email address.')
      return
    }
    if (!consent) {
      setStatus('error')
      setMessage('Please tick the box so we can email you about the launch.')
      return
    }
    if (trap) {
      // Bots fill the hidden field; show success without sending anything.
      setStatus('done')
      return
    }

    setStatus('sending')
    setMessage('')
    try {
      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, consent: true, company: trap, source: 'web' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } }
        if (res.status === 429 || data.error?.code === 'invalid_email' || data.error?.code === 'consent_required') {
          setStatus('error')
          setMessage(data.error?.message ?? 'Please try again in a few minutes.')
          return
        }
        throw new Error('save failed')
      }
      setStatus('done')
    } catch {
      setStatus('error')
      setMessage(`We could not save that just now. Please email ${WAITLIST_EMAIL} and we will add you.`)
    }
  }

  if (status === 'done') {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-5 py-4 text-left',
          onDark ? 'border-white/25 bg-white/10 text-white' : 'border-brand-200 bg-brand-50 text-brand-900',
          className,
        )}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white">
          <Check size={18} strokeWidth={3} />
        </span>
        <div>
          <div className="text-[15px] font-semibold">You are on the list.</div>
          <div className={cn('text-[13px]', onDark ? 'text-white/70' : 'text-brand-800/80')}>
            We will email you when ChoiceMi opens.
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className={cn('w-full', className)}>
      <div
        className={cn(
          'flex flex-col gap-2 rounded-[28px] p-2 sm:flex-row sm:items-center sm:rounded-full',
          onDark ? 'bg-white/95 shadow-[0_10px_40px_rgba(46,16,101,0.45)]' : 'border border-warm-200 bg-white shadow-sm',
        )}
      >
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          className="min-w-0 flex-1 rounded-full bg-transparent px-5 py-3.5 text-[16px] text-warm-900 placeholder:text-warm-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6d28d9] via-[#c026d3] to-[#ec4899] px-6 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.97] disabled:opacity-60"
        >
          {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* honeypot: hidden from people, filled in by bots */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <label
        className={cn(
          'mt-3 flex cursor-pointer items-start gap-2.5 text-left text-[12.5px] leading-snug',
          onDark ? 'text-white/70' : 'text-warm-500',
        )}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked)
            if (status === 'error') setStatus('idle')
          }}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-fuchsia-500"
        />
        <span>
          I agree that ChoiceMi may use my email address to contact me about the launch and to send my invitation. I
          can withdraw this at any time with the link in every email, or by writing to {WAITLIST_EMAIL}. See our{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      {status === 'error' && (
        <p role="alert" className={cn('mt-3 text-left text-[13px]', onDark ? 'text-pink-200' : 'text-danger')}>
          {message}
        </p>
      )}
    </form>
  )
}
