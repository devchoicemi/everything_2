'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, KeyRound, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormAlert } from '@/components/auth/AuthForm'
import { CodeEntry } from '@/components/auth/CodeEntry'
import { AuthError, auth, destinationFor } from '@/services/auth'
import { useSession } from '@/lib/useSession'
import { addPasskey, passkeysSupported } from '@/services/passkeys'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  )
}

function VerifyEmailInner() {
  const router = useRouter()
  const token = useSearchParams().get('token')
  const { session, loading, refresh } = useSession()
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'failed'>(token ? 'working' : 'idle')
  const [message, setMessage] = useState('')
  const ran = useRef(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyDone, setPasskeyDone] = useState(false)
  // a passkey is offered once the email is confirmed; test accounts are never asked
  const offerPasskey = passkeysSupported() && !session?.security?.exempt && !passkeyDone && (session?.security?.passkeys ?? 0) === 0

  async function createPasskey() {
    setPasskeyBusy(true)
    setMessage('')
    try {
      await addPasskey()
      setPasskeyDone(true)
      void refresh()
    } catch (e) {
      setMessage(e instanceof AuthError ? e.message : 'Something went wrong.')
    } finally {
      setPasskeyBusy(false)
    }
  }

  // Landing from the emailed link: confirm once.
  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    auth
      .verifyEmail(token)
      .then(() => {
        setState('ok')
        void refresh()
      })
      .catch((e) => {
        setState('failed')
        setMessage(e instanceof AuthError ? e.message : 'Something went wrong.')
      })
  }, [token, refresh])

  // Typed /verify-email by hand while already confirmed: move on.
  useEffect(() => {
    // (not right after confirming here: that screen offers a passkey first)
    if (!token && state === 'idle' && session?.authenticated && session.user?.emailVerified) router.replace(destinationFor(session))
  }, [token, state, session, router])

  if (state === 'working') {
    return <p className="cm-reveal text-[15px] text-warm-600">Confirming your email…</p>
  }

  if (state === 'ok') {
    return (
      <div className="cm-reveal">
        <div className="mb-6 flex h-16 w-16 animate-ring-in items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-display-md text-warm-900">Email confirmed</h1>
        <p className="mt-3 text-[15px] text-warm-600">Thanks. You are all set on this step.</p>
        {offerPasskey && (
          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <div className="flex items-center gap-2 text-[14.5px] font-semibold text-brand-800">
              <KeyRound size={17} /> Sign in faster with a passkey
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-warm-600">
              Use your fingerprint, face or screen lock instead of a password and a code. It takes a few seconds, and you can remove it any time.
            </p>
            <Button className="mt-4" onClick={createPasskey} disabled={passkeyBusy}>
              {passkeyBusy ? 'Waiting for your device…' : 'Create a passkey'}
            </Button>
            {message && (
              <div className="mt-3">
                <FormAlert>{message}</FormAlert>
              </div>
            )}
          </div>
        )}
        {passkeyDone && (
          <div className="mt-6">
            <FormAlert tone="info">Passkey added. Next time you can sign in with it.</FormAlert>
          </div>
        )}
        <Button
          className="mt-7"
          variant={offerPasskey ? 'ghost' : 'primary'}
          onClick={() => {
            // "Skip" on the offer means "not now": do not ask again straight after
            if (offerPasskey) void auth.snoozePasskeyPrompt().catch(() => {})
            router.push(session?.authenticated ? destinationFor(session) : '/login')
          }}
        >
          {offerPasskey ? 'Skip for now →' : 'Continue →'}
        </Button>
      </div>
    )
  }

  return (
    <div className="cm-reveal">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <MailCheck size={30} />
      </div>
      <h1 className="font-serif text-display-md text-warm-900">
        {state === 'failed' ? 'That link did not work' : 'Check your inbox'}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        {state === 'failed'
          ? 'It may have expired or been used already. Enter the code from your email, or send yourself a fresh one.'
          : `We sent a 6-digit code to ${session?.user?.email ?? 'your email'}. Enter it below, or open the link in the same email.`}
      </p>

      {!loading && session?.authenticated && (
        <div className="mt-6">
          <CodeEntry
            submitLabel="Confirm email →"
            busyLabel="Confirming…"
            onSubmit={async (code) => {
              await auth.verifyEmailCode(code)
              setState('ok')
              await refresh()
            }}
            onResend={async () => {
              await auth.resendVerification()
            }}
          />
        </div>
      )}

      {message && (
        <div className="mt-5">
          <FormAlert>{message}</FormAlert>
        </div>
      )}
      {!loading && session?.authenticated ? null : (
        !loading && (
          <Link href="/login?next=/verify-email" className="btn btn-primary mt-7">
            Sign in to resend
          </Link>
        )
      )}
    </div>
  )
}
