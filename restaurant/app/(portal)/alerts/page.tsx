'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button, PageTitle, cn } from '@/components/ui'
import { LoadState, Section, ago, useLoad } from '@/components/kit'
import { api, type Alert } from '@/lib/api'

/** The portal inbox: requests, cancellations, late guests, and the day-before list. Email and SMS carry only what needs an answer. */
export default function AlertsPage() {
  const { data, error, loading, reload } = useLoad<{ alerts: Alert[] }>('/partner/alerts')
  const unread = data?.alerts.filter((a) => !a.read).length ?? 0

  useEffect(() => {
    if (unread > 0) {
      const t = setTimeout(() => api('/partner/alerts/read', { body: {} }).catch(() => {}), 4000)
      return () => clearTimeout(t)
    }
  }, [unread])

  return (
    <div>
      <PageTitle
        title="Alerts"
        sub="Everything ChoiceMi has told you. Requests also arrive by email and SMS."
        actions={
          unread > 0 && (
            <Button variant="secondary" size="sm" onClick={async () => { await api('/partner/alerts/read', { body: {} }); await reload() }}>
              Mark all as read
            </Button>
          )
        }
      />
      <LoadState loading={loading && !data} error={error}>
        <Section>
          {data?.alerts.length === 0 && <p className="py-6 text-center text-[14px] text-ink-400">Nothing yet.</p>}
          <ul className="divide-y divide-ink-100">
            {data?.alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-4 py-4">
                <div className="flex gap-3">
                  <span className={cn('mt-2 h-2 w-2 flex-shrink-0 rounded-full', a.read ? 'bg-transparent' : 'bg-pink-500')} />
                  <div>
                    <div className="text-[14.5px] font-bold">{a.title}</div>
                    <p className="whitespace-pre-line text-[13.5px] text-ink-600">{a.body}</p>
                    {a.code === 'booking_request' && (
                      <Link href="/requests" className="mt-1 inline-block text-[13px] font-bold text-brand-700">
                        Open requests
                      </Link>
                    )}
                    {a.bookingId && a.code !== 'booking_request' && (
                      <Link href={`/bookings/${a.bookingId}`} className="mt-1 inline-block text-[13px] font-bold text-brand-700">
                        Open booking
                      </Link>
                    )}
                  </div>
                </div>
                <span className="flex-shrink-0 text-[12.5px] text-ink-400">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </LoadState>
    </div>
  )
}
