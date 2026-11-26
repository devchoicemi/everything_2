'use client'

import { Alert, Button, PageTitle } from '@/components/ui'
import { LoadState, useAction, useLoad } from '@/components/kit'
import { names } from '@/components/booking'
import { api, type VenueBooking } from '@/lib/api'
import { dayLabel } from '@/lib/format'

/** Requests waiting for a yes or no: one tap each, within the deadline. */
export default function RequestsPage() {
  const { data, error, loading, reload } = useLoad<{ requests: VenueBooking[] }>('/partner/requests')
  const act = useAction(reload)
  const list = data?.requests ?? []

  return (
    <div>
      <PageTitle title="Booking requests" sub="Both guests have agreed a date. Confirm it, or decline if you cannot host." />
      {act.error && <Alert className="mb-4">{act.error}</Alert>}
      <LoadState loading={loading && !data} error={error}>
        {list.length === 0 && <div className="card p-10 text-center text-ink-500">Nothing waiting. New requests also arrive by email and SMS.</div>}
        <div className="space-y-4">
          {list.map((b) => {
            const hours = b.answerBy ? Math.max(0, Math.round((new Date(b.answerBy).getTime() - Date.now()) / 3_600_000)) : null
            return (
              <div key={b.id} className="card flex flex-wrap items-center gap-5 p-5 sm:p-6">
                <div className="min-w-[150px]">
                  <div className="text-[13px] font-bold uppercase tracking-wider text-ink-500">{dayLabel(b.dateOn)}</div>
                  <div className="text-[30px] font-extrabold leading-tight">{b.time}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold">{names(b)}</div>
                  <div className="text-[13.5px] text-ink-500">
                    {b.ref} · party of 2
                    {hours !== null && <span className={hours <= 4 ? ' font-bold text-saffron-600' : ''}> · answer within {hours} {hours === 1 ? 'hour' : 'hours'}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button disabled={act.busy} onClick={() => act.run(() => api(`/partner/bookings/${b.id}/confirm`, { body: {} }))}>
                    Confirm
                  </Button>
                  <Button variant="secondary" disabled={act.busy} onClick={() => confirm('Decline this booking? The guests are told you cannot host this time.') && act.run(() => api(`/partner/bookings/${b.id}/decline`, { body: {} }))}>
                    Decline
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </LoadState>
    </div>
  )
}
