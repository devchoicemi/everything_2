'use client'

import { useState } from 'react'
import { Alert, Button, PageTitle } from '@/components/ui'
import { LoadState, Section, dateTime, label, useAction, useLoad } from '@/components/kit'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Res {
  comments: { booking_id: string; user_id: string; ref: string; venue: string | null; venue_rating: number; venue_comment: string; created_at: string }[]
  reports: { id: string; booking_id: string; ref: string; category: string; details: string; created_at: string; reporter: string }[]
  lowRatedDaters: { rated: string; n: number; average: string }[]
  minRatings: number
}

export default function ModerationPage() {
  const { data, error, loading, reload } = useLoad<Res>('/admin/moderation')
  const act = useAction(reload)
  return (
    <div>
      <PageTitle title="Moderation" sub="Concerns raised by daters, and comments that wait for a check before a venue sees them." />
      <LoadState loading={loading && !data} error={error}>
        {act.error && <Alert className="mb-4">{act.error}</Alert>}
        <div className="space-y-6">
          <Section title={`Concerns (${data?.reports.length ?? 0})`} sub="A dater used Report a concern. Each one also opened an urgent helpdesk ticket.">
            {data?.reports.length === 0 && <p className="text-[14px] text-ink-400">No open concerns.</p>}
            <ul className="divide-y divide-ink-100">
              {data?.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <div className="text-[14px] font-semibold text-ink-900">
                      {label(r.category)} ·{' '}
                      <Link href={`/bookings/${r.booking_id}`} className="font-mono text-brand-700">
                        {r.ref}
                      </Link>
                    </div>
                    <div className="text-[13px] text-ink-500">
                      Reported by {r.reporter} · {dateTime(r.created_at)}
                    </div>
                    {r.details && <p className="mt-1 text-[13.5px] text-ink-700">{r.details}</p>}
                  </div>
                  <Button variant="secondary" size="sm" disabled={act.busy} onClick={() => act.run(() => api(`/admin/moderation/report/${r.id}`, { body: {} }))}>
                    Mark handled
                  </Button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Venue comments to check (${data?.comments.length ?? 0})`} sub={`A venue sees an average after ${data?.minRatings ?? 5} ratings, and only comments you approve, without dates or usernames.`}>
            {data?.comments.length === 0 && <p className="text-[14px] text-ink-400">Nothing waiting.</p>}
            <ul className="divide-y divide-ink-100">
              {data?.comments.map((c) => (
                <CommentRow key={`${c.booking_id}${c.user_id}`} c={c} busy={act.busy} onDecide={(action, clean) => act.run(() => api('/admin/moderation/comment', { body: { bookingId: c.booking_id, userId: c.user_id, action, clean } }))} />
              ))}
            </ul>
          </Section>

          <Section title="Daters with low ratings" sub="Date ratings are for staff only and never shown to the person rated.">
            {data?.lowRatedDaters.length === 0 && <p className="text-[14px] text-ink-400">Nobody is under 3.0.</p>}
            <ul className="divide-y divide-ink-100">
              {data?.lowRatedDaters.map((d) => (
                <li key={d.rated} className="flex justify-between py-2.5 text-[14px]">
                  <span className="font-semibold">{d.rated}</span>
                  <span className="text-ink-500">
                    {d.average} average from {d.n} {d.n === 1 ? 'date' : 'dates'}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </LoadState>
    </div>
  )
}

function CommentRow({ c, busy, onDecide }: { c: Res['comments'][number]; busy: boolean; onDecide: (a: 'approve' | 'hide', clean?: string) => void }) {
  const [text, setText] = useState(c.venue_comment)
  return (
    <li className="py-3">
      <div className="text-[13px] text-ink-500">
        {c.venue ?? 'Venue'} · {c.venue_rating}/5 · {c.ref} · {dateTime(c.created_at)}
      </div>
      <textarea className="input mt-1.5 min-h-[70px] text-[14px]" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <p className="mt-1 text-[12px] text-ink-400">Edit out dates, names and usernames before approving. The venue sees what is in the box.</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => onDecide('approve', text)}>
          Approve
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => onDecide('hide')}>
          Hide
        </Button>
      </div>
    </li>
  )
}
