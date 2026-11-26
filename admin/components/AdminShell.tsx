'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, CalendarDays, Database, Fingerprint, Flag, Headset, History, LayoutDashboard, LogOut, UserCog, Users } from 'lucide-react'
import { Badge, Button, Logo, Spinner, cn } from '@/components/ui'
import { useSession } from '@/lib/session'
import type { Permission } from '@/lib/api'

const NAV: { href: string; label: string; icon: typeof Users; perm?: Permission }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/support', label: 'Helpdesk', icon: Headset, perm: 'support.read' },
  { href: '/venues', label: 'Venues', icon: Building2, perm: 'venues.review' },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays, perm: 'bookings.read' },
  { href: '/moderation', label: 'Moderation', icon: Flag, perm: 'moderation.manage' },
  { href: '/users', label: 'Members & venues', icon: Users, perm: 'users.read' },
  { href: '/kyc', label: 'Identity checks', icon: Fingerprint, perm: 'kyc.read' },
  { href: '/team', label: 'Team & roles', icon: UserCog, perm: 'staff.manage' },
  { href: '/audit', label: 'Activity log', icon: History, perm: 'audit.read' },
  { href: '/data', label: 'Data', icon: Database, perm: 'data.read' },
]

/** Signed-in frame. Only staff get in, and the menu shows only what their role allows. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, me, signOut, can } = useSession()

  useEffect(() => {
    if (!session) return
    if (!session.authenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    else if (session.next === 'verify_email') router.replace('/verify-email')
  }, [session, router, pathname])

  if (!session || !session.authenticated || session.next === 'verify_email') return <Spinner />

  if (session.user?.role !== 'admin' || !me) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-[26px] font-extrabold tracking-tight">This area is for ChoiceMi staff</h1>
        <p className="mt-3 text-ink-500">
          {session.user?.role === 'admin' ? 'Your staff access is switched off. Ask a super admin to turn it back on.' : 'You are signed in with an account that is not on the ChoiceMi team.'}
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => signOut().then(() => router.replace('/login'))}>
          Sign out
        </Button>
      </div>
    )
  }

  const items = NAV.filter((n) => !n.perm || can(n.perm))
  const current = items.find((n) => pathname.startsWith(n.href))
  const allowed = !current && pathname !== '/' ? NAV.find((n) => pathname.startsWith(n.href) && n.perm && !can(n.perm)) : null

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[250px] flex-shrink-0 flex-col bg-ink-950 p-5 text-white lg:flex">
        <Link href="/dashboard" className="px-1 pt-1">
          <Logo tone="dark" height={30} label />
        </Link>
        <nav className="mt-7 flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-semibold transition', active ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white')}>
                <Icon size={18} /> {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/10 pt-4">
          <div className="truncate px-1 text-[13px] font-semibold text-white/80">{me.username}</div>
          <div className="truncate px-1 text-[12px] text-white/45">{me.email ?? 'server admin token'}</div>
          <div className="mt-2 px-1">
            <Badge tone="brand">{me.roleLabel}</Badge>
          </div>
          <button onClick={() => signOut().then(() => router.replace('/login'))} className="mt-3 flex items-center gap-2 px-1 text-[13.5px] font-semibold text-white/70 hover:text-white">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200/70 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold">ChoiceMi staff</div>
            <Badge tone="brand">{me.roleLabel}</Badge>
          </div>
          <button onClick={() => signOut().then(() => router.replace('/login'))} aria-label="Sign out" className="rounded-full p-2 text-ink-500 hover:bg-ink-100">
            <LogOut size={19} />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-ink-200/70 bg-white px-3 py-2 lg:hidden">
          {items.map(({ href, label }) => (
            <Link key={href} href={href} className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold', pathname.startsWith(href) ? 'bg-ink-900 text-white' : 'text-ink-600')}>
              {label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-8 lg:pt-10">
          {allowed ? (
            <div className="py-20 text-center">
              <h1 className="text-[26px] font-extrabold tracking-tight">Your role does not include this</h1>
              <p className="mt-3 text-ink-500">As {me.roleLabel.toLowerCase()} you cannot open {allowed.label}. Ask a super admin if you need it.</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
