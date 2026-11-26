'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Alert, Button, Field } from '@/components/ui'
import { LoadState, Pill, Section, Table, Td, Tr, dateOnly, dateTime, label, useAction, useLoad } from '@/components/kit'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

interface Detail {
  user: { id: string; email: string; username: string; role: string; status: string; emailVerified: boolean; identityVerified: boolean; lastSignIn: string | null; joined: string; activeSessions: number }
  sections: string[]
  identity?: { provider: string; idp: string | null; over18: boolean; verified_at: string } | null
  kycCases?: { id: string; status: string; reason: string; decision_note: string; created_at: string }[]
  bookings?: { id: string; ref: string; status: string; kind: string; date_on: string | null; start_time: string | null; venue: string | null }[]
  dateStats?: { dates: number; no_shows: number; late_cancels: number }
  tickets?: { id: string; ref: string; subject: string; status: string; priority: string; created_at: string }[]
  venues?: { id: string; name: string; review_status: string; status: string; role: string }[]
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const { data, error, loading, reload } = useLoad<Detail>(`/admin/users/${id}`)
  const [reason, setReason] = useState('')
  const [caseReason, setCaseReason] = useState('')
  const act = useAction(reload)
  const u = data?.user
  const manage = can('users.manage') && u?.role !== 'admin'

  return (
    <div>
      <Link href="/users" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Members & venues
      </Link>
      <LoadState loading={loading && !data} error={error}>
        {u && data && (
          <div className="space-y-5">
            <div>
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{u.username}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-ink-600">
                <Pill value={u.status} />
                <span>{label(u.role)}</span>
                <span>· {u.email}</span>
                <span>· joined {dateOnly(u.joined)}</span>
                <span>· last sign-in {u.lastSignIn ? dateTime(u.lastSignIn) : 'never'}</span>
                <span>
                  · {u.activeSessions} signed-in {u.activeSessions === 1 ? 'device' : 'devices'}
                </span>
              </div>
            </div>

            {manage && (
              <Section title="Account" sub="Everything you do here is recorded in the activity log.">
                {act.error && <Alert className="mb-3">{act.error}</Alert>}
                <div className="flex flex-wrap items-end gap-3">
                  {u.status === 'active' ? (
                    <>
                      <div className="min-w-[260px] flex-1">
                        <Field label="Reason for suspending (required)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                      </div>
                      <Button variant="danger" disabled={act.busy || !reason.trim()} onClick={() => act.run(() => api(`/admin/users/${id}/status`, { body: { status: 'suspended', reason } }))}>
                        Suspend account
                      </Button>
                    </>
                  ) : (
                    <Button disabled={act.busy} onClick={() => act.run(() => api(`/admin/users/${id}/status`, { body: { status: 'active' } }))}>
                      Reactivate account
                    </Button>
                  )}
                  <Button variant="secondary" disabled={act.busy || u.activeSessions === 0} onClick={() => act.run(() => api(`/admin/users/${id}/sign-out`, { body: {} }))}>
                    Sign out everywhere
                  </Button>
                </div>
              </Section>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {data.sections.includes('kyc') && (
                <Section title="Identity check" actions={can('kyc.read') && <Link href="/kyc" className="text-[13px] font-semibold text-brand-700">Identity checks</Link>}>
                  {data.identity ? (
                    <dl className="space-y-1 text-[14px]">
                      <Line k="Verified" v={dateTime(data.identity.verified_at)} />
                      <Line k="Method" v={data.identity.provider === 'manual' ? 'Checked by staff' : `${data.identity.provider}${data.identity.idp ? ` (${data.identity.idp})` : ''}`} />
                      <Line k="18 or older" v={data.identity.over18 ? 'Yes' : 'No'} />
                    </dl>
                  ) : (
                    <p className="text-[14px] text-ink-500">{u.identityVerified ? 'Verified.' : 'Not verified yet.'}</p>
                  )}
                  {can('kyc.decide') && (u.role === 'member' || u.role === 'tester') && !data.kycCases?.some((c) => c.status === 'open') && (
                    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-ink-100 pt-3">
                      <div className="min-w-[200px] flex-1">
                        <Field label="Open a case (needs a person to look at it)" value={caseReason} onChange={(e) => setCaseReason(e.target.value)} maxLength={300} />
                      </div>
                      <Button variant="secondary" disabled={act.busy || !caseReason.trim()} onClick={() => act.run(() => api('/admin/kyc/cases', { body: { userId: id, reason: caseReason } })).then(() => setCaseReason(''))}>
                        Open case
                      </Button>
                    </div>
                  )}
                  {data.kycCases && data.kycCases.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-[13px]">
                      {data.kycCases.map((c) => (
                        <li key={c.id}>
                          <Pill value={c.status} /> {c.reason} <span className="text-ink-400">· {dateOnly(c.created_at)}</span>
                          {c.decision_note && <div className="text-ink-500">{c.decision_note}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              {data.sections.includes('venue') && data.venues && (
                <Section title="Venues">
                  <ul className="space-y-2 text-[14px]">
                    {data.venues.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3">
                        <Link href={`/venues/${v.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                          {v.name}
                        </Link>
                        <span className="flex gap-1.5">
                          <Pill value={v.review_status} />
                          <span className="text-[12.5px] text-ink-400">{v.role}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {data.sections.includes('bookings') && (
                <Section title="Dates" sub={data.dateStats ? `${data.dateStats.dates} dates held · ${data.dateStats.no_shows} no-shows · ${data.dateStats.late_cancels} late cancellations` : undefined} className="lg:col-span-2">
                  <Table head={['Booking', 'Venue', 'When', 'Status']} empty="No bookings yet.">
                    {data.bookings?.map((b) => (
                      <Tr key={b.id}>
                        <Td>
                          <Link href={`/bookings/${b.id}`} className="font-mono font-semibold text-brand-700">
                            {b.ref}
                          </Link>
                        </Td>
                        <Td>{b.venue ?? '—'}</Td>
                        <Td>{b.date_on ? `${b.date_on} ${b.start_time ?? ''}` : '—'}</Td>
                        <Td>
                          <Pill value={b.status} />
                        </Td>
                      </Tr>
                    ))}
                  </Table>
                </Section>
              )}

              {data.sections.includes('support') && (
                <Section title="Helpdesk tickets" className="lg:col-span-2">
                  <Table head={['Ticket', 'Status', 'Priority', 'Opened']} empty="No tickets.">
                    {data.tickets?.map((t) => (
                      <Tr key={t.id}>
                        <Td>
                          <Link href={`/support/${t.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                            {t.subject}
                          </Link>
                          <div className="text-[12px] text-ink-400">{t.ref}</div>
                        </Td>
                        <Td>
                          <Pill value={t.status} />
                        </Td>
                        <Td>
                          <Pill value={t.priority} />
                        </Td>
                        <Td>{dateOnly(t.created_at)}</Td>
                      </Tr>
                    ))}
                  </Table>
                </Section>
              )}
            </div>
          </div>
        )}
      </LoadState>
    </div>
  )
}

const Line = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-ink-500">{k}</dt>
    <dd className="font-semibold text-ink-800">{v}</dd>
  </div>
)
