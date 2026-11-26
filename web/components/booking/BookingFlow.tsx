'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { CalendarDays, Check, Clock, Flag, Gift, MapPin, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { formatSlotLabel } from '@/lib/booking'
import { longDate } from '@/services/social'
import { bookingsApi, type BookingView, type OptionInput, type OptionView } from '@/services/bookings'
import { OptionBuilder } from '@/components/booking/OptionBuilder'
import { useStore } from '@/store'

const REASONS = [
  { id: 'dates', label: "Dates don't work" },
  { id: 'times', label: "Times don't work" },
  { id: 'venues', label: "Venues don't suit" },
] as const

const CONCERNS = [
  { id: 'felt_unsafe', label: 'I felt unsafe' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate_behaviour', label: 'Inappropriate behaviour' },
  { id: 'not_as_described', label: 'Not who they said they were' },
  { id: 'other', label: 'Something else' },
]

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const optionText = (o: OptionView) => `${longDate(o.dateOn)} at ${formatSlotLabel(o.time)}, ${o.venueName}`

const Card = ({ children, tone }: { children: React.ReactNode; tone?: 'brand' | 'amber' | 'danger' }) => (
  <div className={`rounded-3xl border p-5 shadow-sm sm:p-7 ${tone === 'brand' ? 'border-brand-100 bg-brand-50/60' : tone === 'amber' ? 'border-amber-100 bg-[#FFF9EE]' : tone === 'danger' ? 'border-danger/20 bg-white' : 'border-warm-100 bg-white'}`}>{children}</div>
)

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''))
  }, [value])
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="Your check-in QR code" className="mx-auto h-[220px] w-[220px] rounded-2xl bg-white p-2 shadow-sm" /> : <div className="mx-auto h-[220px] w-[220px] animate-pulse-soft rounded-2xl bg-warm-100" />
}

