'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthShell } from '@/components/AuthShell'
import { Alert, Button, Field } from '@/components/ui'
import { ApiError, api, messageOf } from '@/lib/api'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell>
        <ResetInner />
      </AuthShell>
    </Suspense>
  )
}

function ResetInner() {
  const token = useSearchParams().get('token')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !token) return
    setBusy(true)
    setError('')
    setFields({})
    try {
      await api('/auth/password/reset', { body: { token, password } })
      setDone(true)
    } catch (err) {
      setError(messageOf(err))
      if (err instanceof ApiError && err.fields) setFields(err.fields)
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight">This link is not valid</h1>
        <p className="mt-3 text-ink-500">Use the link from the email, or ask for a new one.</p>
        <Link href="/forgot-password" className="btn btn-secondary mt-7">
          Send a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight">Password changed</h1>
        <p className="mt-3 text-ink-500">You can sign in with your new password now.</p>
        <Link href="/login" className="btn btn-primary mt-7">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-[30px] font-extrabold tracking-tight">Choose a new password</h1>
      <div className="mt-6">
        <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="At least 10 characters." required />
      </div>
      {error && !fields.password && <Alert className="mt-4">{error}</Alert>}
      <Button type="submit" className="mt-6" block size="lg" disabled={busy || !password}>
        {busy ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  )
}
