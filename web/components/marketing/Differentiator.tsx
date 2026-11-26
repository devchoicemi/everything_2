import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BrandPhoto } from '@/components/ui/BrandPhoto'
import { EyeOff, MessagesSquare, ScanFace, Timer } from 'lucide-react'

const OLD_WAY = [
  { icon: ScanFace, t: 'Judged on photos', d: 'Six pictures decide everything in half a second.' },
  { icon: MessagesSquare, t: 'Weeks of texting', d: 'Conversations that fizzle before you ever meet.' },
  { icon: Timer, t: 'Endless swiping', d: 'Optimised to keep you scrolling, not to get you off the app.' },
]

const CHOICEMI_WAY = [
  { icon: EyeOff, t: 'Judged on substance', d: 'Words, values and answers give a real sense of a person.' },
  { icon: MessagesSquare, t: 'No chat, just meet', d: 'The first real conversation happens face to face.' },
  { icon: Timer, t: 'A few, considered choices', d: 'A daily handful of genuinely compatible profiles.' },
]

export function Differentiator() {
  return (
    <section className="bg-warm-50 py-22">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow mb-4">Why we&apos;re different</span>
          <h2 className="font-serif text-display-lg text-warm-900">
            Modern dating apps are built to keep you swiping.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-warm-600">
            ChoiceMi is built to get you on a good date and out the door.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <ScrollReveal className="rounded-2xl border border-warm-200 bg-white/60 p-8">
            <div className="mb-6 text-[13px] font-bold uppercase tracking-widest text-warm-400">
              The usual way
            </div>
            <ul className="space-y-6">
              {OLD_WAY.map((r) => (
                <li key={r.t} className="flex gap-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warm-100 text-warm-500">
                    <r.icon size={20} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-warm-800">{r.t}</div>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-warm-500">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          <ScrollReveal delay={0.08} className="relative isolate overflow-hidden rounded-2xl border border-brand-200 p-8 text-white shadow-xl">
            <BrandPhoto name="cafe" position="35% 45%" className="absolute inset-0 -z-20 h-full w-full" />
            <div
              className="absolute inset-0 -z-10"
              style={{ background: 'linear-gradient(160deg, rgba(27,10,61,0.93), rgba(87,20,184,0.88) 55%, rgba(192,38,211,0.82))' }}
            />
            <div className="mb-6 text-[13px] font-bold uppercase tracking-widest text-brand-200">
              The ChoiceMi way
            </div>
            <ul className="space-y-6">
              {CHOICEMI_WAY.map((r) => (
                <li key={r.t} className="flex gap-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                    <r.icon size={20} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold">{r.t}</div>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-white/70">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
