'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { safeNext } from '@/components/auth/AuthForm'
import { useSession } from '@/lib/useSession'
import { destinationFor } from '@/services/auth'

const REASONS: Record<string, string> = {
  cancelled: 'You cancelled the identity check. You can start it again whenever you are ready.',
  underage: 'ChoiceMi is only for people aged 18 and over, so we cannot verify this account.',
  already_linked: 'This identity is already linked to another ChoiceMi account. Sign in to that account instead.',
  expired: 'That verification session expired or was already used. Please start again.',
  invalid_state: 'We could not match that verification to your account. Please start again.',
  provider_error: 'The identity service reported a problem. Please try again in a moment.',
  verification_failed: 'We could not confirm your identity. Please try again.',
}

export default function VerifyResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultInner />
    </Suspense>
  )
}

function ResultInner() {
  const router = useRouter()
  const params = useSearchParams()
  const ok = params.get('status') === 'ok'
  const reason = params.get('reason') ?? ''
  const next = safeNext(params.get('next')) ?? '/onboarding?step=1'
  const { session, refresh } = useSession()
  const prelaunch = session?.next === 'prelaunch'

  // Pull the fresh "identityVerified" flag into the app state.
  useEffect(() => {
    void refresh()
  }, [refresh])

  if (ok) {
    return (
      <div className="cm-reveal">
        <div className="mb-6 flex h-16 w-16 animate-ring-in items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <span className="eyebrow mb-3">Identity confirmed</span>
        <h1 className="font-serif text-display-md text-warm-900">
          You are <span className="text-gradient not-italic">verified</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
          {prelaunch
            ? 'Thank you. Your account is ready. ChoiceMi opens to members soon, and we will email you the moment your access is live.'
            : 'Thank you. Next, tell us a little about yourself so we can find people you will actually click with.'}
        </p>
        <Button className="mt-7" onClick={() => router.push(session ? destinationFor(session, next) : next)}>
          Continue →
        </Button>
      </div>
    )
  }

  return (
    <div className="cm-reveal">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <TriangleAlert size={30} />
      </div>
      <h1 className="font-serif text-display-md text-warm-900">We could not verify you</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        {REASONS[reason] ?? 'Something went wrong during the identity check. Please try again.'}
      </p>
      {reason !== 'underage' && reason !== 'already_linked' && (
        <Button className="mt-7" onClick={() => router.push('/verify')}>
          Try again
        </Button>
      )}
    </div>
  )
}
