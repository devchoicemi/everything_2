'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, Check, Clock, LifeBuoy } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { formatSlotLabel } from '@/lib/booking'
import { bookingsApi, type BookingStatus, type BookingSummary } from '@/services/bookings'
import { longDate } from '@/services/social'

type Tab = 'now' | 'coming' | 'past'

const LABEL: Record<BookingStatus, string> = {
  proposed: 'Planning',
  picked: 'Waiting to confirm',
  requested: 'Asking the venue',
  confirmed: 'Confirmed',
  partially_checked_in: 'Checked in',
  in_progress: 'Date in progress',
  ended: 'Done',
  declined: 'Venue declined',
  expired: 'Expired',
  closed: 'Closed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

const tabOf = (b: BookingSummary): Tab => (['proposed', 'picked', 'requested'].includes(b.status) ? 'now' : ['confirmed', 'partially_checked_in', 'in_progress'].includes(b.status) ? 'coming' : 'past')

/** My dates for real accounts: what needs me, what is booked, and what is over. */
export function LiveDates() {
  const router = useRouter()
  const [list, setList] = useState<BookingSummary[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('now')

  useEffect(() => {
    bookingsApi
      .list()
      .then((r) => {
        setList(r.bookings)
        // open on the tab that has something for me
        if (!r.bookings.some((b) => tabOf(b) === 'now') && r.bookings.some((b) => tabOf(b) === 'coming')) setTab('coming')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your dates.'))
    bookingsApi.notifications().then((n) => setUnread(n.unread)).catch(() => {})
  }, [])

  const shown = useMemo(() => (list ?? []).filter((b) => tabOf(b) === tab), [list, tab])
  const count = (t: Tab) => (list ?? []).filter((b) => tabOf(b) === t).length
  const needs = (list ?? []).filter((b) => b.needsMe).length

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <PageHeader
        photo="cafe"
        photoPosition="40% 45%"
        title="Dates"
        subtitle={needs ? `${needs} ${needs === 1 ? 'date needs' : 'dates need'} you` : `${count('coming')} booked · ${count('now')} being planned`}
        actions={
          <div className="flex gap-2">
            <Link href="/notifications" className="relative rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25" aria-label="Updates">
              <Bell size={17} />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-pink-500 px-1.5 text-[10px] font-bold">{unread}</span>}
            </Link>
            <Link href="/help" className="rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25" aria-label="Help">
              <LifeBuoy size={17} />
            </Link>
          </div>
        }
      />

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        {([['now', 'Planning'], ['coming', 'Booked'], ['past', 'Past']] as const).map(([id, label]) => (
          <Chip key={id} active={tab === id} onClick={() => setTab(id)}>
            {label}
            <span className={'ml-1.5 text-[11px] ' + (tab === id ? 'text-white/70' : 'text-warm-400')}>{count(id)}</span>
          </Chip>
        ))}
      </div>

      {error ? (
        <div className="rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center text-[15px] text-warm-600">{error}</div>
      ) : !list ? (
        <div className="h-[200px] animate-pulse-soft rounded-3xl bg-warm-100" />
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-warm-100 bg-white px-8 py-20 text-center">
          <CalendarDays size={40} className="mb-3 inline-block text-warm-300" />
          <div className="font-serif text-[20px] text-warm-900">Nothing here yet</div>
          <p className="mt-1.5 text-[14px] text-warm-500">When you match with someone, planning your first date starts here.</p>
          <Button block={false} className="mt-5" onClick={() => router.push('/matches')}>
            Go to matches
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((b) => (
            <Link key={b.id} href={`/booking?id=${b.id}`} className="block overflow-hidden rounded-2xl border border-warm-100 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-serif-i text-[19px] text-warm-900">{b.partner}</div>
                  <div className="mt-0.5 text-[13px] text-warm-500">
                    {b.dateOn && b.time ? `${longDate(b.dateOn)} at ${formatSlotLabel(b.time)}${b.venueName ? ` · ${b.venueName}` : ''}` : `Date window ${longDate(b.window.from)} to ${longDate(b.window.to)}`}
                  </div>
                </div>
                {b.needsMe ? (
                  <Badge tone="pending">
                    <Clock size={12} /> Your turn
                  </Badge>
                ) : b.status === 'confirmed' ? (
                  <Badge tone="confirmed">
                    <Check size={12} /> {LABEL[b.status]}
                  </Badge>
                ) : (
                  <Badge tone="neutral">{LABEL[b.status]}</Badge>
                )}
              </div>
              <div className="mt-2 text-[12px] text-warm-400">{b.ref}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
