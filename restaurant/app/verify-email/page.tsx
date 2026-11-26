'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Alert, Button, CodeEntry } from '@/components/ui'
import { api, messageOf } from '@/lib/api'
import { useSession } from '@/lib/session'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell>
        <VerifyInner />
      </AuthShell>
    </Suspense>
  )
}

function VerifyInner() {
  const router = useRouter()
  const token = useSearchParams().get('token')
  const { session, refresh } = useSession()
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  // arriving from the emailed link
  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    api('/auth/email/verify', { body: { token } })
      .then(async () => {
        setDone(true) // before refreshing: a refreshed session would otherwise send us straight on
        await refresh()
      })
      .catch((e) => setMessage(messageOf(e)))
  }, [token, refresh])

  // already confirmed (for example typed the address by hand): move on
  useEffect(() => {
    if (!done && !token && session?.authenticated && session.user?.emailVerified) router.replace('/dashboard')
  }, [done, token, session, router])

  if (done) {
    return (
      <div>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-ok-50 text-ok-600">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h1 className="text-[30px] font-extrabold tracking-tight">Email confirmed</h1>
        <p className="mt-2 text-ink-500">Next, tell us about your venue. We save as you go.</p>
        <Button className="mt-7" block size="lg" onClick={() => router.push('/onboarding')}>
          Start the application
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <MailCheck size={28} />
      </div>
      <h1 className="text-[30px] font-extrabold tracking-tight">Check your inbox</h1>
      <p className="mb-6 mt-2 text-ink-500">
        {message ? 'That link did not work. Enter the code from the email instead.' : `We sent a 6-digit code to ${session?.user?.email ?? 'your email'}. Enter it below, or open the link in the same email.`}
      </p>
      {message && <Alert className="mb-5">{message}</Alert>}
      {session?.authenticated ? (
        <CodeEntry
          submitLabel="Confirm email"
          busyLabel="Confirming…"
          onSubmit={async (code) => {
            await api('/auth/email/verify', { body: { code } })
            setDone(true)
            await refresh()
          }}
          onResend={async () => {
            await api('/auth/email/resend', { body: {} })
          }}
        />
      ) : (
        <Link href="/login" className="btn btn-primary w-full">
          Sign in to continue
        </Link>
      )}
    </div>
  )
}
