'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, CalendarCheck, Check, Coffee, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { MonthCalendar } from '@/components/dates/MonthCalendar'
import { VenueCard } from '@/components/dates/VenueCard'
import { FullOverlay } from '@/components/common/FullOverlay'
import { DEMO_TODAY, MONTH_NAMES } from '@/lib/utils'
import { LIVE } from '@/lib/live'
import { PROPOSE_TARGET, PROPOSE_TIME_VALUES, PROPOSE_TIMES, VENUES } from '@/lib/mock-data'
import { formatSlotLabel } from '@/lib/booking'
import { compatService, dateService, matchService, verificationService } from '@/services/api'
import { useStore } from '@/store'
import type { Venue } from '@/types'

function ProposeInner() {
  const router = useRouter()
  useEffect(() => {
    if (LIVE) router.replace('/dates')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const searchParams = useSearchParams()
  const toast = useStore((s) => s.toast)
  const addEvent = useStore((s) => s.addCalendarEvent)
  const matches = useStore((s) => s.matches)
  const setMatches = useStore((s) => s.setMatches)
  // real accounts: a match opened directly (a reload) needs the list fetched first
  const [matchesReady, setMatchesReady] = useState(!LIVE || matches.length > 0)

  const matchIdParam = searchParams.get('matchId')
  const match = matchIdParam ? matches.find((m) => String(m.id) === matchIdParam) : matches[0]
  const targetId = match ? String(match.id) : '1'
  const target = match
    ? { un: match.un, av: match.av, avc: match.avc, intent: match.intent }
    : PROPOSE_TARGET

  const [gateChecked, setGateChecked] = useState(false)
  const [gatePassed, setGatePassed] = useState(false)
  const [score, setScore] = useState<number | undefined>(match?.score)

  const [venues, setVenues] = useState<Venue[]>(LIVE ? [] : VENUES)
  // times already taken at the chosen venue on the chosen day (real accounts)
  const [takenTimes, setTakenTimes] = useState<string[]>([])

  const [year, setYear] = useState(DEMO_TODAY.getFullYear())
  const [month, setMonth] = useState(DEMO_TODAY.getMonth())
  const [day, setDay] = useState<number | null>(null)
  const [time, setTime] = useState<string | null>(null) // 24h "HH:mm"
  const [venueIdx, setVenueIdx] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!LIVE || matchesReady) return
    let cancelled = false
    matchService
      .list()
      .then((list) => !cancelled && setMatches(list))
      .catch(() => {})
      .finally(() => !cancelled && setMatchesReady(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!LIVE) return
    let cancelled = false
    dateService
      .venues()
      .then((v) => !cancelled && setVenues(v))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (LIVE) {
      // being matched means both of you already passed the read-check, so there is nothing more to check here
      setGatePassed(true)
      setGateChecked(true)
    } else {
      verificationService
        .status(targetId)
        .then((res) => !cancelled && setGatePassed(res.status === 'passed'))
        .catch(() => !cancelled && setGatePassed(false))
        .finally(() => !cancelled && setGateChecked(true))
    }
    if (match?.score === undefined) {
      compatService
        .getScore('me', String(match?.memberId ?? targetId))
        .then((res) => !cancelled && setScore(res.final))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  // which times are still free at this venue on this day
  useEffect(() => {
    if (!LIVE || !day || venueIdx === null || !venues[venueIdx]?.id) {
      setTakenTimes([])
      return
    }
    let cancelled = false
    dateService
      .slots(venues[venueIdx].id as string, `${year}-${month + 1}-${day}`)
      .then((slots) => {
        if (cancelled) return
        const taken = slots.filter((s) => !s.available).map((s) => s.time)
        setTakenTimes(taken)
        setTime((t) => (t && taken.includes(t) ? null : t))
      })
      .catch(() => !cancelled && setTakenTimes([]))
    return () => {
      cancelled = true
    }
  }, [day, venueIdx, year, month, venues])

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m)
    setYear(y)
    setDay(null)
  }

  async function send() {
    if (!day) return toast('Pick a date on the calendar', 'danger')
    if (!time) return toast('Choose a preferred time', 'danger')
    if (venueIdx === null) return toast('Select a venue', 'danger')
    setBusy(true)
    const key = `${year}-${month + 1}-${day}`
    try {
      await dateService.propose({ targetId, dateKey: key, time, venue: venues[venueIdx].n, venueId: venues[venueIdx].id })
      addEvent(key, { type: 'pending', label: `Date with ${target.un}`, color: '#A86212' })
      setConfirmed(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send the proposal.'
      toast(message, 'danger')
    } finally {
      setBusy(false)
    }
  }

  const venue = venueIdx !== null ? venues[venueIdx] ?? null : null
  const dateStr = day ? `${MONTH_NAMES[month]} ${day}, ${year}` : 'Not selected'
  const timeLabel = time ? formatSlotLabel(time) : 'Not selected'

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <button
        onClick={() => router.push('/dates')}
        className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700"
      >
        <ArrowLeft size={17} /> Back to dates
      </button>

      <PageHeader
        title="Propose a date"
        subtitle="No messaging at any stage before you meet. The first conversation happens at the venue"
      />

      {LIVE && matchesReady && !match ? (
        <div className="flex flex-col items-center rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center">
          <div className="font-serif text-[22px] text-warm-900">No match to propose to</div>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-warm-600">
            You can propose a date once you and someone else have both liked each other. Open a match to begin.
          </p>
          <Button block={false} className="mt-6" onClick={() => router.push('/matches')}>
            Go to matches →
          </Button>
        </div>
      ) : !matchesReady ? (
        <div className="h-[360px] animate-pulse-soft rounded-3xl bg-warm-100" />
      ) : gateChecked && !gatePassed ? (
        <div className="flex flex-col items-center rounded-3xl border border-amber-100 bg-amber-50 px-8 py-16 text-center">
          <ShieldAlert size={32} className="mb-3 text-amber-600" />
          <div className="font-serif text-[22px] text-warm-900">Read-check required first</div>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-warm-600">
            You need to read {target.un}&apos;s profile and pass the read-check before proposing a
            date with them.
          </p>
          <Button block={false} className="mt-6" onClick={() => router.push('/discover')}>
            Go read their profile →
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* form */}
          <div className="min-w-0 space-y-6">
            <Panel title="Pick a date">
              <div className="max-w-sm">
                <MonthCalendar
                  variant="mini"
                  year={year}
                  month={month}
                  selectedDay={day}
                  events={{}}
                  onChangeMonth={changeMonth}
                  onSelectDay={(d) => setDay(d)}
                />
              </div>
            </Panel>

            <Panel title="Preferred time">
              <p className="mb-2.5 text-[12px] text-warm-400">Venue hours: 12:00pm – 7:00pm</p>
              <div className="flex flex-wrap gap-2">
                {PROPOSE_TIME_VALUES.map((value, i) => (
                  <Chip
                    key={value}
                    active={time === value}
                    disabled={takenTimes.includes(value)}
                    className={takenTimes.includes(value) ? 'cursor-not-allowed line-through opacity-50' : undefined}
                    onClick={() => setTime(value)}
                  >
                    {PROPOSE_TIMES[i]}
                  </Chip>
                ))}
              </div>
            </Panel>

            <Panel title="Choose a venue in Helsinki">
              <div className="grid gap-3 sm:grid-cols-2">
                {venues.map((v, i) => (
                  <VenueCard key={v.id ?? v.n} venue={v} selected={venueIdx === i} onSelect={() => setVenueIdx(i)} />
                ))}
              </div>
            </Panel>

            <div className="rounded-2xl border border-warm-100 bg-warm-50 px-5 py-4 text-[13px] leading-relaxed text-warm-600">
              There is no messaging at this stage: no note, no chat. Pick a day, time and venue; if{' '}
              {target.un} accepts, you&apos;ll meet and talk in person.
            </div>
          </div>

          {/* summary rail */}
          <aside>
            <div className="sticky top-6 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-sm">
                <div className="bg-[linear-gradient(155deg,var(--t0),transparent_70%)] p-5">
                  <div className="flex items-center gap-3">
                    <Avatar letter={target.av} color={target.avc} size={46} />
                    <div className="flex-1">
                      <div className="font-serif-i text-[17px] text-warm-900">{target.un}</div>
                      <div className="text-[12px] text-warm-500">
                        {score === undefined ? '···' : `${score}%`} compatible · {target.intent}
                      </div>
                    </div>
                    <Badge tone="verified">
                      <Check size={12} />
                    </Badge>
                  </div>
                  {!LIVE && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-white px-3 py-2.5">
                      <Coffee size={14} className="mt-0.5 flex-shrink-0 text-brand-700" />
                      <div className="text-[12px] leading-snug">
                        <span className="font-bold text-brand-800">
                          {PROPOSE_TARGET.styleAlignment}% date-style match
                        </span>
                        <br />
                        <span className="text-brand-600">{PROPOSE_TARGET.styleNote}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5 border-t border-warm-100 p-5 text-[13px]">
                  <SummaryRow k="Date" v={dateStr} set={!!day} />
                  <SummaryRow k="Time" v={timeLabel} set={!!time} />
                  <SummaryRow k="Venue" v={venue?.n ?? 'Not selected'} set={venueIdx !== null} />
                </div>
                <div className="border-t border-warm-100 p-5">
                  <Button onClick={send} disabled={busy}>
                    {busy ? 'Sending…' : 'Send date proposal →'}
                  </Button>
                  <p className="mt-2.5 text-center text-[11.5px] leading-relaxed text-warm-400">
                    {target.un} has 48 hours to accept or decline.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <FullOverlay open={confirmed} background="rgba(6,20,15,.93)">
        <div className="flex flex-col items-center text-center">
          <motion.div
            className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/25 bg-white/10 text-white"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
          >
            <CalendarCheck size={34} />
          </motion.div>
          <div className="font-serif text-[28px] text-white">Date proposed</div>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/70">
            Waiting for {target.un} to confirm. They have 48 hours to respond. It will appear in your
            calendar as pending.
          </p>
          <div className="mt-6 w-full max-w-sm space-y-2.5 rounded-2xl border border-white/15 bg-white/[0.06] p-5 text-[13px]">
            {[
              ['Date', day ? `${MONTH_NAMES[month]} ${day}, ${timeLabel}` : ''],
              ['Venue', venue?.n ?? ''],
              ['Area', venue?.area ?? ''],
              ['Offer', venue?.offer ?? ''],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                className={'flex justify-between' + (i < arr.length - 1 ? ' border-b border-white/10 pb-2.5' : '')}
              >
                <span className="text-white/55">{k}</span>
                <span className="font-semibold text-white">{v}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push('/dates')}
            className="mt-6 w-full max-w-sm rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-brand-800"
          >
            Back to dates →
          </button>
        </div>
      </FullOverlay>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="sec-lbl">{title}</div>
      {children}
    </div>
  )
}

function SummaryRow({ k, v, set }: { k: string; v: string; set: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-warm-500">{k}</span>
      <span className={set ? 'font-semibold text-warm-900' : 'text-warm-400'}>{v}</span>
    </div>
  )
}

export default function ProposePage() {
  return (
    <Suspense fallback={null}>
      <ProposeInner />
    </Suspense>
  )
}
