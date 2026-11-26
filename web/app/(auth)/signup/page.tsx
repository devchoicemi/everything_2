'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { WaitlistForm } from '@/components/common/WaitlistForm'
import { AuthCheck, AuthField, FormAlert } from '@/components/auth/AuthForm'
import { AuthError, auth, destinationFor } from '@/services/auth'
import { useStore } from '@/store'

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpInner />
    </Suspense>
  )
}

type Gate =
  | { state: 'loading' }
  | { state: 'open' } // anyone may sign up
  | { state: 'invited'; token: string; email: string }
  | { state: 'closed'; reason: 'none' | 'invalid' }

function SignUpInner() {
  const token = useSearchParams().get('invite')
  const [gate, setGate] = useState<Gate>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (token) {
          const r = await auth.checkInvite(token)
          if (alive) setGate(r.valid && r.email ? { state: 'invited', token, email: r.email } : { state: 'closed', reason: 'invalid' })
          return
        }
        const s = await auth.session()
        if (alive) setGate(s.config?.signupMode === 'open' ? { state: 'open' } : { state: 'closed', reason: 'none' })
      } catch {
        if (alive) setGate({ state: 'closed', reason: token ? 'invalid' : 'none' })
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  if (gate.state === 'loading') return <p className="cm-reveal text-[15px] text-warm-600">Loading…</p>
  if (gate.state === 'closed') return <InviteOnly invalid={gate.reason === 'invalid'} />
  return <SignUpForm inviteToken={gate.state === 'invited' ? gate.token : undefined} invitedEmail={gate.state === 'invited' ? gate.email : undefined} />
}

function InviteOnly({ invalid }: { invalid: boolean }) {
  return (
    <div className="cm-reveal">
      <span className="eyebrow mb-4">{invalid ? 'Invitation' : 'Coming soon'}</span>
      <h1 className="font-serif text-display-md text-warm-900">
        {invalid ? (
          <>
            That invitation <span className="text-gradient not-italic">did not work</span>
          </>
        ) : (
          <>
            ChoiceMi is <span className="text-gradient not-italic">invitation-only</span> for now
          </>
        )}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        {invalid
          ? 'The link may have expired, been used already, or been replaced by a newer one. Join the waitlist and we will send you a fresh invitation.'
          : 'We are opening in small groups. Join the waitlist and we will email you a personal invitation when it is your turn.'}
      </p>
      <div className="mt-7">
        <WaitlistForm tone="light" />
      </div>
      <p className="mt-6 text-center text-[13.5px] text-warm-500">
        Already a member?{' '}
        <Link href="/login" className="font-semibold text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function SignUpForm({ inviteToken, invitedEmail }: { inviteToken?: string; invitedEmail?: string }) {
  const router = useRouter()
  const setAuthed = useStore((s) => s.setAuthed)
  const [email, setEmail] = useState(invitedEmail ?? '')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [adult, setAdult] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setFields({})
    const local: Record<string, string> = {}
    if (!terms) local.acceptTerms = 'Please accept the Terms and Privacy Policy.'
    if (!adult) local.over18 = 'You must be 18 or older.'
    if (Object.keys(local).length) return setFields(local)

    setBusy(true)
    try {
      const s = await auth.signUp({ email, password, acceptTerms: terms, over18: adult, inviteToken })
      setAuthed(true)
      router.push(destinationFor(s))
    } catch (err) {
      if (err instanceof AuthError) {
        setFields(err.fields ?? {})
        if (!err.fields || err.code === 'email_taken') setError(err.message)
      } else setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="cm-reveal" noValidate>
      <span className="eyebrow mb-4">{inviteToken ? 'You are invited' : 'Step 1 of 3 · Account'}</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Create your <span className="text-gradient not-italic">account</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        Your email is only used to sign in and to reach you about your account. It is never shown to other members.
      </p>

      <div className="mt-7 space-y-4">
        <AuthField
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fields.email}
          readOnly={Boolean(invitedEmail)}
          hint={invitedEmail ? 'This is the address your invitation was sent to.' : undefined}
          required
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.password}
          hint="A short phrase works well. Use something you do not use anywhere else."
          required
        />
        <AuthCheck checked={adult} onChange={setAdult} error={fields.over18}>
          I am 18 or older.
        </AuthCheck>
        <AuthCheck checked={terms} onChange={setTerms} error={fields.acceptTerms}>
          I agree to the{' '}
          <Link href="/terms" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
            Terms
          </Link>{' '}
          and have read how my data is used in the{' '}
          <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </AuthCheck>
      </div>

      {error && (
        <div className="mt-5">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      <Button className="mt-7" type="submit" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account →'}
      </Button>
      <p className="mt-4 text-center text-[13.5px] text-warm-500">
        Already a member?{' '}
        <Link href="/login" className="font-semibold text-brand-700">
          Sign in
        </Link>
      </p>
    </form>
  )
}
