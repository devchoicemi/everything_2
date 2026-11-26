'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthField, FormAlert } from '@/components/auth/AuthForm'
import { AuthError, auth } from '@/services/auth'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  )
}

function ResetInner() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setFieldError('')
    setBusy(true)
    try {
      await auth.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (err instanceof AuthError && err.fields?.password) setFieldError(err.fields.password)
      else setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  if (!token) {
    return (
      <div className="cm-reveal">
        <h1 className="font-serif text-display-md text-warm-900">This link is incomplete</h1>
        <p className="mt-3 text-[15px] text-warm-600">Open the link from your email again, or request a new one.</p>
        <Link href="/forgot-password" className="btn btn-primary mt-7">
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="cm-reveal">
        <div className="mb-6 flex h-16 w-16 animate-ring-in items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-display-md text-warm-900">Password updated</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
          You have been signed out everywhere. Sign in with your new password.
        </p>
        <Link href="/login" className="btn btn-primary mt-7">
          Sign in →
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="cm-reveal" noValidate>
      <span className="eyebrow mb-4">Account recovery</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Choose a new <span className="text-gradient not-italic">password</span>
      </h1>
      <div className="mt-7">
        <AuthField
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError}
          required
        />
      </div>
      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
          {error.includes('expired') && (
            <Link href="/forgot-password" className="mt-3 inline-block text-[13.5px] font-semibold text-brand-700">
              Request a new link
            </Link>
          )}
        </div>
      )}
      <Button className="mt-6" type="submit" disabled={busy || !password}>
        {busy ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  )
}
