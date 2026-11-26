'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { bookingsApi, type Ticket } from '@/services/bookings'
import { useStore } from '@/store'

const CATEGORIES = [
  ['account', 'My account'],
  ['booking', 'A date or booking'],
  ['safety', 'A safety concern'],
  ['venue', 'A venue'],
  ['bug', 'Something is broken'],
  ['other', 'Something else'],
] as const

/** Write to ChoiceMi support and read the replies. */
export default function HelpPage() {
  const router = useRouter()
  const toast = useStore((s) => s.toast)
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [category, setCategory] = useState('account')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(() => bookingsApi.tickets().then((r) => setTickets(r.tickets)).catch(() => setTickets([])), [])
  useEffect(() => {
    void load()
  }, [load])

  async function send() {
    setBusy(true)
    try {
      await bookingsApi.openTicket({ category, subject, body, bookingRef: bookingRef || undefined })
      setSubject('')
      setBody('')
      setBookingRef('')
      toast('Sent. We will reply here and by email.', 'success')
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send that.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-5 py-7 lg:py-9">
      <button onClick={() => router.push('/dates')} className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700">
        <ArrowLeft size={17} /> Your dates
      </button>
      <h1 className="font-serif text-[28px] text-warm-900">Help</h1>
      <p className="mt-1 text-[14.5px] text-warm-600">Ask us anything, or tell us about a problem. If you are in danger, call the emergency number first.</p>

      <div className="mt-6 space-y-4 rounded-3xl border border-warm-100 bg-white p-5 shadow-sm sm:p-7">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-warm-700">About</span>
          <select className="w-full rounded-xl border border-warm-200 bg-white px-3 py-2.5 text-[14px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-warm-700">Subject</span>
          <input className="w-full rounded-xl border border-warm-200 px-3 py-2.5 text-[14px]" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-warm-700">What happened?</span>
          <textarea className="w-full rounded-xl border border-warm-200 px-3 py-2.5 text-[14px]" rows={4} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {(category === 'booking' || category === 'safety') && (
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-warm-700">Booking reference (optional)</span>
            <input className="w-full rounded-xl border border-warm-200 px-3 py-2.5 font-mono text-[14px]" placeholder="CM-XXXXX" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
          </label>
        )}
        <Button disabled={busy || subject.trim().length < 3 || body.trim().length < 5} onClick={send}>
          {busy ? 'Sending…' : 'Send to ChoiceMi'}
        </Button>
      </div>

      <h2 className="mb-3 mt-9 text-[12px] font-bold uppercase tracking-widest text-warm-400">Your requests</h2>
      {tickets && tickets.length === 0 && <p className="text-[14px] text-warm-500">You have not written to us yet.</p>}
      <ul className="space-y-3">
        {tickets?.map((t) => (
          <li key={t.id} className="rounded-2xl border border-warm-100 bg-white p-4 shadow-sm">
            <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <div>
                <div className="text-[14.5px] font-semibold text-warm-900">{t.subject}</div>
                <div className="text-[12px] text-warm-400">
                  {t.ref}
                  {t.unseen_replies > 0 && <span className="ml-2 font-bold text-pink-600">New reply</span>}
                </div>
              </div>
              <Badge tone={t.status === 'resolved' || t.status === 'closed' ? 'neutral' : 'pending'}>{t.status.replace('_', ' ')}</Badge>
            </button>
            {open === t.id && <Thread id={t.id} onSent={load} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Thread({ id, onSent }: { id: string; onSent: () => void }) {
  const toast = useStore((s) => s.toast)
  const [data, setData] = useState<Awaited<ReturnType<typeof bookingsApi.ticket>> | null>(null)
  const [text, setText] = useState('')
  const load = useCallback(() => bookingsApi.ticket(id).then(setData).catch(() => {}), [id])
  useEffect(() => {
    void load()
  }, [load])
  if (!data) return <div className="mt-3 h-10 animate-pulse-soft rounded-xl bg-warm-100" />
  return (
    <div className="mt-4 space-y-2">
      {data.messages.map((m) => (
        <div key={m.id} className={'rounded-xl px-3.5 py-2.5 text-[13.5px] ' + (m.author_kind === 'staff' ? 'bg-brand-50' : 'bg-warm-50')}>
          <div className="mb-0.5 text-[11.5px] font-bold text-warm-500">{m.author_kind === 'staff' ? 'ChoiceMi' : m.author_kind === 'system' ? 'ChoiceMi system' : 'You'}</div>
          <p className="whitespace-pre-wrap text-warm-800">{m.body}</p>
        </div>
      ))}
      {data.ticket.status !== 'closed' && (
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded-xl border border-warm-200 px-3 py-2 text-[14px]" placeholder="Reply" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
          <Button
            block={false}
            size="sm"
            disabled={!text.trim()}
            onClick={async () => {
              try {
                await bookingsApi.replyTicket(id, text)
                setText('')
                await load()
                onSent()
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not send that.', 'danger')
              }
            }}
          >
            Send
          </Button>
        </div>
      )}
    </div>
  )
}
