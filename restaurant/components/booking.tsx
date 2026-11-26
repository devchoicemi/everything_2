'use client'

import { Badge } from '@/components/ui'
import type { VenueBooking } from '@/lib/api'
import { timeLabel } from '@/lib/format'

export function statusBadge(b: VenueBooking) {
  const n = b.guests.filter((g) => g.checkedInAt).length
  switch (b.status) {
    case 'requested':
      return <Badge tone="warn">Needs your answer</Badge>
    case 'confirmed':
      return <Badge tone="brand">Confirmed</Badge>
    case 'partially_checked_in':
      return <Badge tone="brand">Waiting for second guest</Badge>
    case 'in_progress':
      return <Badge tone="ok">{b.guestLeft ? 'A guest has left' : 'In progress · both checked in'}</Badge>
    case 'ended':
      return <Badge tone="ok">Ended</Badge>
    case 'no_show':
      return <Badge tone="danger">No-show{n ? ' · one came' : ''}</Badge>
    case 'cancelled':
      return <Badge tone="neutral">Cancelled{b.cancelledRole === 'venue' ? ' by you' : ''}</Badge>
    default:
      return <Badge tone="neutral">{b.status}</Badge>
  }
}

export const names = (b: VenueBooking) => b.guests.map((g) => g.username).join(' & ')

export function BookingLine({ b, right }: { b: VenueBooking; right?: React.ReactNode }) {
  const first = b.guests.find((g) => g.checkedInAt)
  const left = b.guests.find((g) => g.leftAt)
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
      <div className="w-[64px] text-[22px] font-extrabold tabular-nums">{b.time}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{names(b)}</div>
        <div className="text-[13px] text-ink-500">
          {b.ref} · party of 2
          {first && !left && ` · ${first.username} checked in ${new Date(first.checkedInAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          {left && ` · ${left.username} left ${new Date(left.leftAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          {b.guests.some((g) => g.lateNote) && ` · running ${b.guests.find((g) => g.lateNote)!.lateNote} min late`}
        </div>
      </div>
      {statusBadge(b)}
      {right}
    </div>
  )
}

export { timeLabel }
