'use client'

import Link from 'next/link'
import { CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { Alert, ButtonLink } from '@/components/ui'
import { dateTimeLabel } from '@/lib/format'
import { useOnboarding } from '@/lib/onboarding'

const LABEL: Record<string, string> = {
  name: 'Venue name',
  business_id: 'Business ID',
  location: 'Location',
  hours: 'Opening hours',
  contact: 'Contact person, email and phone',
  photo1: 'Photo 1, outside view',
  photo2: 'Photo 2, entrance',
  photo3: 'Photo 3, inside looking in',
  photo4: 'Photo 4, inside looking back',
  offer: 'ChoiceMi offer',
}
const FIX: Record<string, string> = { name: '/onboarding', business_id: '/onboarding', location: '/onboarding', contact: '/onboarding', hours: '/onboarding/hours', photo1: '/onboarding/photos', photo2: '/onboarding/photos', photo3: '/onboarding/photos', photo4: '/onboarding/photos', offer: '/onboarding/offer' }

/** Where the application stands: in review, sent back with reasons, or approved. */
export default function StatusPage() {
  const { ob } = useOnboarding()
  const v = ob!.venue
  const failed = Object.entries(v.review?.items ?? {}).filter(([, x]) => !x.ok)

  return (
    <div className="mx-auto max-w-2xl pt-4">
      {v.reviewStatus === 'submitted' && (
        <div className="card p-8 text-center sm:p-10">
          <Clock3 size={44} className="mx-auto text-brand-600" />
          <h1 className="mt-5 text-[30px] font-extrabold tracking-tight">Your application is with ChoiceMi</h1>
          <p className="mx-auto mt-3 max-w-md text-ink-600">A person checks your Business ID, the map pin against your entrance photo, and each photo against the brief. We write to you at {v.contact.email}, usually within a few days.</p>
          {v.submittedAt && <p className="mt-4 text-[13px] text-ink-400">Sent {dateTimeLabel(v.submittedAt)}</p>}
        </div>
      )}

      {v.reviewStatus === 'sent_back' && (
        <div className="card p-8 sm:p-10">
          <XCircle size={40} className="text-danger" />
          <h1 className="mt-4 text-[30px] font-extrabold tracking-tight">A few things to fix</h1>
          <p className="mt-2 text-ink-600">Everything else was fine. Change these and send it again.</p>
          <ul className="mt-6 space-y-3">
            {failed.map(([k, x]) => (
              <li key={k} className="rounded-xl border border-danger/30 bg-danger-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <b className="text-[14.5px]">{LABEL[k] ?? k}</b>
                  <Link href={FIX[k] ?? '/onboarding'} className="text-[13px] font-bold text-brand-700">
                    Fix this
                  </Link>
                </div>
                <p className="mt-1 text-[14px] text-ink-700">{x.reason}</p>
              </li>
            ))}
          </ul>
          {v.review?.note && <Alert tone="info" className="mt-4">{v.review.note}</Alert>}
          <ButtonLink href="/onboarding/offer" className="mt-7">
            Review and send again
          </ButtonLink>
        </div>
      )}

      {v.reviewStatus === 'approved' && (
        <div className="card p-8 text-center sm:p-10">
          <CheckCircle2 size={44} className="mx-auto text-ok-600" />
          <h1 className="mt-5 text-[30px] font-extrabold tracking-tight">You are approved</h1>
          <p className="mx-auto mt-3 max-w-md text-ink-600">Next, set up your check-in device, brief your staff and run a test booking. Then you can go live.</p>
          <ButtonLink href="/onboarding/go-live" className="mt-7">
            Get ready for your first date
          </ButtonLink>
        </div>
      )}

      {v.reviewStatus === 'draft' && (
        <div className="card p-8 text-center sm:p-10">
          <h1 className="text-[30px] font-extrabold tracking-tight">Your application is not sent yet</h1>
          <p className="mt-3 text-ink-600">You still need: {ob!.missing.join(', ') || 'to read through and send it'}.</p>
          <ButtonLink href="/onboarding" className="mt-7">
            Continue the application
          </ButtonLink>
        </div>
      )}
    </div>
  )
}
