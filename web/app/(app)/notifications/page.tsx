'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { bookingsApi, type Notice } from '@/services/bookings'

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 2) return 'just now'
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

/** What ChoiceMi has told me about my dates, newest first. Push notifications carry the same words. */
export default function NotificationsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Notice[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    bookingsApi
      .notifications()
      .then((r) => {
        setItems(r.notifications)
        if (r.unread > 0) setTimeout(() => bookingsApi.markRead().catch(() => {}), 2500)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your updates.'))
  }, [])

  return (
    <div className="mx-auto max-w-[720px] px-5 py-7 lg:py-9">
      <button onClick={() => router.push('/dates')} className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700">
        <ArrowLeft size={17} /> Your dates
      </button>
      <h1 className="font-serif text-[28px] text-warm-900">Updates</h1>
      {error && <p className="mt-6 text-warm-600">{error}</p>}
      {!items && !error && <div className="mt-6 h-[200px] animate-pulse-soft rounded-3xl bg-warm-100" />}
      {items && items.length === 0 && <p className="mt-6 text-[14.5px] text-warm-500">Nothing yet. We will tell you here when something happens with a date.</p>}
      <ul className="mt-6 space-y-3">
        {items?.map((n) => {
          const inner = (
            <div className={'flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm ' + (n.read ? 'border-warm-100' : 'border-brand-200')}>
              <span className={'mt-2 h-2 w-2 flex-shrink-0 rounded-full ' + (n.read ? 'bg-transparent' : 'bg-pink-500')} />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold text-warm-900">{n.title}</div>
                <p className="mt-0.5 text-[13.5px] text-warm-600">{n.body}</p>
              </div>
              <span className="flex-shrink-0 text-[12px] text-warm-400">{ago(n.at)}</span>
            </div>
          )
          return <li key={n.id}>{n.bookingId ? <Link href={`/booking?id=${n.bookingId}`}>{inner}</Link> : inner}</li>
        })}
      </ul>
    </div>
  )
}
