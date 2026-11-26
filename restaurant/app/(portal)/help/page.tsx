'use client'

import { useState } from 'react'
import { Alert, Button, Field, PageTitle, TextArea } from '@/components/ui'
import { LoadState, Pill, Section, Table, Td, Tr, ago, dateTime, label, useAction, useLoad } from '@/components/kit'
import { api, type Ticket } from '@/lib/api'

interface Thread {
  ticket: { id: string; ref: string; subject: string; status: string }
  messages: { id: string; author_kind: string; body: string; created_at: string }[]
}

/** Write to ChoiceMi support, and read the replies. */
export default function HelpPage() {
  const { data, error, loading, reload } = useLoad<{ tickets: Ticket[] }>('/support/tickets')
  const [open, setOpen] = useState<string | null>(null)
  const [category, setCategory] = useState('venue')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const act = useAction(reload)

  return (
    <div>
      <PageTitle title="Help" sub="Ask ChoiceMi a question, or tell us about a problem. For an emergency, call the emergency number first." />
      <div className="space-y-6">
        <Section title="Write to ChoiceMi">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div>
              <label className="label">About</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="venue">My venue or hours</option>
                <option value="booking">A booking</option>
                <option value="safety">A safety concern</option>
                <option value="account">My account</option>
                <option value="bug">Something is broken</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <Field label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </div>
          <div className="mt-4">
            <TextArea label="What happened?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} hint="Include the booking reference if it is about a booking." />
          </div>
          {act.error && <Alert className="mt-3">{act.error}</Alert>}
          <Button className="mt-4" disabled={act.busy || subject.trim().length < 3 || body.trim().length < 5} onClick={async () => { if (await act.run(() => api('/support/tickets', { body: { category, subject, body } }))) { setSubject(''); setBody('') } }}>
            Send
          </Button>
        </Section>

        <Section title="Your requests">
          <LoadState loading={loading && !data} error={error}>
            <Table head={['Request', 'Status', 'Last activity']} empty="You have not written to us yet.">
              {data?.tickets.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <button className="text-left font-semibold text-ink-900 hover:text-brand-700" onClick={() => setOpen(open === t.id ? null : t.id)}>
                      {t.subject}
                    </button>
                    <div className="text-[12px] text-ink-400">
                      {t.ref} · {label(t.category)}
                      {t.unseen_replies > 0 && <span className="ml-2 font-bold text-pink-600">New reply</span>}
                    </div>
                    {open === t.id && <ThreadView id={t.id} onSent={reload} />}
                  </Td>
                  <Td>
                    <Pill value={t.status} />
                  </Td>
                  <Td className="text-ink-500">{ago(t.last_activity_at)}</Td>
                </Tr>
              ))}
            </Table>
          </LoadState>
        </Section>
      </div>
    </div>
  )
}

function ThreadView({ id, onSent }: { id: string; onSent: () => void }) {
  const { data, reload } = useLoad<Thread>(`/support/tickets/${id}`)
  const [text, setText] = useState('')
  const act = useAction(async () => {
    await reload()
    onSent()
  })
  if (!data) return <p className="mt-3 text-[13px] text-ink-400">Loading…</p>
  return (
    <div className="mt-3 space-y-2">
      {data.messages.map((m) => (
        <div key={m.id} className={`rounded-xl px-3.5 py-2.5 text-[13.5px] ${m.author_kind === 'staff' ? 'bg-brand-50' : 'bg-ink-100/70'}`}>
          <div className="mb-0.5 text-[11.5px] font-bold text-ink-500">
            {m.author_kind === 'staff' ? 'ChoiceMi' : m.author_kind === 'system' ? 'ChoiceMi system' : 'You'} · {dateTime(m.created_at)}
          </div>
          <p className="whitespace-pre-wrap text-ink-800">{m.body}</p>
        </div>
      ))}
      {data.ticket.status !== 'closed' && (
        <div className="flex gap-2">
          <input className="input" placeholder="Reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
          <Button size="sm" disabled={act.busy || !text.trim()} onClick={async () => { if (await act.run(() => api(`/support/tickets/${id}/reply`, { body: { body: text } }))) setText('') }}>
            Send
          </Button>
        </div>
      )}
      {act.error && <Alert>{act.error}</Alert>}
    </div>
  )
}
