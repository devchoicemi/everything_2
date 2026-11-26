'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Alert, Button, CodeEntry, Field } from '@/components/ui'
import { api, messageOf, type SessionState } from '@/lib/api'
import { useSession } from '@/lib/session'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell>
        <LoginInner />
      </AuthShell>
    </Suspense>
  )
}

type Challenge = { challenge: string; emailHint: string }

function LoginInner() {
  const router = useRouter()
  const next = useSearchParams().get('next')
  const { session, refresh, signOut } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)

  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  // already signed in as a partner: straight to the dashboard
  useEffect(() => {
    if (session?.authenticated && session.user?.role === 'admin') router.replace(session.next === 'verify_email' ? '/verify-email' : safeNext)
  }, [session, router, safeNext])

  /** After a session exists: partners go in; anyone else (a member) is told this is the wrong door. */
  async function enter(s: SessionState) {
    if (s.user?.role !== 'admin') {
      await signOut()
      setChallenge(null)
      setBusy(false)
      setError('This sign-in is for ChoiceMi staff. Members sign in at choicemi.com and restaurants at restaurant.choicemi.com.')
      return
    }
    await refresh()
    router.push(s.next === 'verify_email' ? '/verify-email' : safeNext)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const r = await api<SessionState & { otpRequired?: boolean; challenge?: string; emailHint?: string }>('/auth/login', { body: { email, password } })
      if (r.otpRequired && r.challenge) {
        setChallenge({ challenge: r.challenge, emailHint: r.emailHint ?? '' })
        setBusy(false)
        return
      }
      await enter(r)
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  if (challenge) {
    return (
      <div>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <MailCheck size={28} />
        </div>
        <h1 className="text-[30px] font-extrabold tracking-tight">Check your email</h1>
        <p className="mb-6 mt-2 text-ink-500">
          We sent a 6-digit code to <span className="font-semibold text-ink-800">{challenge.emailHint}</span>. Enter it to finish signing in.
        </p>
        <CodeEntry
          submitLabel="Sign in"
          busyLabel="Signing in…"
          onSubmit={async (code) => enter(await api<SessionState>('/auth/login/verify', { body: { challenge: challenge.challenge, code } }))}
          onResend={async () => {
            await api('/auth/login/resend', { body: { challenge: challenge.challenge } })
          }}
        />
        <button type="button" onClick={() => { setChallenge(null); setPassword('') }} className="mt-6 block w-full text-center text-[13px] text-ink-500">
          Use a different account
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <span className="eyebrow">Staff sign-in</span>
      <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-tight">Welcome back</h1>
      <p className="mt-2 text-ink-500">Sign in with your ChoiceMi staff account.</p>
      <div className="mt-7 space-y-4">
        <Field label="Email address" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="mt-3 text-right">
        <Link href="/forgot-password" className="text-[13px] font-semibold text-brand-700">
          Forgot password?
        </Link>
      </div>
      {error && <Alert className="mt-4">{error}</Alert>}
      <Button type="submit" className="mt-6" block size="lg" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
