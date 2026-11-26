import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BrandPhoto } from '@/components/ui/BrandPhoto'

const SHOWN = [
  'Anonymous username, age, city and intent',
  'A headline and a short, honest bio',
  'Lifestyle tags and preferred date style',
  'Compatibility score across five dimensions',
  'Their actual answers to personality questions',
]

const COMPAT = [
  { d: 'Personality fit', p: 91 },
  { d: 'Lifestyle fit', p: 88 },
  { d: 'Values fit', p: 85 },
  { d: 'Date style fit', p: 95 },
]

export function NoPhotoShowcase() {
  return (
    <section id="no-photos" className="scroll-mt-24 bg-warm-50 py-22">
      <div className="container grid items-center gap-14 lg:grid-cols-2">
        <ScrollReveal>
          <span className="eyebrow mb-4">The no-photo rule</span>
          <h2 className="font-serif text-display-lg text-warm-900">
            You browse who someone <em className="text-gradient not-italic">is</em>
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-warm-600">
            Every profile is text. The avatar is a single letter and a colour, never a face. It
            levels the field and puts the focus where it belongs: values, lifestyle and the way
            someone actually thinks.
          </p>
          <ul className="mt-7 space-y-3">
            {SHOWN.map((s) => (
              <li key={s} className="flex items-start gap-3 text-[15px] text-warm-700">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Check size={12} strokeWidth={3} />
                </span>
                {s}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="group mt-9 inline-flex items-center gap-2 text-[15px] font-semibold text-brand-700"
          >
            Try it in the app
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </ScrollReveal>

        <ScrollReveal delay={0.08} className="relative">
          <div className="relative isolate overflow-hidden rounded-[40px] px-6 py-12 sm:px-12">
            <BrandPhoto name="silhouette" position="50% 40%" className="absolute inset-0 -z-20 h-full w-full" />
            <div
              className="absolute inset-0 -z-10"
              style={{ background: 'linear-gradient(160deg, rgba(27,10,61,0.78), rgba(87,20,184,0.62) 55%, rgba(236,72,153,0.55))' }}
            />
          <div className="relative mx-auto max-w-[400px] overflow-hidden rounded-3xl border border-white/30 bg-white shadow-xl">
            <div className="h-1.5 bg-brand-cta" />
            <div className="bg-[linear-gradient(155deg,var(--t0),transparent_70%)] p-6">
              <div className="flex items-start gap-3.5">
                <span
                  className="font-serif-i flex h-14 w-14 items-center justify-center rounded-full text-[22px] text-white shadow-md"
                  style={{ background: '#534AB7' }}
                >
                  M
                </span>
                <div className="flex-1">
                  <div className="font-serif-i text-[20px] text-warm-900">Maple_Dusk</div>
                  <div className="text-[12px] text-warm-500">28 · Helsinki</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                      <Check size={10} /> Verified
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      Serious relationship
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif-i text-[24px] leading-none text-brand-700">87%</div>
                  <div className="text-[10px] text-warm-400">match</div>
                </div>
              </div>
              <p className="mt-4 border-t border-warm-100 pt-4 text-[13px] italic leading-relaxed text-warm-700">
                &ldquo;Finds comfort in early mornings and conversations that make you forget what time
                it is.&rdquo;
              </p>
            </div>
            <div className="space-y-3 border-t border-warm-100 p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-warm-400">
                Compatibility
              </div>
              {COMPAT.map((c) => (
                <div key={c.d}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-warm-600">{c.d}</span>
                    <span className="font-bold text-brand-700">{c.p}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-warm-100">
                    <div
                      className="cm-bar h-full rounded-full bg-brand-cta"
                      style={{ width: `${c.p}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
