'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { FeedbackForm } from '@/components/dates/FeedbackForm'
import { LIVE } from '@/lib/live'
import { dateService } from '@/services/api'
import { useStore } from '@/store'
import type { DateBooking } from '@/types'

export default function FeedbackView({ params }: { params: { id: string } }) {
  const router = useRouter()
  useEffect(() => {
    if (LIVE) router.replace('/dates')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const stored = useStore((s) =>
    [...s.bookings.past, ...s.bookings.upcoming, ...s.bookings.pending].find((b) => String(b.id) === params.id),
  )
  // a real date opened directly (a reload) is fetched from the server
  const [fetched, setFetched] = useState<DateBooking | null>(null)
  const [loading, setLoading] = useState(LIVE && !stored)
  const booking = stored ?? fetched ?? undefined

  useEffect(() => {
    if (!LIVE || stored) return
    let cancelled = false
    dateService
      .bookings()
      .then((b) => !cancelled && setFetched([...b.past, ...b.upcoming, ...b.pending].find((x) => String(x.id) === params.id) ?? null))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  return (
    <div className="mx-auto max-w-3xl px-5 py-7 lg:px-10 lg:py-9">
      <button
        onClick={() => router.push('/dates')}
        className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700"
      >
        <ArrowLeft size={17} /> Back to dates
      </button>

      <PageHeader title="How did it go?" subtitle="Your feedback shapes both trust scores and future matches" />

      {loading ? (
        <div className="h-[360px] animate-pulse-soft rounded-3xl bg-warm-100" />
      ) : booking ? (
        <FeedbackForm booking={booking} />
      ) : (
        <div className="rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center">
          <p className="text-[15px] text-warm-500">That date wasn&apos;t found.</p>
          <Button block={false} className="mt-4" onClick={() => router.push('/dates')}>
            Back to dates
          </Button>
        </div>
      )}
    </div>
  )
}
