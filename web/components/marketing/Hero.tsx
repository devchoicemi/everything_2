import Link from 'next/link'
import { ArrowRight, CalendarHeart, EyeOff, ShieldCheck } from 'lucide-react'
import { BrandPhoto } from '@/components/ui/BrandPhoto'
import { HeroVisual } from './HeroVisual'

const TRUST = [
  { icon: EyeOff, label: 'No profile photos' },
  { icon: ShieldCheck, label: 'Every member ID-checked' },
  { icon: CalendarHeart, label: 'Real first dates' },
]

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-950 pb-16 pt-32 text-white lg:pb-24 lg:pt-44">
      <BrandPhoto name="laugh" position="60% 40%" eager className="absolute inset-0 -z-20 h-full w-full" />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(27,10,61,0.95) 0%, rgba(46,10,102,0.84) 45%, rgba(190,24,93,0.50) 100%)',
        }}
      />
      <div className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[560px] w-[560px] rounded-full bg-fuchsia-500/20 blur-3xl" />

      <div className="container relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="cm-reveal">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
            Helsinki pilot · invite only
          </span>

          <h1 className="font-serif text-display-xl">
            Dating that starts with <em className="text-gradient-light not-italic">who you are</em>, not how you look.
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/80">
            ChoiceMi is anonymous, compatibility-first blind dating. No profile photos. No endless small talk. Read the
            person, pass a quick read-check, and meet for a real first date at a partner venue.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#waitlist"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-cta px-8 py-4 text-[16px] font-bold text-white shadow-[0_10px_34px_rgba(192,38,211,0.45)] transition hover:brightness-110"
            >
              Join the waitlist
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/60 px-8 py-3.5 text-[16px] font-bold text-white transition hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[13px] text-white/75">
            {TRUST.map((t) => (
              <li key={t.label} className="flex items-center gap-2">
                <t.icon size={15} className="text-pink-300" />
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="cm-reveal-slow">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
