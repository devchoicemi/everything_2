'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, CalendarClock, CalendarDays, Inbox, LayoutDashboard, LifeBuoy, LogOut, QrCode, Star, Store, Users } from 'lucide-react'
import { Badge, Button, Logo, Spinner, cn } from '@/components/ui'
import { api, type VenueBooking } from '@/lib/api'
import { useSession } from '@/lib/session'

const NAV = [
  { href: '/dashboard', label: 'Today', icon: LayoutDashboard },
  { href: '/requests', label: 'Requests', icon: Inbox, badge: 'requests' as const },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/checkin', label: 'Check-in', icon: QrCode },
  { href: '/availability', label: 'Hours and slots', icon: CalendarClock },
  { href: '/venue', label: 'Venue', icon: Store },
  { href: '/team', label: 'Team and devices', icon: Users },
  { href: '/ratings', label: 'Ratings', icon: Star },
  { href: '/alerts', label: 'Alerts', icon: Bell, badge: 'alerts' as const },
  { href: '/help', label: 'Help', icon: LifeBuoy },
]

interface Attention {
  requests: VenueBooking[]
  mayHaveEnded: VenueBooking[]
  unreadAlerts: number
}

/** The check-in screen is a phone-sized page of its own; every other page gets this frame. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, me, signOut, reloadMe } = useSession()
  const [attention, setAttention] = useState<Attention | null>(null)

  const approved = me?.venue.reviewStatus === 'approved'

  useEffect(() => {
    if (!session) return
    if (!session.authenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    else if (session.next === 'verify_email') router.replace('/verify-email')
    else if (me && !approved) router.replace(me.venue.reviewStatus === 'submitted' ? '/onboarding/status' : '/onboarding')
  }, [session, me, approved, router, pathname])

  // the badges and the "has this date ended?" prompt
  useEffect(() => {
    if (!approved) return
    let stop = false
    const load = () =>
      api<Attention>('/partner/attention')
        .then((a) => !stop && setAttention(a))
        .catch(() => {})
    void load()
    const t = setInterval(load, 45_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [approved, pathname])

  if (!session || !session.authenticated || session.next === 'verify_email') return <Spinner />

  if (session.user?.role !== 'partner') {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-[26px] font-extrabold tracking-tight">This area is for restaurant partners</h1>
        <p className="mt-3 text-ink-500">You are signed in as a ChoiceMi member. Members use the app at choicemi.com.</p>
        <Button className="mt-6" variant="secondary" onClick={() => signOut().then(() => router.replace('/login'))}>
          Sign out
        </Button>
      </div>
    )
  }

  if (!me || !approved) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <Spinner label="Opening your venue…" />
        {!me && (
          <Button variant="ghost" size="sm" onClick={() => void reloadMe()}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  const status = me.venue.status
  const badge = (k?: 'requests' | 'alerts') => (k === 'requests' ? attention?.requests.length : k === 'alerts' ? attention?.unreadAlerts : 0) || 0
  const live = status === 'active' ? <Badge tone="ok">Live</Badge> : status === 'paused' ? <Badge tone="warn">Paused</Badge> : <Badge tone="brand">Not live yet</Badge>
  const phone = pathname.startsWith('/checkin')

  if (phone) return <>{children}</>

  const ended = attention?.mayHaveEnded ?? []

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[250px] flex-shrink-0 flex-col bg-ink-950 p-5 text-white lg:flex">
        <Link href="/dashboard" className="px-1 pt-1">
          <Logo tone="dark" height={30} label={false} />
        </Link>
        <div className="mt-7 rounded-xl bg-white/[0.06] px-4 py-3">
          <div className="truncate text-[14.5px] font-bold">{me.venue.name}</div>
          <div className="mt-1.5">{live}</div>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, badge: b }) => {
            const active = pathname.startsWith(href)
            const n = badge(b)
            return (
              <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-semibold transition', active ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white')}>
                <Icon size={18} /> {label}
                {n > 0 && <span className="ml-auto rounded-full bg-pink-500 px-2 py-0.5 text-[11px] font-bold text-white">{n}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/10 pt-4">
          <div className="truncate px-1 text-[12.5px] text-white/50">{me.email}</div>
          <div className="px-1 text-[11.5px] text-white/35">{me.staffRole === 'owner' ? 'Owner' : 'Staff'}</div>
          <button onClick={() => signOut().then(() => router.replace('/login'))} className="mt-3 flex items-center gap-2 px-1 text-[13.5px] font-semibold text-white/70 hover:text-white">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200/70 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold">{me.venue.name}</div>
            {live}
          </div>
          <button onClick={() => signOut().then(() => router.replace('/login'))} aria-label="Sign out" className="rounded-full p-2 text-ink-500 hover:bg-ink-100">
            <LogOut size={19} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-ink-200/70 bg-white/95 backdrop-blur lg:hidden">
          {NAV.slice(0, 6).map(({ href, label, icon: Icon, badge: b }) => {
            const active = pathname.startsWith(href)
            const n = badge(b)
            return (
              <Link key={href} href={href} className={cn('relative flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold', active ? 'text-brand-700' : 'text-ink-400')}>
                <Icon size={19} /> {label.split(' ')[0]}
                {n > 0 && <span className="absolute right-3 top-1.5 rounded-full bg-pink-500 px-1.5 text-[10px] font-bold text-white">{n}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {ended.length > 0 && <EndedPrompt booking={ended[0]} onDone={() => api<Attention>('/partner/attention').then(setAttention).catch(() => {})} />}
    </div>
  )
}

/** A guest tapped "I've left": staff confirm the date has ended (notification 16). */
function EndedPrompt({ booking, onDone }: { booking: VenueBooking; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const left = booking.guests.filter((g) => g.leftAt)
  return (
    <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl bg-ink-950 p-5 text-white shadow-lift lg:bottom-8 lg:left-auto lg:right-8 lg:mx-0">
      <div className="text-[12px] font-bold uppercase tracking-wider text-brand-300">A guest has left</div>
      <p className="mt-1 text-[15px] font-bold">Has this date ended?</p>
      <p className="mt-1 text-[13.5px] text-white/70">
        {booking.guests.map((g) => g.username).join(' & ')} · {booking.time} · {booking.ref}
        <br />
        {left.map((g) => `${g.username} left`).join(', ')}.
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await api(`/partner/bookings/${booking.id}/end`, { body: {} }).catch(() => {})
            onDone()
            setBusy(false)
          }}
        >
          Confirm ended
        </Button>
        <Button size="sm" variant="ghost" className="!text-white/70" onClick={onDone}>
          Not yet
        </Button>
      </div>
    </div>
  )
}
