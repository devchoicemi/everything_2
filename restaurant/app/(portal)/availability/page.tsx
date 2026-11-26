'use client'

import { HoursEditor } from '@/components/HoursEditor'
import { WithOnboarding } from '@/components/OnboardingParts'
import { PageTitle } from '@/components/ui'
import { useSession } from '@/lib/session'
import { Alert } from '@/components/ui'

export default function AvailabilityPage() {
  const { me } = useSession()
  return (
    <div>
      <PageTitle title="Hours and slots" sub="When guests can book you. Changes apply to new bookings; dates already confirmed stay as they are." />
      {me?.staffRole !== 'owner' && <Alert tone="info" className="mb-5">Only the owner can change opening hours and slots.</Alert>}
      <WithOnboarding>
        <HoursEditor />
      </WithOnboarding>
    </div>
  )
}
