'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { Alert, Button, Field, cn } from '@/components/ui'
import { LoadState, Pill, Section, dateTime, label, useAction, useLoad } from '@/components/kit'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

interface Packet {
  venue: Record<string, any>
  photos: { slot: number; status: string; reject_reason: string; width: number; height: number; bytes: number; checks: Record<string, unknown>; taken_on: string | null; url: string }[]
  owner: string | null
}

const ITEMS = [
  { key: 'name', label: 'Venue name matches the street sign' },
  { key: 'business_id', label: 'Business ID found in the trade register (YTJ)' },
  { key: 'location', label: 'Map pin matches the entrance photo' },
  { key: 'hours', label: 'Opening hours and date slots' },
  { key: 'contact', label: 'Contact person, email and phone' },
  { key: 'photo1', label: 'Photo 1: outside view' },
  { key: 'photo2', label: 'Photo 2: the entrance, name readable' },
  { key: 'photo3', label: 'Photo 3: inside, looking in' },
  { key: 'photo4', label: 'Photo 4: inside, looking back' },
  { key: 'offer', label: 'ChoiceMi offer' },
] as const

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
type Verdict = { ok: true } | { ok: false; reason: string }

export default function VenueReviewPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const { data, error, loading, reload } = useLoad<Packet>(`/admin/venues/${id}`)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict | undefined>>({})
  const [note, setNote] = useState('')
  const act = useAction(reload)

  const v = data?.venue
  const failed = useMemo(() => ITEMS.filter((i) => verdicts[i.key] && !verdicts[i.key]!.ok), [verdicts])
  const allDone = ITEMS.every((i) => verdicts[i.key])
  const canDecide = can('venues.review') && v?.review_status === 'submitted'

  const decide = (decision: 'approve' | 'send_back') => act.run(() => api(`/admin/venues/${id}/review`, { body: { decision, note, items: verdicts } }))

  return (
    <div>
      <Link href="/venues" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Venues
      </Link>
      <LoadState loading={loading && !data} error={error}>
        {v && data && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-5">
              <div>
                <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{v.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill value={v.review_status} />
                  {v.went_live_at && <Pill value={v.status} />}
                  <span className="text-[13px] text-ink-500">Owner: {data.owner ?? '—'}</span>
                </div>
              </div>

              <Section title="Business">
                <dl className="grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
                  <Row k="Kind" v={v.kind || '—'} />
                  <Row k="Neighbourhood" v={v.area || '—'} />
                  <Row k="Business ID" v={v.business_id ?? '—'} mono />
                  <Row k="Register says" v={v.ytj ? (v.ytj.found ? `${v.ytj.name ?? ''} · ${v.ytj.form ?? ''} · ${v.ytj.status ?? ''}` : v.ytj.unavailable ? 'Register could not be reached: check by hand' : 'Not found in the register') : 'Not looked up'} />
                </dl>
                {v.ytj && !v.ytj.found && <Alert tone="warn" className="mt-3">{v.ytj.unavailable ? 'The trade register was not available when this was saved.' : 'This Business ID is not in the register.'}</Alert>}
                {v.description && <p className="mt-3 text-[14px] text-ink-600">{v.description}</p>}
              </Section>

              <Section title="Location">
                <p className="text-[14px] text-ink-800">{v.formatted_address ?? 'No location picked'}</p>
                {v.lat != null && (
                  <a className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=18/${v.lat}/${v.lng}`}>
                    Open the pin on the map <ExternalLink size={14} />
                  </a>
                )}
                <p className="mt-1 text-[12.5px] text-ink-400">
                  {v.place_provider === 'google' ? 'Picked from Google Maps' : 'Picked from OpenStreetMap'}
                  {v.place_id ? ` · place ${v.place_id}` : ''}
                </p>
              </Section>

              <Section title="Photos" sub="Check each against the brief: landscape, at least 1600 px, no faces, no filters, taken in the last 12 months.">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((slot) => {
                    const p = data.photos.find((x) => x.slot === slot)
                    return (
                      <figure key={slot} className="overflow-hidden rounded-xl border border-ink-200/70">
                        {p ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${p.url}?v=${p.bytes}`} alt={`Photo ${slot}`} className="aspect-[4/3] w-full bg-ink-100 object-cover" />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-ink-100 text-[13px] text-ink-400">Missing</div>
                        )}
                        <figcaption className="p-3 text-[12.5px] text-ink-500">
                          <b className="text-ink-800">Photo {slot}</b>
                          {p && (
                            <>
                              {' '}
                              · {p.width} × {p.height} · {(p.bytes / 1_048_576).toFixed(1)} MB · {p.taken_on ? `taken ${p.taken_on}` : 'date unknown'}
                              {p.reject_reason && <div className="font-semibold text-danger">{p.reject_reason}</div>}
                            </>
                          )}
                        </figcaption>
                      </figure>
                    )
                  })}
                </div>
              </Section>

              <Section title="Hours and slots">
                <ul className="space-y-1 text-[14px]">
                  {DAYS.map((d, i) => {
                    const h = v.hours?.[String(i)]
                    return (
                      <li key={d} className="flex justify-between gap-4 border-b border-ink-100 py-1.5 last:border-0">
                        <span className="text-ink-600">{d}</span>
                        <span className="font-semibold">{h ? `${h.open} – ${h.close}` : 'Closed'}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-3 text-[13.5px] text-ink-600">
                  Date start times: <b>{(v.slot_times ?? []).join(', ') || 'none'}</b> · up to <b>{v.capacity}</b> dates per start time
                </p>
              </Section>

              <Section title="Contact, offer and access">
                <dl className="grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
                  <Row k="Contact person" v={`${v.contact_name} · ${v.contact_role}`} />
                  <Row k="Email" v={`${v.contact_email}${v.contact_email_verified_at ? ' ✓ verified' : ' (not verified)'}`} />
                  <Row k="Booking phone" v={`${v.booking_phone}${v.booking_phone_verified_at ? ' ✓ verified' : ' (not verified)'}`} />
                  <Row k="Offer" v={v.offer || '—'} />
                  <Row k="Step-free entrance" v={v.step_free == null ? '—' : v.step_free ? 'Yes' : 'No'} />
                  <Row k="Accessible toilet" v={v.accessible_toilet == null ? '—' : v.accessible_toilet ? 'Yes' : 'No'} />
                  <Row k="Price level" v={v.price_level ? '€'.repeat(v.price_level) : '—'} />
                  <Row k="Terms accepted" v={v.terms_accepted_at ? dateTime(v.terms_accepted_at) : 'No'} />
                  <Row k="Photos for marketing" v={v.marketing_photos ? 'Yes' : 'No'} />
                </dl>
              </Section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
              <Section title="Review" sub={canDecide ? 'Mark every item, with a reason for anything that fails.' : `Status: ${label(v.review_status)}`}>
                {v.review?.items && !canDecide && (
                  <ul className="mb-3 space-y-1.5 text-[13px]">
                    {Object.entries(v.review.items as Record<string, Verdict>).map(([k, x]) => (
                      <li key={k} className={x.ok ? 'text-ok-600' : 'text-danger'}>
                        {x.ok ? '✓' : '✗'} {ITEMS.find((i) => i.key === k)?.label ?? k}
                        {!x.ok && <span className="block text-ink-600">{x.reason}</span>}
                      </li>
                    ))}
                    {v.review.note && <li className="text-ink-600">{String(v.review.note)}</li>}
                  </ul>
                )}
                {canDecide && (
                  <>
                    <ul className="space-y-3">
                      {ITEMS.map((i) => {
                        const x = verdicts[i.key]
                        return (
                          <li key={i.key}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[13.5px] font-semibold text-ink-800">{i.label}</span>
                              <span className="flex flex-shrink-0 gap-1">
                                <button type="button" aria-label="Passes" aria-pressed={x?.ok === true} onClick={() => setVerdicts({ ...verdicts, [i.key]: { ok: true } })} className={cn('rounded-full p-1.5', x?.ok === true ? 'bg-ok-50 text-ok-600' : 'text-ink-300 hover:text-ok-600')}>
                                  <CheckCircle2 size={19} />
                                </button>
                                <button type="button" aria-label="Fails" aria-pressed={x?.ok === false} onClick={() => setVerdicts({ ...verdicts, [i.key]: { ok: false, reason: x && !x.ok ? x.reason : '' } })} className={cn('rounded-full p-1.5', x?.ok === false ? 'bg-danger-50 text-danger' : 'text-ink-300 hover:text-danger')}>
                                  <XCircle size={19} />
                                </button>
                              </span>
                            </div>
                            {x && !x.ok && <input className="input mt-1.5 !py-1.5 text-[13.5px]" placeholder="What needs to change?" value={x.reason} onChange={(e) => setVerdicts({ ...verdicts, [i.key]: { ok: false, reason: e.target.value } })} />}
                          </li>
                        )
                      })}
                    </ul>
                    <div className="mt-4">
                      <Field label="Note to the venue (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                    </div>
                    {act.error && <Alert className="mt-3">{act.error}</Alert>}
                    <div className="mt-4 grid gap-2">
                      <Button onClick={() => decide('approve')} disabled={act.busy || !allDone || failed.length > 0}>
                        <Check size={16} /> Approve
                      </Button>
                      <Button variant="danger" onClick={() => decide('send_back')} disabled={act.busy || failed.length === 0 || failed.some((f) => !(verdicts[f.key] as { reason: string }).reason.trim())}>
                        Send back with reasons
                      </Button>
                    </div>
                  </>
                )}
                {!canDecide && v.review_status === 'submitted' && <p className="text-[13px] text-ink-500">Your role can view this application but not decide it.</p>}
                {v.review_status === 'approved' && (
                  <p className="mt-2 text-[13px] text-ink-500">
                    Go-live steps: device {v.device_ready_at ? '✓' : '—'} · staff briefed {v.staff_briefed_at ? '✓' : '—'} · test booking {v.test_done_at ? '✓' : '—'}
                  </p>
                )}
              </Section>
            </aside>
          </div>
        )}
      </LoadState>
    </div>
  )
}

const Row = ({ k, v, mono }: { k: string; v: string; mono?: boolean }) => (
  <div>
    <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-400">{k}</dt>
    <dd className={cn('text-ink-800', mono && 'font-mono text-[13.5px]')}>{v}</dd>
  </div>
)
