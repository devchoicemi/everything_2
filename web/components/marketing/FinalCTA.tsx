import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BrandPhoto } from '@/components/ui/BrandPhoto'
import { WaitlistForm } from '@/components/common/WaitlistForm'

export function FinalCTA() {
  return (
    <section className="bg-white py-22">
      <div className="container">
        <ScrollReveal className="relative isolate overflow-hidden rounded-[40px] px-8 py-16 text-center text-white sm:px-16 sm:py-20">
          <BrandPhoto name="toast" position="45% 30%" className="absolute inset-0 -z-20 h-full w-full" />
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                'linear-gradient(160deg, rgba(27,10,61,0.90) 0%, rgba(87,20,184,0.80) 55%, rgba(236,72,153,0.66) 100%)',
            }}
          />
          <span className="mb-5 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] backdrop-blur-md">
            Helsinki pilot
          </span>
          <h2 className="mx-auto max-w-2xl font-serif text-display-lg">Your next first date is a real one.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-white/80">
            Join the waitlist and we will tell you the moment ChoiceMi opens. Verify once, then start reading real
            people.
          </p>
          <div id="waitlist" className="mx-auto mt-9 max-w-[520px] scroll-mt-24">
            <WaitlistForm tone="dark" />
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full border-2 border-white/60 px-7 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/10"
            >
              Create your profile
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white/85 transition hover:text-white"
            >
              Take a look around
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
