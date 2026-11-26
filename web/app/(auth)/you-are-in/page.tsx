'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PasskeyPrompt } from '@/components/auth/PasskeyPrompt'
import { useSession, useSignOut } from '@/lib/useSession'
import { destinationFor } from '@/services/auth'

/**
 * Where members wait until launch. They are signed in and fully checked, but the app itself
 * stays closed until APP_LAUNCHED=1 on the server.
 */
export default function YouAreInPage() {
  const router = useRouter()
  const { session, loading, error } = useSession()
  const signOut = useSignOut()

  useEffect(() => {
    if (!session) return
    if (!session.authenticated) router.replace('/login')
    else if (session.next !== 'prelaunch') router.replace(destinationFor(session))
  }, [session, router])

  if (error) return <p className="cm-reveal text-[15px] text-warm-600">Could not load. Refresh to try again.</p>
  if (loading || !session?.authenticated || session.next !== 'prelaunch') {
    return <p className="cm-reveal text-[15px] text-warm-600">Loading…</p>
  }

  const email = session.user?.email ?? ''
  const rows = [
    { done: true, t: 'Account created' },
    { done: Boolean(session.user?.emailVerified), t: 'Email confirmed' },
    { done: Boolean(session.user?.identityVerified) || !session.requirements.identity, t: 'Identity checked' },
    { done: false, t: 'Access to the app', d: 'Opens at launch' },
  ]

  return (
    <div className="cm-reveal">
      <PasskeyPrompt />
      <div className="mb-6 flex h-16 w-16 animate-ring-in items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Check size={30} strokeWidth={2.5} />
      </div>
      <span className="eyebrow mb-3">Early member</span>
      <h1 className="font-serif text-display-md text-warm-900">
        You are <span className="text-gradient not-italic">in</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        Thank you for joining ChoiceMi early. Your account is ready. We are opening the app to members in small groups,
        and we will email <strong>{email}</strong> the moment your access is live. There is nothing more you need to do.
      </p>

      <ul className="mt-7 overflow-hidden rounded-2xl border border-warm-100 bg-white">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-3.5 border-b border-warm-100 p-3.5 last:border-none">
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                r.done ? 'bg-brand-100 text-brand-700' : 'bg-warm-100 text-warm-400'
              }`}
            >
              {r.done ? <Check size={16} strokeWidth={3} /> : <Clock size={16} />}
            </span>
            <span className="flex-1 text-[14px] font-semibold text-warm-900">{r.t}</span>
            {r.d && <span className="text-[12.5px] text-warm-500">{r.d}</span>}
          </li>
        ))}
      </ul>

      <Button className="mt-7" variant="secondary" onClick={signOut}>
        Sign out
      </Button>
      <p className="mt-4 text-center text-[12px] leading-relaxed text-warm-400">
        Questions? Write to admin@choicemi.com. You can ask us to delete your account at any time.
      </p>
    </div>
  )
}