/** The whole life of one booking, from the first three options to the rating. What you see depends on where it is. */
export function BookingFlow({ id, onGone }: { id: string; onGone?: () => void }) {
  const router = useRouter()
  const toast = useStore((s) => s.toast)
  const [b, setB] = useState<BookingView | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setB((await bookingsApi.get(id)).booking)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this date.')
    }
  }, [id])

  useEffect(() => {
    void load()
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [load])

  async function run(fn: () => Promise<unknown>, done?: string) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      if (done) toast(done, 'success')
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work. Please try again.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <Card>{error}</Card>
  if (!b) return <div className="h-[300px] animate-pulse-soft rounded-3xl bg-warm-100" />

  const who = b.partner.username
  const can = (a: string) => b.actions.includes(a as never)
  const sentSet = b.options.filter((o) => o.status === 'offered')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-widest text-warm-400">{b.kind === 'redate' ? 'Another date with' : 'Your date with'}</div>
          <h1 className="font-serif-i text-[28px] text-warm-900">{who}</h1>
        </div>
        <Badge tone="neutral">{b.ref}</Badge>
      </div>

      {b.status === 'proposed' && b.round === 0 && (
        <OptionBuilder
          window={b.window}
          busy={busy}
          submitLabel={`Send 3 options to ${who}`}
          onSubmit={(o) => run(() => bookingsApi.sendOptions(b.id, o), 'Options sent.')}
          intro={
            <Card tone="brand">
              <div className="text-[15px] font-semibold text-brand-800">Choose three ways to meet</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-800/80">
                Each option is a venue, a day and a time. Your date window is {longDate(b.window.from)} to {longDate(b.window.to)}. {who} picks the one that suits them, or says none of them do. Nothing goes to the venue until you both agree.
              </p>
            </Card>
          }
        />
      )}

      {b.status === 'proposed' && b.round > 0 && b.turn === 'them' && (
        <Card>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-warm-900">
            <Clock size={17} className="text-amber-600" /> Waiting for {who}
          </div>
          <p className="mt-1.5 text-[13.5px] text-warm-600">You sent these. {who} can pick one{b.deadlineAt ? ` until ${when(b.deadlineAt)}` : ''}.</p>
          <ul className="mt-4 space-y-2">
            {sentSet.map((o) => (
              <li key={o.id} className="rounded-xl bg-warm-50 px-4 py-3 text-[14px] text-warm-800">
                {optionText(o)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {b.status === 'proposed' && b.round > 0 && b.turn === 'me' && <Answer b={b} who={who} busy={busy} run={run} />}

      {b.status === 'picked' && b.picked && (
        <Card tone={b.turn === 'me' ? 'brand' : undefined}>
          {b.turn === 'me' ? (
            <>
              <div className="text-[15px] font-semibold text-warm-900">{who} picked an option</div>
              <p className="mt-2 rounded-xl bg-white px-4 py-3 text-[15px] font-semibold text-warm-900 shadow-sm">{optionText(b.picked)}</p>
              <p className="mt-3 text-[13.5px] text-warm-600">Confirm to book it. Only then do we ask the venue.{b.deadlineAt ? ` Confirm by ${when(b.deadlineAt)}.` : ''}</p>
              <Button className="mt-4" disabled={busy} onClick={() => run(() => bookingsApi.confirm(b.id), 'Request sent to the venue.')}>
                Confirm and book
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[15px] font-semibold text-warm-900">
                <Clock size={17} className="text-amber-600" /> Waiting for {who} to confirm
              </div>
              <p className="mt-2 text-[14px] text-warm-700">You picked: {optionText(b.picked)}</p>
            </>
          )}
        </Card>
      )}

      {b.status === 'requested' && (
        <Card tone="amber">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-warm-900">
            <Clock size={17} className="text-amber-600" /> Request sent to {b.venue?.name ?? 'the venue'}
          </div>
          <p className="mt-2 text-[14px] text-warm-700">
            {b.dateOn && b.time ? `${longDate(b.dateOn)} at ${formatSlotLabel(b.time)}. ` : ''}We will tell you both as soon as it is confirmed.
          </p>
          {can('withdraw') && (
            <Button variant="ghost" size="sm" block={false} className="mt-4" disabled={busy} onClick={() => window.confirm('Withdraw this request?') && run(() => bookingsApi.withdraw(b.id), 'Request withdrawn.')}>
              Withdraw the request
            </Button>
          )}
        </Card>
      )}

      {(b.status === 'confirmed' || b.status === 'partially_checked_in' || b.status === 'in_progress') && <DateCard b={b} busy={busy} run={run} />}

      {b.status === 'ended' && <After b={b} who={who} busy={busy} run={run} onNext={() => router.push(`/booking?match=${b.matchId}`)} />}

      {['declined', 'expired', 'closed', 'cancelled', 'no_show'].includes(b.status) && <Over b={b} who={who} onNext={() => router.push(`/booking?match=${b.matchId}`)} />}

      {can('report') && <Report b={b} />}
      {onGone && null}
    </div>
  )
}

/** Three options arrived: pick one, or say none of them work, with a reason, and send three of your own. */
function Answer({ b, who, busy, run }: { b: BookingView; who: string; busy: boolean; run: (fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [mode, setMode] = useState<'pick' | 'none'>('pick')
  const [reasons, setReasons] = useState<string[]>([])
  const last = b.round >= 4
  const earlier = b.turns.filter((t) => t.action === 'none')
  return (
    <div className="space-y-4">
      {earlier.length > 0 && (
        <Card tone="amber">
          <div className="text-[13.5px] text-warm-800">
            {earlier.map((t, i) => (
              <p key={i}>
                {t.by === 'me' ? 'You said none of those worked' : `${who} said none of those worked`}: {t.reasons.join(', ')}.
              </p>
            ))}
          </div>
        </Card>
      )}
      {mode === 'pick' ? (
        <Card>
          <div className="text-[15px] font-semibold text-warm-900">{who} sent you 3 options</div>
          <p className="mt-1 text-[13.5px] text-warm-600">Pick the one that suits you{b.deadlineAt ? `, by ${when(b.deadlineAt)}` : ''}.</p>
          <ul className="mt-4 space-y-3">
            {b.options.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warm-100 bg-warm-50 px-4 py-3.5">
                <div>
                  <div className="text-[14.5px] font-semibold text-warm-900">{longDate(o.dateOn)} at {formatSlotLabel(o.time)}</div>
                  <div className="text-[12.5px] text-warm-500">
                    {o.venueName} · {o.venueArea}
                  </div>
                </div>
                <Button block={false} size="sm" disabled={busy} onClick={() => run(() => bookingsApi.pick(b.id, o.id), 'Picked. Waiting for them to confirm.')}>
                  Pick this
                </Button>
              </li>
            ))}
          </ul>
          <button className="mt-5 text-[14px] font-semibold text-brand-700" onClick={() => setMode('none')}>
            None of these
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="text-[15px] font-semibold text-warm-900">What did not work?</div>
            <p className="mt-1 text-[13.5px] text-warm-600">Choose at least one. {who} will see it, so you can find something that suits you both.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <Chip key={r.id} active={reasons.includes(r.id)} onClick={() => setReasons((x) => (x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id]))}>
                  {r.label}
                </Chip>
              ))}
            </div>
            <button className="mt-4 text-[13.5px] font-semibold text-warm-500" onClick={() => setMode('pick')}>
              Back to the options
            </button>
          </Card>
          {last ? (
            <Card tone="amber">
              <p className="text-[14px] text-warm-800">This was the last set. If none of these suit you either, your window will close and you will both be told.</p>
              <Button className="mt-4" variant="danger" disabled={busy || reasons.length === 0} onClick={() => run(() => bookingsApi.none(b.id, reasons), 'We have told you both.')}>
                None of these: close it
              </Button>
            </Card>
          ) : (
            reasons.length > 0 && <OptionBuilder window={b.window} busy={busy} submitLabel={`Send 3 new options to ${who}`} onSubmit={(o: OptionInput[]) => run(() => bookingsApi.none(b.id, reasons, o), 'New options sent.')} />
          )}
        </div>
      )}
    </div>
  )
}

/** The confirmed date: where, when, the offer, photos, and the QR code and backup code to check in. */
function DateCard({ b, busy, run }: { b: BookingView; busy: boolean; run: (fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const v = b.venue
  const started = b.status === 'in_progress'
  const waiting = b.status === 'partially_checked_in'
  const can = (a: string) => b.actions.includes(a as never)
  return (
    <div className="space-y-4">
      <Card tone={started ? 'brand' : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone="confirmed">
              <Check size={12} /> {started ? 'Your date has started' : waiting ? "You're checked in" : 'Confirmed'}
            </Badge>
            <h2 className="mt-3 font-serif text-[24px] text-warm-900">{v?.name}</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl bg-warm-50 px-3.5 py-3">
            <CalendarDays size={17} className="flex-shrink-0 text-brand-600" />
            <div>
              <div className="text-[13.5px] font-semibold text-warm-900">{b.dateOn ? longDate(b.dateOn) : ''}</div>
              <div className="text-[11.5px] text-warm-500">{b.time ? formatSlotLabel(b.time) : ''}</div>
            </div>
          </div>
          <a href={v?.mapUrl ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-warm-50 px-3.5 py-3">
            <MapPin size={17} className="flex-shrink-0 text-brand-600" />
            <div>
              <div className="text-[13.5px] font-semibold text-warm-900">{v?.address}</div>
              <div className="text-[11.5px] font-semibold text-brand-700">Open the map</div>
            </div>
          </a>
        </div>
        {waiting && <p className="mt-3 text-[13.5px] text-warm-600">{b.partnerCheckedIn ? '' : `${b.partner.username} has not arrived yet.`}</p>}
        {b.partnerLateNote && <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-700">{b.partner.username} is running about {b.partnerLateNote} minutes late.</p>}
        {v?.offer && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-100 bg-[linear-gradient(135deg,var(--am0),#FFF9EE)] px-3.5 py-3">
            <Gift size={18} className="flex-shrink-0 text-amber-600" />
            <div>
              <div className="text-[12px] font-bold text-amber-600">ChoiceMi offer</div>
              <div className="text-[12.5px] text-warm-700">{v.offer}. Each of you pays for yourself; the venue applies the offer.</div>
            </div>
          </div>
        )}
      </Card>

      {!started && !b.me.checkedInAt && b.qr && (
        <Card>
          <div className="text-center">
            <div className="text-[13px] font-bold uppercase tracking-widest text-warm-400">Show this when you arrive</div>
            <div className="mt-4">
              <Qr value={b.qr} />
            </div>
            <p className="mt-4 text-[13px] text-warm-600">It works from 30 minutes before to 30 minutes after the start, and only once. Staff scan it; we never track your location.</p>
            {b.bookingCode && (
              <div className="mt-4 rounded-2xl bg-warm-50 px-4 py-3.5">
                <div className="text-[12px] text-warm-500">If a scan fails, tell staff your username and this code</div>
                <div className="mt-1 text-[12.5px] font-semibold text-warm-700">{useStore.getState().user.username || 'your username'}</div>
                <div className="mt-1 font-mono text-[30px] font-bold tracking-[0.35em] text-warm-900">{b.bookingCode}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {v && v.photos.length > 0 && (
        <Card>
          <div className="mb-3 text-[13px] font-bold uppercase tracking-widest text-warm-400">Finding the place</div>
          <div className="grid grid-cols-2 gap-3">
            {v.photos.map((p) => (
              <figure key={p.slot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} className="aspect-[4/3] w-full rounded-xl bg-warm-100 object-cover" />
                <figcaption className="mt-1 text-[12px] text-warm-500">{p.label}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-warm-500">
            {v.stepFree === true ? 'Step-free entrance. ' : v.stepFree === false ? 'The entrance has steps. ' : ''}
            {v.accessibleToilet === true ? 'Accessible toilet.' : ''}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2.5">
        {can('late') && (
          <>
            <Button variant="secondary" size="sm" block={false} disabled={busy} onClick={() => run(() => bookingsApi.late(b.id, 10), 'They have been told.')}>
              Running about 10 min late
            </Button>
            <Button variant="secondary" size="sm" block={false} disabled={busy} onClick={() => run(() => bookingsApi.late(b.id, 15), 'They have been told.')}>
              Running about 15 min late
            </Button>
          </>
        )}
        {can('leave') && !b.me.leftAt && (
          <Button size="sm" block={false} disabled={busy} onClick={() => run(() => bookingsApi.left(b.id), 'Thanks. We hope it went well.')}>
            I&apos;ve left
          </Button>
        )}
        {can('no_show') && (
          <Button variant="danger" size="sm" block={false} disabled={busy} onClick={() => window.confirm(`Mark ${b.partner.username} as a no-show? You are free to leave.`) && run(() => bookingsApi.noShow(b.id), 'Recorded. You are free to leave.')}>
            They did not arrive
          </Button>
        )}
        {can('cancel') && (
          <Button variant="danger" size="sm" block={false} disabled={busy} onClick={() => window.confirm('Cancel this date? Cancelling less than 24 hours before counts on your record.') && run(() => bookingsApi.cancel(b.id), 'Date cancelled.')}>
            Cancel date
          </Button>
        )}
      </div>
    </div>
  )
}

/** After the date: rate it, and choose Redate or Report a concern. */
function After({ b, who, busy, run, onNext }: { b: BookingView; who: string; busy: boolean; run: (fn: () => Promise<unknown>, done?: string) => Promise<void>; onNext: () => void }) {
  const [dateRating, setDateRating] = useState(0)
  const [venueRating, setVenueRating] = useState(0)
  const [dateComment, setDateComment] = useState('')
  const [venueComment, setVenueComment] = useState('')
  const open = b.actions.includes('feedback')
  const Stars = ({ value, set, label }: { value: number; set: (n: number) => void; label: string }) => (
    <div>
      <div className="mb-1.5 text-[13.5px] font-semibold text-warm-800">{label}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => set(n)} className="p-0.5">
            <Star size={30} className={n <= value ? 'fill-amber-500 text-amber-500' : 'text-warm-300'} />
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-serif text-[22px] text-warm-900">How was it?</h2>
        {b.feedback.given ? (
          <p className="mt-2 text-[14px] text-warm-600">Thank you. Your ratings are private to ChoiceMi: {who} never sees them.</p>
        ) : open ? (
          <div className="mt-4 space-y-5">
            <Stars value={dateRating} set={setDateRating} label={`Your blind date with ${who}`} />
            <textarea className="w-full rounded-xl border border-warm-200 px-3 py-2.5 text-[14px]" rows={2} maxLength={500} placeholder="Anything to add? Only ChoiceMi sees this." value={dateComment} onChange={(e) => setDateComment(e.target.value)} />
            <Stars value={venueRating} set={setVenueRating} label={`The service at ${b.venue?.name ?? 'the venue'}`} />
            <textarea className="w-full rounded-xl border border-warm-200 px-3 py-2.5 text-[14px]" rows={2} maxLength={500} placeholder="A recommendation or observation for the venue. ChoiceMi checks it first, and the venue never sees dates or usernames." value={venueComment} onChange={(e) => setVenueComment(e.target.value)} />
            <p className="text-[12.5px] text-warm-500">A low rating is never treated as a report. If something was wrong, use Report a concern below.</p>
            <Button disabled={busy || !dateRating || !venueRating} onClick={() => run(() => bookingsApi.feedback(b.id, { dateRating, dateComment, venueRating, venueComment }), 'Thank you.')}>
              Send my ratings
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-[14px] text-warm-600">The rating window for this date has closed.</p>
        )}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="text-[15px] font-semibold text-warm-900">Redate</div>
          <p className="mt-1 text-[13px] text-warm-600">{b.redate.theirs && !b.redate.mine ? `${who} would like another date.` : 'If you both ask, you can plan another date, at any restaurant.'}</p>
          {b.redate.mine ? (
            <p className="mt-3 text-[13px] font-semibold text-warm-500">Request sent</p>
          ) : (
            <Button variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={() => run(async () => { const r = await bookingsApi.redate(b.id); if (r.mutual) onNext() }, 'Request saved.')}>
              Ask for another date
            </Button>
          )}
        </Card>
        <Card>
          <div className="text-[15px] font-semibold text-warm-900">Report a concern</div>
          <p className="mt-1 text-[13px] text-warm-600">Tell ChoiceMi if something was not right. A person reads every one.</p>
          <a href="#report" className="mt-3 inline-block text-[13.5px] font-semibold text-brand-700">
            Report a concern
          </a>
        </Card>
      </div>
    </div>
  )
}

function Over({ b, who, onNext }: { b: BookingView; who: string; onNext: () => void }) {
  const text: Record<string, string> = {
    declined: `${b.venue?.name ?? 'The venue'} cannot host this time. Plan another time or venue within your window.`,
    expired: 'These options expired before the date was booked. Nothing was sent to the venue. You can plan again.',
    closed: 'You could not settle on a date inside your window, so it has closed.',
    cancelled: b.cancelledBy === 'venue' ? `${b.venue?.name ?? 'The venue'} cancelled. We are sorry. You can plan another date.` : b.cancelledBy === 'me' ? 'You cancelled this date.' : b.cancelledBy === 'them' ? `${who} cancelled this date.` : 'This date was cancelled.',
    no_show: b.noShowIsMine === true ? `This date was recorded as a no-show on your side.` : b.noShowIsMine === false ? `${who} did not arrive. There is no penalty for you.` : 'This date was recorded as a no-show.',
  }
  const again = ['declined', 'expired', 'cancelled'].includes(b.status)
  return (
    <Card>
      <p className="text-[15px] text-warm-800">{text[b.status]}</p>
      {again && (
        <Button className="mt-4" block={false} onClick={onNext}>
          Plan another date
        </Button>
      )}
    </Card>
  )
}

/** Reachable from the moment a date is booked, and separate from any rating. */
function Report({ b }: { b: BookingView }) {
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <div id="report" className="pt-2">
      {!open && !sent && (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[13px] font-medium text-warm-500 hover:text-danger">
          <Flag size={14} /> Report a concern
        </button>
      )}
      {sent && <p className="text-[13px] text-warm-600">Thank you. We have your report and a person will read it.</p>}
      {open && (
        <Card tone="danger">
          <div className="text-[15px] font-semibold text-warm-900">What happened?</div>
          <p className="mt-1 text-[12.5px] text-warm-500">If you are in danger, call the emergency number first.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONCERNS.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <textarea className="mt-3 w-full rounded-xl border border-warm-200 px-3 py-2.5 text-[14px]" rows={3} maxLength={500} placeholder="Tell us more (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              size="sm"
              block={false}
              disabled={!category}
              onClick={async () => {
                try {
                  await bookingsApi.report(b.id, category, details)
                  setSent(true)
                  setOpen(false)
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not send the report.', 'danger')
                }
              }}
            >
              Send report
            </Button>
            <Button variant="ghost" size="sm" block={false} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
