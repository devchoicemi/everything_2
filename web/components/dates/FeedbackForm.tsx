'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { FEEDBACK_QUESTIONS } from '@/lib/questions'
import { LIVE } from '@/lib/live'
import { dateService } from '@/services/api'
import { useStore } from '@/store'
import type { DateBooking } from '@/types'

export function FeedbackForm({ booking }: { booking: DateBooking }) {
  const router = useRouter()
  const toast = useStore((s) => s.toast)
  const [stars, setStars] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const wantsRedate = answers.redate === 'Yes, definitely' || answers.redate === 'Maybe'

  function rate(n: number) {
    setStars(n)
    if (n >= 4) toast('Great, glad the date went well!', 'success')
    else if (n === 3) toast('Thanks for the honest rating')
    else toast('Sorry to hear that. Your feedback helps us improve')
  }

  async function submit() {
    if (Object.keys(answers).length < 3) {
      toast('Please answer at least 3 questions', 'danger')
      return
    }
    if (LIVE && stars < 1) {
      toast('Please give a star rating', 'danger')
      return
    }
    try {
      await dateService.submitFeedback({ dateId: booking.id, stars: stars || 3, answers })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your feedback.', 'danger')
      return
    }
    toast('Feedback saved, thank you. This improves your future matches.', 'success')
    setTimeout(() => router.push('/dates'), 600)
  }

  async function askRedate() {
    if (!LIVE) return toast(`Re-date request sent to ${booking.un}`)
    try {
      const out = await dateService.requestRedate(booking.id)
      toast(out.mutual ? 'You both want another date. Propose one from your dates.' : `Re-date request sent to ${booking.un}`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the request.', 'danger')
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-sm">
        <div className="flex items-center gap-4 bg-[linear-gradient(155deg,var(--t0),transparent_70%)] p-6">
          <Avatar letter={booking.av} color={booking.avc} size={52} />
          <div>
            <div className="font-serif-i text-[19px] text-warm-900">Date with {booking.un}</div>
            <div className="mt-0.5 text-[13px] text-warm-500">
              {booking.date} · {booking.venue}
            </div>
          </div>
        </div>
        <div className="border-t border-warm-100 p-6">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-warm-400">
            Overall experience
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => rate(n)}
                className={cn('star', n <= stars && 'on')}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star size={34} fill={n <= stars ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-warm-100 bg-white p-6 shadow-sm sm:p-7">
        <div className="grid gap-6 sm:grid-cols-2">
          {FEEDBACK_QUESTIONS.map((fq) => (
            <div key={fq.key}>
              <div className="mb-2.5 text-[14px] font-semibold leading-snug text-warm-900">{fq.q}</div>
              <div className="flex flex-wrap gap-2">
                {fq.opts.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [fq.key]: o }))}
                    className={cn('fb-opt', answers[fq.key] === o && 'on')}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[12.5px] leading-snug text-warm-400">
          ChoiceMi is text-free: you answer by choosing, never by typing, before or after a date.
        </p>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Button className="sm:flex-1" onClick={submit}>
            Submit feedback
          </Button>
          {wantsRedate && (
            <Button
              variant="secondary"
              className="sm:flex-1"
              onClick={askRedate}
            >
              Request a re-date →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
