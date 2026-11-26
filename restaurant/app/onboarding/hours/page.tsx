'use client'

import { useRouter } from 'next/navigation'
import { HoursEditor } from '@/components/HoursEditor'
import { Button } from '@/components/ui'

export default function HoursStep() {
  const router = useRouter()
  return (
    <div>
      <HoursEditor
        footer={(save, saving, locked) => (
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="lg" onClick={() => router.push('/onboarding')}>
              Back
            </Button>
            <Button size="lg" disabled={saving || locked} onClick={async () => (await save()) && router.push('/onboarding/photos')}>
              {saving ? 'Saving…' : 'Save and continue'}
            </Button>
          </div>
        )}
      />
    </div>
  )
}
