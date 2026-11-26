'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Splash } from './Splash'

/**
 * Wraps the marketing landing page ("/"). Decides what a visit to "/"
 * actually means, per the confirmed mobile flow:
 *
 *  - Running inside the native Capacitor shell: there is no marketing
 *    page on mobile — the app goes splash → welcome (sign up / sign in), or splash straight
 *    into the app if this device already has a draft in progress
 *    (checked via the same localStorage the store already persists to,
 *    see store/index.ts's `partialize` — a lightweight, real signal
 *    without inventing a server-side auth/session concept that doesn't
 *    exist yet for this anonymous-cookie pilot).
 *  - A normal web visit (any browser, including one on a phone): the
 *    marketing page renders exactly as before. The splash still plays
 *    once, briefly, as a branded reveal rather than a hard cut.
 */
export function AppEntryGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [phase, setPhase] = useState<'checking' | 'web' | 'redirecting'>('checking')

  useEffect(() => {
    let cancelled = false

    async function decide() {
      // The standalone build only ever ships inside the Android app, so it never shows the web landing page.
      let isNative = process.env.NEXT_PUBLIC_STANDALONE === '1'
      try {
        const { Capacitor } = await import('@capacitor/core')
        isNative = isNative || Capacitor.isNativePlatform()
      } catch {
        // Capacitor unavailable — keep whatever the build flag says.
      }

      if (cancelled) return

      if (!isNative) {
        // Regular web visit — reveal the marketing page after one beat.
        setTimeout(() => !cancelled && setPhase('web'), 550)
        return
      }

      setPhase('redirecting')
      const hasProgress = readHasProgress()
      // A beat so the splash reads as an intentional moment, not a flicker.
      setTimeout(() => {
        if (cancelled) return
        router.replace(hasProgress ? '/discover' : '/welcome')
      }, 700)
    }

    void decide()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <>
      {/* server-rendered for web/SEO; dropped the moment we know we're inside the native app */}
      {phase !== 'redirecting' && children}
      <AnimatePresence>
        {phase !== 'web' && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <Splash />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function readHasProgress(): boolean {
  try {
    const raw = localStorage.getItem('choicemi-draft')
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) return false
    const state = (parsed as { state?: Record<string, unknown> }).state
    const onboarding = state?.onboarding as { headline?: string } | undefined
    if (onboarding?.headline?.trim()) return true

    const compatDraft = state?.compatDraft as Record<string, { self?: unknown }> | undefined
    if (compatDraft && Object.values(compatDraft).some((v) => v?.self !== null && v?.self !== undefined)) {
      return true
    }
    return false
  } catch {
    return false
  }
}
