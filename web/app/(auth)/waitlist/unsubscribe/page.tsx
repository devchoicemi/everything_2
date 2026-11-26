'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormAlert } from '@/components/auth/AuthForm'
import { AuthError, auth } from '@/services/auth'

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  )
}

function UnsubscribeInner() {
  const params = useSearchParams()
  const email = params.get('e') ?? ''
  const token = params.get('t') ?? ''
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState('')

  async function confirm() {
    setState('working')
    setError('')
    try {
      await auth.unsubscribeWaitlist(email, token)
      setState('done')
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
      setState('idle')
    }
  }

  if (!email || !token) {
    return (
      <div className="cm-reveal">
        <h1 className="font-serif text-display-md text-warm-900">This link is incomplete</h1>
        <p className="mt-3 text-[15px] text-warm-600">
          Open the link from the email again, or write to admin@choicemi.com and we will remove you.
        </p>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div className="cm-reveal">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-display-md text-warm-900">You have been removed</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
          Your email address is deleted from our waitlist and we will not contact you again.
        </p>
        <Link href="/" className="btn btn-secondary mt-7">
          Back to ChoiceMi
        </Link>
      </div>
    )
  }

  return (
    <div className="cm-reveal">
      <span className="eyebrow mb-4">Waitlist</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Leave the <span className="text-gradient not-italic">waitlist</span>?
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        This deletes <strong>{email}</strong> from our list and cancels any invitation we sent you.
      </p>
      {error && (
        <div className="mt-5">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      <Button className="mt-7" onClick={confirm} disabled={state === 'working'}>
        {state === 'working' ? 'Removing…' : 'Yes, remove me'}
      </Button>
    </div>
  )
}
