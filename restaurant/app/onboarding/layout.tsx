'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button, Logo, Spinner, cn } from '@/components/ui'
import { OnboardingProvider, stepsDone, useOnboarding } from '@/lib/onboarding'
import { useSession } from '@/lib/session'

const STEPS = [
  { href: '/onboarding', label: 'Venue and location' },
  { href: '/onboarding/hours', label: 'Hours and date slots' },
  { href: '/onboarding/photos', label: 'Photos' },
  { href: '/onboarding/offer', label: 'Offer and terms' },
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <Frame>{children}</Frame>
    </OnboardingProvider>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, me, signOut } = useSession()
  const { ob } = useOnboarding()

  useEffect(() => {
    if (!session) return
    if (!session.authenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    else if (session.next === 'verify_email') router.replace('/verify-email')
  }, [session, router, pathname])

  if (!session || !session.authenticated || session.next === 'verify_email') return <Spinner />
  if (session.user?.role !== 'partner') {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-[26px] font-extrabold tracking-tight">This area is for restaurant partners</h1>
        <Button className="mt-6" variant="secondary" onClick={() => signOut().then(() => router.replace('/login'))}>
          Sign out
        </Button>
      </div>
    )
  }
  if (!me || !ob) return <Spinner label="Opening your application…" />

  const done = stepsDone(ob)
  const isStep = STEPS.some((s) => s.href === pathname)
  const current = STEPS.findIndex((s) => s.href === pathname)
  const editable = ob.venue.reviewStatus === 'draft' || ob.venue.reviewStatus === 'sent_back'

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink-200/70 bg-white">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/onboarding">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            {me.venue.reviewStatus === 'approved' && (
              <Link href="/dashboard" className="text-[14px] font-semibold text-brand-700">
                Open the portal
              </Link>
            )}
            <button onClick={() => signOut().then(() => router.replace('/login'))} className="text-[14px] font-semibold text-brand-700">
              Save and finish later
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">
        {isStep && (
          <ol className="mb-8 flex flex-wrap gap-x-3 gap-y-3">
            {STEPS.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className={cn('flex items-center gap-2.5 rounded-full py-1 pr-4 text-[14px] font-semibold', i === current ? 'text-ink-900' : done[i] ? 'text-ink-600' : 'text-ink-400')}>
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold', i === current ? 'bg-brand-700 text-white' : done[i] ? 'bg-ok-600 text-white' : 'bg-ink-100 text-ink-500')}>{done[i] && i !== current ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        )}
        {isStep && !editable && (
          <div className="mb-6 rounded-xl bg-saffron-50 px-4 py-3 text-[14px] text-saffron-600">
            {ob.venue.reviewStatus === 'submitted' ? 'Your application is with ChoiceMi for review, so it cannot be edited right now.' : 'Your venue is approved. Details checked in review can only be changed by asking ChoiceMi.'}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
