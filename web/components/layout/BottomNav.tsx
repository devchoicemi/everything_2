'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNavBadges } from '@/lib/useNavBadges'
import { NAV_ITEMS } from './nav-items'

export function BottomNav() {
  const pathname = usePathname()
  const badges = useNavBadges()

  return (
    <nav className="glass sticky bottom-0 z-30 flex shrink-0 items-center justify-around border-t border-warm-200 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 lg:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-3 py-1 active:scale-90 transition-transform"
          >
            {active && (
              <motion.span
                layoutId="bottomnav-active-pill"
                className="absolute inset-x-0.5 -top-1 bottom-[-2px] rounded-2xl bg-brand-50"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon
              size={22}
              strokeWidth={active ? 2.5 : 2}
              className={cn('relative transition-transform', active ? '-translate-y-0.5 text-brand-700' : 'text-warm-400')}
            />
            <span
              className={cn(
                'relative text-[10.5px] font-semibold tracking-wide transition-colors',
                active ? 'text-brand-700' : 'text-warm-400',
              )}
            >
              {item.label}
            </span>
            {badges[item.href] && (
              <span className="absolute right-1.5 top-0 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-600 px-1 text-[9px] font-bold text-white">
                {badges[item.href]}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
