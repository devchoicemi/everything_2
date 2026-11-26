'use client'

import { Check } from 'lucide-react'
import type { Onboarding } from '@/lib/api'
import { cn } from '@/components/ui'

/** "Your application": the required items and whether each is done. */
export function Checklist({ ob }: { ob: Onboarding }) {
  const items = ob.checklist.filter((c) => c.stage === 'apply')
  return (
    <div className="card p-5">
      <h2 className="text-[15px] font-extrabold">Your application</h2>
      <ul className="mt-3 space-y-2 text-[14px]">
        {items.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3">
            <span className={cn(c.done ? 'text-ink-800' : 'text-ink-500')}>
              {c.label}
              {!c.required && <span className="text-ink-300"> · optional</span>}
            </span>
            {c.done ? <Check size={16} className="text-ok-600" strokeWidth={3} /> : <span className="text-[12.5px] font-bold text-saffron-600">{c.required ? 'Needed' : ''}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

import { OnboardingProvider, useOnboarding } from '@/lib/onboarding'

function Gate({ children }: { children: React.ReactNode }) {
  const { ob, error } = useOnboarding()
  if (error) return <p className="py-10 text-center text-danger">{error}</p>
  if (!ob) return <p className="py-10 text-center text-[14px] text-ink-500">Loading…</p>
  return <>{children}</>
}

/** Pages in the portal that edit the same details as the application share its loader. */
export function WithOnboarding({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <Gate>{children}</Gate>
    </OnboardingProvider>
  )
}
