'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import { Alert, Button, TextArea, cn } from '@/components/ui'
import { LoadState, Pill, Section, dateTime, label, useAction, useLoad } from '@/components/kit'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

interface Detail {
  ticket: {
    id: string
    ref: string
    subject: string
    category: string
    status: string
    priority: string
    source: string
    requester_kind: string
    requester_id: string | null
    requester: string | null
    requester_email: string | null
    assignee_id: string | null
    assignee: string | null
    booking_ref: string | null
    booking_id: string | null
    venue: string | null
    breached: boolean
    created_at: string
    first_response_due_at: string
    first_response_at: string | null
  }
  messages: { id: string; author_kind: string; internal: boolean; body: string; created_at: string; author: string | null }[]
  events: { at: string; event: string; actor: string | null; meta: Record<string, unknown> | null }[]
}
interface Directory {
  staff: { id: string; username: string; roleLabel: string }[]
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useSession()
  const { data, error, loading, reload } = useLoad<Detail>(`/admin/support/${id}`)
  const dir = useLoad<Directory>('/admin/staff/directory')
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [solve, setSolve] = useState(false)
  const act = useAction(reload)
  const canReply = can('support.reply')
  const t = data?.ticket

  async function send() {
    const ok = await act.run(() => api(`/admin/support/${id}/reply`, { body: { body, internal, ...(solve && !internal ? { status: 'resolved' } : {}) } }))
    if (ok) {
      setBody('')
      setSolve(false)
    }
  }
  const update = (patch: Record<string, unknown>) => act.run(() => api(`/admin/support/${id}/update`, { body: patch }))

  return (
    <div>
      <Link href="/support" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Helpdesk
      </Link>
      <LoadState loading={loading && !data} error={error}>
        {t && data && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <div className="mb-5">
                <div className="text-[12.5px] font-semibold text-ink-400">{t.ref}</div>
                <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{t.subject}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill value={t.status} />
                  <Pill value={t.priority} />
                  {t.breached && <span className="text-[12.5px] font-bold text-danger">Past the first-reply deadline</span>}
                </div>
              </div>

              <div className="space-y-3">
                {data.messages.map((m) => (
                  <div key={m.id} className={cn('rounded-2xl border p-4', m.internal ? 'border-saffron-100 bg-saffron-50' : m.author_kind === 'staff' ? 'border-brand-100 bg-brand-50/60' : 'border-ink-200/70 bg-white')}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="flex items-center gap-1.5 font-bold text-ink-800">
                        {m.internal && <Lock size={13} className="text-saffron-600" />}
                        {m.author_kind === 'system' ? 'ChoiceMi system' : (m.author ?? (m.author_kind === 'staff' ? 'Staff' : 'Deleted account'))}
                        {m.internal && <span className="font-semibold text-saffron-600">internal note</span>}
                      </span>
                      <span className="text-ink-400">{dateTime(m.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-800">{m.body}</p>
                  </div>
                ))}
              </div>

              {canReply && t.status !== 'closed' && (
                <Section className="mt-6" title="Reply">
                  <TextArea label={internal ? 'Internal note (the requester never sees this)' : 'Message to the requester'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px] text-ink-600">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note
                    </label>
                    {!internal && (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={solve} onChange={(e) => setSolve(e.target.checked)} /> Mark as solved
                      </label>
                    )}
                  </div>
                  {act.error && <Alert className="mt-3">{act.error}</Alert>}
                  <Button className="mt-4" onClick={send} disabled={act.busy || !body.trim()}>
                    {act.busy ? 'Sending…' : internal ? 'Add note' : 'Send reply'}
                  </Button>
                </Section>
              )}
            </div>

            <aside className="space-y-4">
              <Section title="Requester">
                <div className="text-[14.5px] font-bold">{t.requester ?? 'Deleted account'}</div>
                <div className="text-[13px] text-ink-500">{t.requester_kind === 'partner' ? 'Restaurant partner' : 'Member'}</div>
                {t.requester_email && can('users.read') && <div className="mt-1 break-all text-[13px] text-ink-600">{t.requester_email}</div>}
                {t.venue && <div className="mt-1 text-[13px] text-ink-600">{t.venue}</div>}
                {t.requester_id && can('users.read') && (
                  <Link href={`/users/${t.requester_id}`} className="mt-3 inline-block text-[13px] font-semibold text-brand-700">
                    Open account
                  </Link>
                )}
                {t.booking_ref && can('bookings.read') && (
                  <div className="mt-2 text-[13px]">
                    Booking{' '}
                    <Link href={`/bookings/${t.booking_id}`} className="font-semibold text-brand-700">
                      {t.booking_ref}
                    </Link>
                  </div>
                )}
              </Section>

              {canReply && (
                <Section title="Handle">
                  <label className="label">Owner</label>
                  <select className="input" value={t.assignee_id ?? ''} disabled={act.busy} onChange={(e) => update({ assignee: e.target.value || null })}>
                    <option value="">Nobody</option>
                    {dir.data?.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.username} · {s.roleLabel}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => update({ assignee: 'me' })} disabled={act.busy}>
                    Assign to me
                  </Button>
                  <label className="label mt-3">Priority</label>
                  <select className="input" value={t.priority} disabled={act.busy} onChange={(e) => update({ priority: e.target.value })}>
                    {['urgent', 'high', 'normal', 'low'].map((p) => (
                      <option key={p} value={p}>
                        {label(p)}
                      </option>
                    ))}
                  </select>
                  <label className="label mt-3">Status</label>
                  <select className="input" value={t.status} disabled={act.busy} onChange={(e) => update({ status: e.target.value })}>
                    {['open', 'waiting_customer', 'resolved', 'closed'].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Section>
              )}

              <Section title="Timing">
                <dl className="space-y-1.5 text-[13px]">
                  <Row k="Opened" v={dateTime(t.created_at)} />
                  <Row k="First reply due" v={dateTime(t.first_response_due_at)} />
                  <Row k="First reply" v={t.first_response_at ? dateTime(t.first_response_at) : 'Not yet'} />
                </dl>
                <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wider text-ink-400">History</h3>
                <ul className="space-y-1 text-[12.5px] text-ink-500">
                  {data.events.map((e, i) => (
                    <li key={i}>
                      {dateTime(e.at)} · {label(e.event)}
                      {e.actor ? ` · ${e.actor}` : ''}
                    </li>
                  ))}
                </ul>
              </Section>
            </aside>
          </div>
        )}
      </LoadState>
    </div>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-ink-500">{k}</dt>
    <dd className="text-right font-semibold text-ink-800">{v}</dd>
  </div>
)
