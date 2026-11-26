import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BookOpenCheck, Compass, HeartHandshake, Home, Sparkles, Sprout } from 'lucide-react'

const DIMENSIONS = [
  { icon: Compass, t: 'Personality', d: 'Introvert or extrovert, how you handle change, how you recharge.' },
  { icon: HeartHandshake, t: 'Values', d: 'Faith, money, honesty, what you believe a relationship is for.' },
  { icon: Home, t: 'Lifestyle', d: 'Mornings vs nights, city vs quiet, health, travel, cooking.' },
  { icon: Sprout, t: 'Relationship', d: 'Conflict style, independence, how you show and receive affection.' },
  { icon: Sparkles, t: 'Future', d: 'Children, marriage, where you see yourself in five to ten years.' },
]

export function CompatibilityEngine() {
  return (
    <section className="bg-white py-22">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow mb-4">The compatibility engine</span>
          <h2 className="font-serif text-display-lg text-warm-900">
            Matched on five dimensions that actually predict a good relationship
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-warm-600">
            Your answers to 30+ questions power every match score you see, and appear on your profile
            for others to read.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DIMENSIONS.map((d, i) => (
            <ScrollReveal key={d.t} delay={i * 0.06} className="feature-card">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <d.icon size={22} />
              </span>
              <h3 className="mt-5 font-serif text-[19px] text-warm-900">{d.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-warm-600">{d.d}</p>
            </ScrollReveal>
          ))}

          <ScrollReveal delay={0.3} className="feature-card !bg-brand-sheen text-white sm:col-span-2 lg:col-span-1">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <BookOpenCheck size={22} />
            </span>
            <h3 className="mt-5 font-serif text-[19px]">The read-check</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
              One question generated from the profile you just viewed. It keeps everyone reading
              honestly. You cannot like someone you skimmed.
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
