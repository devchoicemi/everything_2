'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, MapPin, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { useSignOut } from '@/lib/useSession'
import { useNavBadges } from '@/lib/useNavBadges'
import { NAV_ITEMS } from './nav-items'

export function Sidebar() {
  const pathname = usePathname()
  const badges = useNavBadges()
  const user = useStore((s) => s.user)
  const toast = useStore((s) => s.toast)
  const signOut = useSignOut()

  return (
    <aside className="hidden shrink-0 flex-col border-r border-warm-200 bg-white lg:flex lg:w-[264px]">
      <div className="px-6 py-6">
        <Logo size={36} />
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 rounded-xl bg-warm-75 px-3 py-2 text-[12.5px] font-medium text-warm-600">
          <MapPin size={14} className="text-brand-600" />
          {user.city}
          <span className="ml-auto text-[11px] text-warm-400">Pilot</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4 pt-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[14.5px] font-semibold transition-colors',
                active ? 'bg-brand-50 text-brand-800' : 'text-warm-500 hover:bg-warm-75 hover:text-warm-800',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-cta"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {item.label}
              {badges[item.href] && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-600 px-1.5 text-[11px] font-bold text-white">
                  {badges[item.href]}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-warm-100 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-warm-100 bg-warm-50 p-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-serif-i text-white"
            style={{ background: 'var(--t6)' }}
          >
            {user.username.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif-i text-[14px] text-warm-900">{user.username}</div>
            <div className="text-[11px] text-brand-700">Tier {user.trustTier} · Verified</div>
          </div>
          <button
            onClick={() => toast('Settings are available in the full app')}
            className="text-warm-400 transition hover:text-warm-700"
            aria-label="Settings"
          >
            <Settings size={17} />
          </button>
        </div>
        <button
          onClick={signOut}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-warm-500 transition hover:bg-warm-75 hover:text-danger"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
