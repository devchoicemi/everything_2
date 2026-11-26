'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthField, FormAlert } from '@/components/auth/AuthForm'
import { AuthError, auth } from '@/services/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await auth.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  if (sent) {
    return (
      <div className="cm-reveal">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <MailCheck size={30} />
        </div>
        <h1 className="font-serif text-display-md text-warm-900">Check your inbox</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
          If there is an account for <strong>{email}</strong>, we have sent a link to choose a new password. It works for
          one hour.
        </p>
        <Link href="/login" className="btn btn-secondary mt-7">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="cm-reveal" noValidate>
      <span className="eyebrow mb-4">Account recovery</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Reset your <span className="text-gradient not-italic">password</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        Enter the email you signed up with and we will send you a link.
      </p>
      <div className="mt-7">
        <AuthField
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      <Button className="mt-6" type="submit" disabled={busy || !email}>
        {busy ? 'Sending…' : 'Send reset link'}
      </Button>
      <p className="mt-4 text-center text-[13.5px] text-warm-500">
        <Link href="/login" className="font-semibold text-brand-700">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
