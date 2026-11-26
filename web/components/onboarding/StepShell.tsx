'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function StepShell({
  step,
  total,
  label,
  title,
  back,
  children,
}: {
  step: number
  total: number
  label: string
  title: string
  back: string
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="cm-reveal">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push(back)}
          className="flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700"
        >
          <ArrowLeft size={17} /> Back
        </button>
        <span className="text-[12.5px] font-medium text-warm-400">{title}</span>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="text-[12px] font-semibold text-warm-400">
          Step {step} of {total}
        </span>
      </div>
      <div className="mb-8 flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={
              'h-1.5 flex-1 rounded-full transition-colors ' +
              (i < step ? 'bg-brand-600' : 'bg-warm-200')
            }
          />
        ))}
      </div>

      {children}
    </div>
  )
}
