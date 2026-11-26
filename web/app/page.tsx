import type { Metadata } from 'next'
import { AppEntryGate } from '@/components/common/AppEntryGate'
import { ComingSoon } from '@/components/common/ComingSoon'

// Hidden from search while the public site is held back — see ComingSoon.tsx.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * "/" is temporarily a holding page rather than the real marketing site —
 * the full site still exists at /home (and every other route is untouched),
 * this just stops it being what a random visitor to the bare link lands on
 * while fixes/corrections are still going out. AppEntryGate is kept here
 * unchanged: inside the native app this still resolves straight to
 * splash → welcome/discover, same as before — only the plain-web fallback
 * swaps from the marketing page to ComingSoon.
 */
export default function RootPage() {
  return (
    <AppEntryGate>
      <ComingSoon />
    </AppEntryGate>
  )
}
