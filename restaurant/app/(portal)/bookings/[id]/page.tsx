'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { names, statusBadge } from '@/components/booking'
import { Alert, Button } from '@/components/ui'
import { LoadState, Section, dateTime, label, useAction, useLoad } from '@/components/kit'
import { api, type VenueBooking } from '@/lib/api'
import { dayLabel } from '@/lib/format'
import { useSession } from '@/lib/session'

interface Detail {
  booking: VenueBooking
  events: { at: string; event: string; to: string | null }[]
}

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—')

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { me } = useSession()
  const { data, error, loading, reload } = useLoad<Detail>(`/partner/bookings/${id}`)
  const act = useAction(reload)
  const b = data?.booking
  const owner = me?.staffRole === 'owner'
  const graceOver = b ? Date.now() > new Date(b.startAt).getTime() + 20 * 60_000 : false
  const post = (path: string) => act.run(() => api(`/partner/bookings/${id}/${path}`, { body: {} }))

  return (
    <div>
      <Link href="/bookings" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Bookings
      </Link>
      <LoadState loading={loading && !data} error={error}>
        {b && data && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-bold uppercase tracking-wider text-ink-500">
                  {dayLabel(b.dateOn)} · {b.time}
                </div>
                <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{names(b)}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-ink-500">
                  <span className="font-mono font-semibold text-ink-700">{b.ref}</span> · party of 2 {statusBadge(b)}
                </div>
              </div>
            </div>

            {act.error && <Alert>{act.error}</Alert>}
            <div className="flex flex-wrap gap-2">
              {b.status === 'in_progress' && (
                <Button disabled={act.busy} onClick={() => post('end')}>
                  Confirm the date has ended
                </Button>
              )}
              {(b.status === 'in_progress' || b.status === 'partially_checked_in') && !b.offerClaimedAt && (
                <Button variant="secondary" disabled={act.busy} onClick={() => post('offer')}>
                  Mark the offer as given
                </Button>
              )}
              {(b.status === 'confirmed' || b.status === 'partially_checked_in') && graceOver && (
                <Button variant="danger" disabled={act.busy} onClick={() => confirm('Mark this booking as a no-show?') && post('no-show')}>
                  Mark no-show
                </Button>
              )}
              {b.status === 'confirmed' && owner && new Date(b.startAt).getTime() > Date.now() && (
                <Button variant="danger" disabled={act.busy} onClick={() => confirm('Cancel this confirmed booking? Both guests are told and ChoiceMi is alerted.') && post('cancel')}>
                  Cancel booking
                </Button>
              )}
              {b.status === 'requested' && (
                <>
                  <Button disabled={act.busy} onClick={() => post('confirm')}>
                    Confirm
                  </Button>
                  <Button variant="secondary" disabled={act.busy} onClick={() => post('decline')}>
                    Decline
                  </Button>
                </>
              )}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Guests">
                <ul className="divide-y divide-ink-100">
                  {b.guests.map((g) => (
                    <li key={g.username} className="py-3">
                      <div className="text-[15px] font-bold">{g.username}</div>
                      <div className="text-[13.5px] text-ink-500">
                        {g.checkedInAt ? `Checked in ${clock(g.checkedInAt)} by ${g.checkedInVia === 'qr' ? 'QR code' : 'username and code'}` : 'Not checked in'}
                        {g.leftAt && ` · left ${clock(g.leftAt)}`}
                        {g.lateNote && ` · running about ${g.lateNote} min late`}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] text-ink-400">You see usernames only. Real names, contact details and profiles stay with ChoiceMi.</p>
              </Section>
              <Section title="What happened">
                <ol className="space-y-2.5 text-[13.5px]">
                  {data.events.map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" />
                      <span>
                        <b>{label(e.event)}</b> <span className="text-ink-400">· {dateTime(e.at)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>
          </div>
        )}
      </LoadState>
    </div>
  )
}
