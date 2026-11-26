'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CodeEntry } from '@/components/auth/CodeEntry'
import { AuthField, FormAlert, safeNext } from '@/components/auth/AuthForm'
import { AuthError, auth, destinationFor, type OtpChallenge, type SessionState } from '@/services/auth'
import { passkeysSupported, signInWithPasskey } from '@/services/passkeys'
import { useStore } from '@/store'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const setAuthed = useStore((s) => s.setAuthed)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [failed, setFailed] = useState(0)
  // after a correct password, when a code has been emailed
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [canPasskey, setCanPasskey] = useState(false)
  useEffect(() => setCanPasskey(passkeysSupported()), [])

  function signedIn(s: SessionState) {
    setAuthed(true)
    router.push(destinationFor(s, next))
  }

  async function usePasskey() {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      signedIn(await signInWithPasskey())
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const s = await auth.logIn({ email, password })
      if ('otpRequired' in s) {
        setChallenge(s)
        setBusy(false)
        return
      }
      signedIn(s)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
      if (err instanceof AuthError && err.code === 'invalid_credentials') setFailed((n) => n + 1)
      setBusy(false)
    }
  }

  if (challenge) {
    return (
      <div className="cm-reveal">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <MailCheck size={30} />
        </div>
        <h1 className="font-serif text-display-md text-warm-900">Check your email</h1>
        <p className="mt-3 mb-6 text-[15px] leading-relaxed text-warm-600">
          We sent a 6-digit code to <span className="font-semibold text-warm-800">{challenge.emailHint}</span>. Enter it to finish signing in.
        </p>
        <CodeEntry
          submitLabel="Sign in →"
          busyLabel="Signing in…"
          onSubmit={async (code) => signedIn(await auth.logInWithCode(challenge.challenge, code))}
          onResend={async () => {
            await auth.resendLoginCode(challenge.challenge)
          }}
        />
        <button
          type="button"
          onClick={() => {
            setChallenge(null)
            setPassword('')
          }}
          className="mt-6 block w-full text-center text-[13px] text-warm-500"
        >
          Use a different account
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="cm-reveal" noValidate>
      <span className="eyebrow mb-4">Welcome back</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Sign in to <span className="text-gradient not-italic">ChoiceMi</span>
      </h1>

      <div className="mt-7 space-y-4">
        <AuthField
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="mt-3 text-right">
        <Link href="/forgot-password" className="text-[13px] font-semibold text-brand-700">
          Forgot password?
        </Link>
      </div>

      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
          {failed > 0 && (
            <p className="mt-2 text-[12.5px] leading-snug text-warm-500">
              Tip: tap the eye icon to see what you typed. Check for a capital letter at the start or a space at the end, which phone
              keyboards sometimes add.{failed >= 3 ? ' Too many wrong tries pauses sign-in for 15 minutes. You can also reset your password.' : ''}
            </p>
          )}
        </div>
      )}

      <Button className="mt-6" type="submit" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in →'}
      </Button>
      {canPasskey && (
        <>
          <div className="my-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-widest text-warm-300">
            <span className="h-px flex-1 bg-warm-100" /> or <span className="h-px flex-1 bg-warm-100" />
          </div>
          <Button type="button" variant="secondary" onClick={usePasskey} disabled={busy}>
            <KeyRound size={17} /> Sign in with a passkey
          </Button>
        </>
      )}
      <p className="mt-4 text-center text-[13.5px] text-warm-500">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-brand-700">
          Create an account
        </Link>
      </p>
    </form>
  )
}
