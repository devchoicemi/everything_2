import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BrandPhoto } from '@/components/ui/BrandPhoto'
import { BookOpenCheck, CalendarHeart, ShieldCheck, Sparkles } from 'lucide-react'

const STEPS = [
  {
    icon: ShieldCheck,
    t: 'Verify once, for real',
    d: 'A one-time identity check confirms every member is a real adult. Your real name is never shown to anyone.',
  },
  {
    icon: Sparkles,
    t: 'Build a profile of words',
    d: 'A headline, a short bio, lifestyle tags and answers to compatibility questions. No pictures. The writing is what attracts a match.',
  },
  {
    icon: BookOpenCheck,
    t: 'Read, then like',
    d: 'Open a profile, read it fully, and answer one question drawn from it. You cannot like someone you did not actually read.',
  },
  {
    icon: CalendarHeart,
    t: 'Match and meet',
    d: 'A mutual match leads straight to a blind date proposal at a partner venue. First conversation, in person.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-white py-22">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow mb-4">How ChoiceMi works</span>
          <h2 className="font-serif text-display-lg text-warm-900">Four steps from sign-up to a real first date</h2>
        </ScrollReveal>

        <div className="mt-14 grid items-stretch gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <ScrollReveal className="relative isolate min-h-[360px] overflow-hidden rounded-[36px] shadow-xl">
            <BrandPhoto name="dinner" position="38% 40%" className="absolute inset-0 -z-20 h-full w-full" />
            <div
              className="absolute inset-0 -z-10"
              style={{
                background:
                  'linear-gradient(180deg, rgba(27,10,61,0.05) 35%, rgba(46,10,102,0.55) 70%, rgba(27,10,61,0.92) 100%)',
              }}
            />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
                The first date
              </span>
              <p className="mt-3 max-w-[22rem] font-serif text-[24px] leading-snug">
                The first real conversation happens across a table, not a screen.
              </p>
            </div>
          </ScrollReveal>

          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <ScrollReveal
                key={s.t}
                delay={i * 0.08}
                className="feature-card !p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-cta text-white shadow-[0_8px_20px_rgba(192,38,211,0.30)]">
                    <s.icon size={22} />
                  </span>
                  <span className="font-serif-i text-[34px] leading-none text-warm-200">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 font-serif text-[20px] text-warm-900">{s.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-warm-600">{s.d}</p>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
