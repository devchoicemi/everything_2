'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, Clock, Gift, MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { LIVE } from '@/lib/live'
import { dateService } from '@/services/api'
import { useStore } from '@/store'
import type { DateBooking } from '@/types'

const bandClass: Record<DateBooking['status'], string> = {
  confirmed: 'from-brand-600 to-pink-500',
  pending: 'from-amber-600 to-[#E8A840]',
  past: 'from-warm-300 to-warm-200',
}

export function DateCard({ booking, onChanged }: { booking: DateBooking; index?: number; onChanged?: () => void }) {
  const router = useRouter()
  const toast = useStore((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const live = LIVE ? booking.live : undefined

  /** Runs a date action for a real account, then lets the page reload its list. */
  async function act(run: () => Promise<unknown>, done: string) {
    if (busy) return
    setBusy(true)
    try {
      await run()
      toast(done, 'success')
      onChanged?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work. Please try again.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cm-reveal overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-sm">
      <div className={cn('h-1.5 bg-gradient-to-r', bandClass[booking.status])} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar letter={booking.av} color={booking.avc} size={48} />
            <div>
              <div className="font-serif-i text-[18px] text-warm-900">{booking.un}</div>
              <div className="mt-0.5 text-[12.5px] text-warm-500">
                {[booking.age || null, booking.type, booking.atmo].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          {booking.status === 'confirmed' && (
            <Badge tone="confirmed">
              <Check size={12} /> Confirmed
            </Badge>
          )}
          {booking.status === 'pending' && (
            <Badge tone="pending">
              <Clock size={12} /> Awaiting response
            </Badge>
          )}
          {booking.status === 'past' && <Badge tone="neutral">Past</Badge>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl bg-warm-50 px-3.5 py-3">
            <CalendarDays size={17} className="flex-shrink-0 text-brand-600" />
            <div>
              <div className="text-[13.5px] font-semibold text-warm-900">{booking.date}</div>
              <div className="text-[11.5px] text-warm-500">{booking.time}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-warm-50 px-3.5 py-3">
            <MapPin size={17} className="flex-shrink-0 text-brand-600" />
            <div>
              <div className="text-[13.5px] font-semibold text-warm-900">{booking.venue}</div>
              <div className="text-[11.5px] text-warm-500">{booking.varea}</div>
            </div>
          </div>
        </div>

        {live && booking.status === 'pending' && (
          <p className="mt-3 text-[12.5px] text-warm-500">
            {live.role === 'invitee'
              ? `${booking.un} would like to meet you here.`
              : `Waiting for ${booking.un} to answer.`}
            {live.answerBy && ` Answer by ${new Date(live.answerBy).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
          </p>
        )}

        {booking.offer && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-100 bg-[linear-gradient(135deg,var(--am0),#FFF9EE)] px-3.5 py-3">
            <Gift size={18} className="flex-shrink-0 text-amber-600" />
            <div>
              <div className="text-[12px] font-bold text-amber-600">{booking.offer.title}</div>
              <div className="text-[12px] text-warm-700">{booking.offer.desc}</div>
              {booking.offer.code && (
                <div className="mt-1.5 text-[12px] text-warm-700">
                  Show this code at the venue: <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[14px] font-bold tracking-[0.2em] text-amber-600">{booking.offer.code}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2.5">
          {booking.status === 'confirmed' && live && (
            <Button
              variant="danger"
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Cancel your date with ${booking.un}?`)) void act(() => dateService.cancel(booking.id), 'Date cancelled.')
              }}
            >
              Cancel date
            </Button>
          )}
          {booking.status === 'confirmed' && !live && (
            <>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => toast('Reminder set for 2 hours before')}>
                Remind me
              </Button>
              <Button variant="danger" size="sm" className="flex-1" onClick={() => toast('Date cancelled. Your trust score is affected', 'danger')}>
                Cancel
              </Button>
            </>
          )}
          {booking.status === 'pending' && live?.role === 'invitee' && (
            <>
              <Button variant="ghost" size="sm" className="flex-1" disabled={busy} onClick={() => act(() => dateService.decline(booking.id), 'Proposal declined.')}>
                Decline
              </Button>
              <Button size="sm" className="flex-1" disabled={busy} onClick={() => act(() => dateService.accept(booking.id), 'Date confirmed.')}>
                Accept
              </Button>
            </>
          )}
          {booking.status === 'pending' && live?.role === 'proposer' && (
            <Button variant="ghost" size="sm" className="flex-1" disabled={busy} onClick={() => act(() => dateService.cancel(booking.id), 'Proposal withdrawn.')}>
              Withdraw
            </Button>
          )}
          {booking.status === 'pending' && !live && (
            <>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => toast('Proposal withdrawn')}>
                Withdraw
              </Button>
              <Button variant="amber" size="sm" className="flex-1" onClick={() => toast('Reminder sent')}>
                Nudge them
              </Button>
            </>
          )}
          {booking.status === 'past' && (
            <>
              {!booking.fdone && (
                <Button size="sm" className="flex-1" onClick={() => router.push(`/dates/feedback/${booking.id}`)}>
                  Give feedback
                </Button>
              )}
              {live?.redateMutual ? (
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => router.push(`/dates/propose?matchId=${live.matchId}`)}>
                  Propose another date
                </Button>
              ) : live?.redateRequested ? (
                <span className="flex-1 rounded-full border border-warm-200 px-4 py-2 text-center text-[12.5px] font-semibold text-warm-500">
                  Re-date requested
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={busy}
                  onClick={
                    live
                      ? () => act(async () => { const r = await dateService.requestRedate(booking.id); toast(r.mutual ? 'You both want another date. Propose one now.' : `Re-date request sent to ${booking.un}`, 'success') }, 'Request saved.')
                      : () => toast('Re-date request sent')
                  }
                >
                  Request a re-date
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
