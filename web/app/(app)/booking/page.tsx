'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BookingFlow } from '@/components/booking/BookingFlow'
import { bookingsApi } from '@/services/bookings'

/** One booking, by its id (?id=) or by the match it belongs to (?match=). A query string, not a path, so it also works in the static export. */
function Inner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id')
  const match = params.get('match')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (id || !match) return
    let off = false
    bookingsApi
      .forMatch(match)
      .then((r) => (off ? undefined : r.booking ? router.replace(`/booking?id=${r.booking.id}`) : setMissing(true)))
      .catch(() => !off && setMissing(true))
    return () => {
      off = true
    }
  }, [id, match, router])

  return (
    <div className="mx-auto max-w-[760px] px-5 py-7 lg:px-10 lg:py-9">
      <button onClick={() => router.push('/dates')} className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700">
        <ArrowLeft size={17} /> Your dates
      </button>
      {id ? (
        <BookingFlow id={id} />
      ) : missing || !match ? (
        <div className="rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center">
          <p className="text-[15px] text-warm-600">There is no date to plan with this match right now.</p>
          <Button block={false} className="mt-5" onClick={() => router.push('/matches')}>
            Back to matches
          </Button>
        </div>
      ) : (
        <div className="h-[300px] animate-pulse-soft rounded-3xl bg-warm-100" />
      )}
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}
