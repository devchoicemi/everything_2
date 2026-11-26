'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MarketingFooter, MarketingHeader } from '@/components/Marketing'
import { Alert, Button, Field } from '@/components/ui'
import { ApiError, api, messageOf, type SessionState } from '@/lib/api'
import { useSession } from '@/lib/session'

/** Step zero: make the account. Everything after this is saved as the venue goes, so nothing is lost. */
export default function ApplyPage() {
  const router = useRouter()
  const { refresh } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setFields({})
    try {
      const s = await api<SessionState>('/auth/signup', { body: { email, password, acceptTerms: terms, applyAsPartner: true, contactName: name } })
      await refresh()
      router.push(s.next === 'verify_email' ? '/verify-email' : '/onboarding')
    } catch (err) {
      setError(messageOf(err))
      if (err instanceof ApiError && err.fields) setFields(err.fields)
      setBusy(false)
    }
  }

  return (
    <div>
      <MarketingHeader />
      <main className="mx-auto max-w-xl px-5 py-14 sm:px-8">
        <form onSubmit={submit} noValidate className="cm-rise">
          <span className="eyebrow">Join the pilot</span>
          <h1 className="mt-3 text-[38px] font-extrabold leading-tight tracking-tight">Start your application</h1>
          <p className="mt-3 text-[16px] text-ink-600">Create your sign-in first. Then tell us about your venue, at your own pace: we save as you go, so you can stop and come back.</p>

          <div className="card mt-8 space-y-5 p-7">
            <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} error={fields.contactName} autoComplete="name" required />
            <Field label="Your work email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} hint="We send booking alerts here later, so use one that someone reads." required />
            <Field label="Choose a password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="At least 10 characters." required />
            <label className="flex items-start gap-3 text-[13.5px] text-ink-600">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
              <span>
                I accept the{' '}
                <a href="https://choicemi.com/terms" target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
                  Terms
                </a>{' '}
                and the{' '}
                <a href="https://choicemi.com/privacy" target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" block size="lg" disabled={busy || !name || !email || !password || !terms}>
              {busy ? 'Creating…' : 'Create my account'}
            </Button>
          </div>
          <p className="mt-6 text-center text-[13.5px] text-ink-500">
            Already started?{' '}
            <Link href="/login" className="font-semibold text-brand-700">
              Sign in
            </Link>
          </p>
        </form>
      </main>
      <MarketingFooter />
    </div>
  )
}
