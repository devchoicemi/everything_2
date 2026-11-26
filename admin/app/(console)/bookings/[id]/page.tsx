'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { LoadState, Pill, Section, Table, Td, Tr, dateTime, label, useLoad } from '@/components/kit'

interface Detail {
  booking: { id: string; ref: string; kind: string; status: string; daters: [string, string]; venue: string | null; dateOn: string | null; time: string | null; window: { from: string; to: string }; lateCancel: boolean; closedReason: string | null }
  events: { at: string; actor_type: string; event: string; from_status: string | null; to_status: string | null; meta: Record<string, unknown> | null }[]
  options: { round: number; status: string; venue: string; date_on: string; start_time: string; sent_by: string }[]
  guests: { username: string; checked_in_at: string | null; checkin_via: string | null; left_at: string | null; late_note: number | null }[]
  reports: { id: string; category: string; details: string; status: string; created_at: string; reporter: string }[]
}

export default function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading } = useLoad<Detail>(`/admin/bookings/${id}`)
  const b = data?.booking
  return (
    <div>
      <Link href="/bookings" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Booking log
      </Link>
      <LoadState loading={loading && !data} error={error}>
        {b && data && (
          <div className="space-y-5">
            <div>
              <div className="text-[12.5px] font-semibold text-ink-400">{b.kind === 'redate' ? 'Redate' : 'First date'}</div>
              <h1 className="font-mono text-[28px] font-extrabold leading-tight tracking-tight">{b.ref}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-ink-600">
                <Pill value={b.status} />
                <span>
                  {b.daters[0]} & {b.daters[1]}
                </span>
                {b.venue && <span>· {b.venue}</span>}
                {b.dateOn && (
                  <span>
                    · {b.dateOn} {b.time}
                  </span>
                )}
                <span>
                  · window {b.window.from} to {b.window.to}
                </span>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Timeline" sub="Every change, with who made it.">
                <ol className="space-y-3">
                  {data.events.map((e, i) => (
                    <li key={i} className="flex gap-3 text-[13.5px]">
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" />
                      <div>
                        <div className="font-semibold text-ink-800">
                          {label(e.event)}
                          {e.to_status && e.from_status !== e.to_status && <span className="font-normal text-ink-500"> → {label(e.to_status)}</span>}
                        </div>
                        <div className="text-[12.5px] text-ink-400">
                          {dateTime(e.at)} · {label(e.actor_type)}
                          {e.meta && Object.keys(e.meta).length > 0 && ` · ${Object.entries(e.meta).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ')}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              <div className="space-y-5">
                <Section title="Guests">
                  <Table head={['Dater', 'Checked in', 'Left', 'Late note']}>
                    {data.guests.map((g) => (
                      <Tr key={g.username}>
                        <Td className="font-semibold">{g.username}</Td>
                        <Td>{g.checked_in_at ? `${dateTime(g.checked_in_at)} (${g.checkin_via})` : '—'}</Td>
                        <Td>{g.left_at ? dateTime(g.left_at) : '—'}</Td>
                        <Td>{g.late_note ? `${g.late_note} min` : '—'}</Td>
                      </Tr>
                    ))}
                  </Table>
                </Section>
                <Section title="Options offered" sub="Rounds of three, as sent between the two daters.">
                  <Table head={['Round', 'Venue', 'When', 'From', 'Result']} empty="No options were sent.">
                    {data.options.map((o, i) => (
                      <Tr key={i}>
                        <Td>{o.round}</Td>
                        <Td>{o.venue}</Td>
                        <Td className="whitespace-nowrap">
                          {o.date_on} {o.start_time}
                        </Td>
                        <Td>{o.sent_by}</Td>
                        <Td>
                          <Pill value={o.status} />
                        </Td>
                      </Tr>
                    ))}
                  </Table>
                </Section>
                {data.reports.length > 0 && (
                  <Section title="Concerns reported">
                    <ul className="space-y-2 text-[13.5px]">
                      {data.reports.map((r) => (
                        <li key={r.id}>
                          <b>{label(r.category)}</b> · {r.reporter} · {dateTime(r.created_at)} · <Pill value={r.status === 'open' ? 'open' : 'resolved'} text={label(r.status)} />
                          {r.details && <div className="text-ink-600">{r.details}</div>}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            </div>
          </div>
        )}
      </LoadState>
    </div>
  )
}
