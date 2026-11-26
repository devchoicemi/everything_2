'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/lib/useSession'

/**
 * Keeps signed-out visitors out of the app screens and sends members who still
 * owe a step (email, identity) to it. The server is the real gate (every API
 * call checks the session); this just keeps the screens honest.
 * A network failure lets the screen render, so the installed PWA still opens offline.
 */
export function RequireAuth({ children, requireOnboarded = false }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, error } = useSession()

  const destination = !session
    ? null
    : !session.authenticated
      ? `/login?next=${encodeURIComponent(pathname)}`
      : session.next === 'verify_email'
        ? '/verify-email'
        : session.next === 'verify_identity'
          ? '/verify'
          : session.next === 'prelaunch'
            ? '/you-are-in'
            : requireOnboarded && session.user && !session.user.onboarded
              ? '/onboarding?step=1'
              : null

  useEffect(() => {
    if (destination) router.replace(destination)
  }, [destination, router])

  if (error) return <>{children}</>
  if (!session || destination) return <div className="min-h-[60vh]" aria-busy="true" />
  return <>{children}</>
}
