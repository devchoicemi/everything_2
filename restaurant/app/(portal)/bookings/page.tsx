'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { statusBadge, names } from '@/components/booking'
import { Button, PageTitle, cn } from '@/components/ui'
import { LoadState, useLoad } from '@/components/kit'
import type { VenueBooking } from '@/lib/api'
import { addDays, dayLabel, mondayOf, todayHelsinki } from '@/lib/format'

/** Bookings by week. Details leave the portal 30 days after the date. */
export default function BookingsPage() {
  const today = todayHelsinki()
  const [monday, setMonday] = useState(mondayOf(today))
  const sunday = addDays(monday, 6)
  const { data, error, loading } = useLoad<{ bookings: VenueBooking[]; pending: number }>(`/partner/bookings?from=${monday}&to=${sunday}`)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div>
      <PageTitle
        title="Bookings"
        sub={`${dayLabel(monday)} to ${dayLabel(sunday)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMonday(mondayOf(today))}>
              This week
            </Button>
            <Button variant="secondary" size="sm" aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />
      {(data?.pending ?? 0) > 0 && (
        <Link href="/requests" className="mb-5 block rounded-xl bg-saffron-50 px-4 py-3 text-[14px] font-semibold text-saffron-600">
          {data!.pending} {data!.pending === 1 ? 'request is' : 'requests are'} waiting for your answer →
        </Link>
      )}
      <LoadState loading={loading && !data} error={error}>
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((d) => {
            const list = (data?.bookings ?? []).filter((b) => b.dateOn === d)
            return (
              <div key={d} className={cn('rounded-2xl border bg-white p-3', d === today ? 'border-brand-400 shadow-card' : 'border-ink-200/70')}>
                <div className={cn('mb-2 text-[12.5px] font-bold uppercase tracking-wider', d === today ? 'text-brand-700' : 'text-ink-500')}>{dayLabel(d)}</div>
                {list.length === 0 && <div className="py-2 text-[12.5px] text-ink-300">—</div>}
                <div className="space-y-2">
                  {list.map((b) => (
                    <Link key={b.id} href={`/bookings/${b.id}`} className="block rounded-xl bg-ink-100/60 p-2.5 transition hover:bg-brand-50">
                      <div className="text-[15px] font-extrabold tabular-nums">{b.time}</div>
                      <div className="truncate text-[12.5px] font-semibold text-ink-700">{names(b)}</div>
                      <div className="mt-1.5">{statusBadge(b)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </LoadState>
    </div>
  )
}
