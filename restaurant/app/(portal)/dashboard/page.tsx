'use client'

import Link from 'next/link'
import { ArrowRight, QrCode } from 'lucide-react'
import { BookingLine } from '@/components/booking'
import { Alert, ButtonLink, PageTitle } from '@/components/ui'
import { LoadState, Section, useAction, useLoad } from '@/components/kit'
import { api, type Stats, type VenueBooking } from '@/lib/api'
import { dayLabel, todayHelsinki } from '@/lib/format'
import { useSession } from '@/lib/session'

interface Attention {
  requests: VenueBooking[]
  mayHaveEnded: VenueBooking[]
}

/** Today: the dates at the venue, what needs an answer, and what is left before going live. */
export default function DashboardPage() {
  const { me } = useSession()
  const today = todayHelsinki()
  const day = useLoad<{ bookings: VenueBooking[]; pending: number }>(`/partner/bookings?from=${today}&to=${today}`)
  const att = useLoad<Attention>('/partner/attention')
  const stats = useLoad<Stats>('/partner/stats')
  const act = useAction(async () => {
    await day.reload()
    await att.reload()
  })
  if (!me) return null
  const next = att.data?.requests[0]
  const hoursLeft = next?.answerBy ? Math.max(0, Math.round((new Date(next.answerBy).getTime() - Date.now()) / 3_600_000)) : null
  const todays = (day.data?.bookings ?? []).filter((b) => b.status !== 'cancelled')

  return (
    <div>
      <PageTitle
        title="Today"
        sub={`${dayLabel(today)} · ${todays.length} ${todays.length === 1 ? 'date' : 'dates'}`}
        actions={
          <ButtonLink href="/checkin" variant="ink">
            <QrCode size={17} /> Open check-in device
          </ButtonLink>
        }
      />

      {me.venue.status !== 'active' && (
        <Alert tone="warn" className="mb-6">
          {me.venue.status === 'paused' ? 'Your venue is paused: guests cannot book it.' : 'You are not live yet.'}{' '}
          <Link href="/onboarding/go-live" className="font-bold underline">
            {me.venue.status === 'paused' ? 'Resume taking dates' : 'Finish getting ready'}
          </Link>
        </Alert>
      )}

      {next && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-saffron-100 bg-saffron-50 px-5 py-4">
          <div>
            <div className="text-[15px] font-bold text-ink-900">
              {att.data!.requests.length} booking {att.data!.requests.length === 1 ? 'request needs' : 'requests need'} an answer
            </div>
            {hoursLeft !== null && <div className="text-[13.5px] text-ink-600">The first one must be answered within {hoursLeft} {hoursLeft === 1 ? 'hour' : 'hours'}.</div>}
          </div>
          <ButtonLink href="/requests" variant="ink" size="sm">
            Review requests
          </ButtonLink>
        </div>
      )}

      <LoadState loading={day.loading && !day.data} error={day.error}>
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-ink-500">Dates today</h2>
        <div className="card divide-y divide-ink-100 overflow-hidden">
          {todays.length === 0 && <p className="px-5 py-8 text-center text-[14px] text-ink-400">No dates today.</p>}
          {todays.map((b) => (
            <BookingLine
              key={b.id}
              b={b}
              right={
                b.status === 'in_progress' && b.guestLeft ? (
                  <button className="btn btn-ink btn-sm" disabled={act.busy} onClick={() => act.run(() => api(`/partner/bookings/${b.id}/end`, { body: {} }))}>
                    Confirm ended
                  </button>
                ) : (
                  <Link href={`/bookings/${b.id}`} className="btn btn-secondary btn-sm">
                    Open
                  </Link>
                )
              }
            />
          ))}
        </div>
      </LoadState>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Section title="This month">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Num n={stats.data?.upcoming} l="Confirmed ahead" />
            <Num n={stats.data?.last30.hosted} l="Hosted, 30 days" />
            <Num n={stats.data?.last30.noShows} l="No-shows" />
          </div>
        </Section>
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-[14px] text-ink-700">
          <b className="text-ink-900">A guest may ask you for help.</b> If someone seems unsafe or uncomfortable, please help them and let ChoiceMi know.
          <Link href="/help" className="mt-2 flex items-center gap-1 font-bold text-brand-700">
            Contact ChoiceMi <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

const Num = ({ n, l }: { n?: number; l: string }) => (
  <div>
    <div className="text-[28px] font-extrabold leading-none">{n ?? '…'}</div>
    <div className="mt-1 text-[12px] text-ink-500">{l}</div>
  </div>
)
