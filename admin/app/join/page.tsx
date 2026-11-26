'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthShell } from '@/components/AuthShell'
import { Alert, Button, Field } from '@/components/ui'
import { ApiError, api, messageOf, type SessionState } from '@/lib/api'
import { useSession } from '@/lib/session'

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell>
        <JoinInner />
      </AuthShell>
    </Suspense>
  )
}

interface InviteInfo {
  valid: boolean
  email?: string
  role?: 'member' | 'partner' | 'staff'
  venueName?: string
}

/** Where a person invited to the ChoiceMi team creates their sign-in. */
function JoinInner() {
  const router = useRouter()
  const token = useSearchParams().get('invite')
  const { refresh } = useSession()
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [password, setPassword] = useState('')
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token) {
      setInvite({ valid: false })
      return
    }
    api<InviteInfo>(`/invites/check?token=${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch(() => setInvite({ valid: false }))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !invite?.email || !token) return
    setBusy(true)
    setError('')
    setFields({})
    try {
      const s = await api<SessionState>('/auth/signup', { body: { email: invite.email, password, acceptTerms: terms, over18: adult, inviteToken: token } })
      await refresh()
      router.push(s.next === 'verify_email' ? '/verify-email' : '/dashboard')
    } catch (err) {
      setError(messageOf(err))
      if (err instanceof ApiError && err.fields) setFields(err.fields)
      setBusy(false)
    }
  }

  if (!invite) return <p className="text-ink-500">Checking your invitation…</p>

  if (!invite.valid || invite.role !== 'staff') {
    return (
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight">This link is not valid</h1>
        <p className="mt-3 text-ink-500">It may have expired, or been used already. Ask a super admin to send a new invitation.</p>
        <p className="mt-6 text-[13.5px] text-ink-500">
          Already have a sign-in?{' '}
          <Link href="/login" className="font-semibold text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <span className="eyebrow">Team invitation</span>
      <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-tight">
        Create your staff sign-in
      </h1>
      <div className="mt-7 space-y-4">
        <Field label="Email address" type="email" value={invite.email ?? ''} readOnly disabled />
        <Field label="Choose a password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="At least 10 characters." required />
      </div>
      <div className="mt-5 space-y-3 text-[13.5px] text-ink-600">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
          <span>I am 18 or older.</span>
        </label>
        <label className="flex items-start gap-3">
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
      </div>
      {error && <Alert className="mt-4">{error}</Alert>}
      <Button type="submit" className="mt-6" block size="lg" disabled={busy || !password || !adult || !terms}>
        {busy ? 'Creating…' : 'Create my sign-in'}
      </Button>
    </form>
  )
}
