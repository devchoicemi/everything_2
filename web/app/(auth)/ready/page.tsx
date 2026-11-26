'use client'

import { useRouter } from 'next/navigation'
import { Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DEMO_USER } from '@/lib/mock-data'
import { useStore } from '@/store'

const NEXT_STEPS = [
  'Browse profiles in Discover: no photos, just real people',
  'Read a profile fully, then answer one quick question to confirm',
  'A mutual match → propose a real blind date',
]

export default function ReadyPage() {
  const router = useRouter()
  const setAuthed = useStore((s) => s.setAuthed)

  function launch() {
    setAuthed(true)
    router.push('/discover')
  }

  return (
    <div className="cm-reveal">
      <div className="mb-6 flex h-16 w-16 animate-ring-in items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Check size={30} strokeWidth={2.5} />
      </div>

      <span className="eyebrow mb-3">You&apos;re verified</span>
      <h1 className="font-serif text-display-md text-warm-900">
        Welcome, <span className="text-gradient not-italic">{DEMO_USER.username}</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-warm-600">
        Your anonymous identity is set. It&apos;s system-generated, can&apos;t be changed, and no one
        ever sees your real name.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {(
          [
            [`${DEMO_USER.profileScore}%`, 'Profile score'],
            [<Check key="check" size={19} className="mx-auto" strokeWidth={2.5} />, 'Verified'],
            [`Tier ${DEMO_USER.trustTier}`, 'Trust level'],
          ] as [React.ReactNode, string][]
        ).map(([v, l]) => (
          <div key={l} className="rounded-2xl border border-warm-100 bg-white p-4 text-center">
            <div className="font-serif-i text-[19px] text-brand-700">{v}</div>
            <div className="mt-0.5 text-[11px] text-warm-400">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
        <ShieldCheck size={22} className="flex-shrink-0 text-brand-700" />
        <div>
          <div className="text-[14px] font-semibold text-brand-800">Tier 1: Verified member</div>
          <div className="text-[12px] text-brand-600">ID · Email · Phone · Selfie confirmed</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-warm-100 bg-white p-6">
        <div className="mb-3 text-[13px] font-semibold text-warm-700">What happens next</div>
        <ol className="space-y-3">
          {NEXT_STEPS.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                {i + 1}
              </span>
              <span className="text-[13.5px] leading-relaxed text-warm-700">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <Button className="mt-7 !py-4 text-[16px]" onClick={launch}>
        Start discovering →
      </Button>
      <p className="mt-2.5 text-center text-[12px] text-warm-400">
        You can complete more of your profile later
      </p>
    </div>
  )
}
