'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Lock, ShieldCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormAlert } from '@/components/auth/AuthForm'
import { AuthError, auth, destinationFor } from '@/services/auth'
import { useSession } from '@/lib/useSession'

const ONBOARDING = '/onboarding?step=1'

/**
 * Identity verification (Signicat). The member is sent to Signicat's hosted
 * login, comes back to /api/v1/auth/signicat/callback, and lands on /verify/result.
 */
export default function VerifyPage() {
  const router = useRouter()
  const { session, loading, error: sessionError } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading || sessionError || !session) return
    if (!session.authenticated) router.replace('/login?next=/verify')
    else if (session.next === 'verify_email') router.replace('/verify-email')
    else if (session.user?.identityVerified) router.replace(destinationFor(session))
  }, [loading, sessionError, session, router])

  async function begin() {
    setBusy(true)
    setError('')
    try {
      const { authorizeUrl } = await auth.startIdentity(ONBOARDING)
      window.location.assign(authorizeUrl)
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (loading || !session?.authenticated) {
    return <p className="cm-reveal text-[15px] text-warm-600">{sessionError ? 'Could not load. Refresh to try again.' : 'Loading…'}</p>
  }

  const provider = session.config?.identityProvider ?? null
  const required = session.requirements.identity

  return (
    <div className="cm-reveal">
      <span className="eyebrow mb-4">Step 2 of 3 · Identity</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Verify your <span className="text-gradient not-italic">identity</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        Every member is identity-checked, so you only ever meet real adults. It takes about two minutes and happens once.
      </p>

      <ul className="mt-7 space-y-3">
        {[
          { Icon: Fingerprint, t: 'You sign in with your bank ID or mobile ID', d: 'On a secure page run by our identity partner.' },
          { Icon: UserX, t: 'Your name is never shown to anyone', d: 'It is kept encrypted for security checks only, and deleted with your account.' },
          { Icon: Lock, t: 'Done once', d: 'You will not be asked again unless your account changes.' },
        ].map(({ Icon, t, d }) => (
          <li key={t} className="flex items-start gap-3.5 rounded-2xl border border-warm-100 bg-white p-3.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Icon size={17} />
            </span>
            <span>
              <span className="block text-[14px] font-semibold text-warm-900">{t}</span>
              <span className="block text-[12.5px] text-warm-500">{d}</span>
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-5">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      {provider ? (
        <>
          <Button className="mt-7" onClick={begin} disabled={busy}>
            <ShieldCheck size={18} /> {busy ? 'Opening secure page…' : 'Verify with bank ID →'}
          </Button>
          {provider === 'mock' && (
            <p className="mt-3 text-center text-[11.5px] text-warm-400">Development mode: this uses a stand-in, not a real identity check.</p>
          )}
        </>
      ) : (
        <>
          <div className="mt-6">
            <FormAlert tone="info">
              Identity verification is being connected and is not switched on yet. {required ? '' : 'You can carry on for now.'}
            </FormAlert>
          </div>
          {!required && (
            <Button className="mt-5" onClick={() => router.push(destinationFor(session))}>
              Continue →
            </Button>
          )}
        </>
      )}
      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-warm-400">
        GDPR-compliant · data minimised · you can delete your account at any time.
      </p>
    </div>
  )
}
