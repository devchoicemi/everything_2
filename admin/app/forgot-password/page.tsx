'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { Alert, Button, Field } from '@/components/ui'
import { api, messageOf } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api('/auth/password/forgot', { body: { email } })
      setSent(true)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight">Check your inbox</h1>
          <p className="mt-3 text-ink-500">If there is a staff account for {email}, we have sent a link to choose a new password. It works for an hour.</p>
          <Link href="/login" className="btn btn-secondary mt-7">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 className="text-[30px] font-extrabold tracking-tight">Forgot your password?</h1>
          <p className="mb-6 mt-2 text-ink-500">Enter your email and we will send you a link to choose a new one.</p>
          <Field label="Email address" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <Alert className="mt-4">{error}</Alert>}
          <Button type="submit" className="mt-6" block size="lg" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send the link'}
          </Button>
          <p className="mt-5 text-center text-[13.5px] text-ink-500">
            <Link href="/login" className="font-semibold text-brand-700">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
