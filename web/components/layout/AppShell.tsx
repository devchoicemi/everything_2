'use client'

import { BottomNav } from './BottomNav'
import { MobileTopBar } from './MobileTopBar'
import { Sidebar } from './Sidebar'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { PasskeyPrompt } from '@/components/auth/PasskeyPrompt'

/**
 * Full-width app chrome:
 *  - desktop (lg+): fixed 264px sidebar + fluid content region that scrolls
 *  - mobile: sticky top bar + bottom nav, content scrolls between
 *
 * Pages own their own container width, padding, header and column layout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-warm-50">
      <PasskeyPrompt />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        {/* overflow-x-hidden is explicit, not incidental — leaving only overflow-y-auto set
            makes the browser compute overflow-x as auto too (CSS spec: one non-visible axis
            forces the other), which both clips the Discover card's swipe-off translateX and
            can flash a horizontal scrollbar mid-animation. Pin it to hidden so cards fly off
            cleanly instead. */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"><RequireAuth requireOnboarded>{children}</RequireAuth></div>
        <BottomNav />
      </div>
    </div>
  )
}
