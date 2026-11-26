import Link from 'next/link'
import { Check, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-warm-50">
      {/* brand panel */}
      <aside className="relative hidden w-[42%] max-w-[560px] flex-col justify-between overflow-hidden bg-brand-sheen p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full bg-brand-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-2xl" />

        <Link href="/" className="relative">
          <Logo size={36} tone="light" />
        </Link>

        <div className="relative">
          <h2 className="font-serif text-display-md">
            Dating that starts with who you are.
          </h2>
          <ul className="mt-8 space-y-3 text-[15px] text-white/85">
            {[
              'Profiles are words only, never photos',
              'Every member is identity-checked',
              'Matches meet in person at partner venues',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check size={13} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-white/60">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-brand-300" /> ID verified
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-brand-300" /> No photos, ever
          </span>
          <span>Helsinki pilot</span>
        </div>
      </aside>

      {/* content */}
      {/* min-w-0 overrides the flex item's default min-width:auto — without it, any
          wide min-content child deep inside (e.g. a horizontally-scrolling pill row)
          forces this whole column past the viewport instead of scrolling internally. */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:hidden">
          <Link href="/">
            <Logo size={32} />
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 pb-16 pt-2 sm:px-8 lg:items-center lg:pt-0">
          <div className="w-full max-w-[520px]">{children}</div>
        </div>
      </main>
    </div>
  )
}
