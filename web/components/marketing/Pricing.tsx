import Link from 'next/link'
import { Check } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { cn } from '@/lib/utils'

const TIERS = [
  {
    name: 'Free',
    price: '€0',
    tagline: 'Everything you need to meet someone.',
    features: [
      '5 profiles a day',
      '3 read-check attempts per profile',
      'Full compatibility scores',
      'Propose and confirm dates',
      'Identity verification',
    ],
    cta: 'Start free',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Plus',
    price: '€8.99',
    per: '/ month',
    tagline: 'More reach, more control.',
    features: [
      'Everything in Free',
      '15 profiles a day',
      'See who liked you first',
      'Unlimited read-check retries',
      'Advanced filters',
      'Undo your last pass',
    ],
    cta: 'Choose Plus',
    href: '/signup',
    highlight: true,
  },
  {
    name: 'Elite',
    price: '€19.99',
    per: '/ month',
    tagline: 'For people who are serious about this.',
    features: [
      'Everything in Plus',
      'Curated weekly hand-matches',
      'Priority date-slot booking',
      'Profile review by our team',
      'Concierge venue booking',
    ],
    cta: 'Choose Elite',
    href: '/signup',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 bg-white py-22">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow mb-4">Pricing</span>
          <h2 className="font-serif text-display-lg text-warm-900">
            Free to meet someone. Paid to move faster.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-warm-600">
            Paid tiers launch at the end of the Helsinki pilot. Pilot members keep Plus free for their
            first three months.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <ScrollReveal
              key={t.name}
              delay={i * 0.08}
              className={cn(
                'relative rounded-3xl border p-8 transition',
                t.highlight
                  ? 'border-brand-600 bg-brand-sheen text-white shadow-xl lg:-mt-4 lg:mb-4'
                  : 'border-warm-200 bg-white',
              )}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-8 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}
              <div className={cn('text-[14px] font-bold uppercase tracking-widest', t.highlight ? 'text-brand-200' : 'text-warm-400')}>
                {t.name}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="font-serif text-display-md">{t.price}</span>
                {t.per && (
                  <span className={cn('pb-1.5 text-[13px]', t.highlight ? 'text-white/60' : 'text-warm-400')}>
                    {t.per}
                  </span>
                )}
              </div>
              <p className={cn('mt-1 text-[14px]', t.highlight ? 'text-white/70' : 'text-warm-500')}>
                {t.tagline}
              </p>

              <Link
                href={t.href}
                className={cn(
                  'mt-6 flex items-center justify-center rounded-full px-5 py-3.5 text-[14px] font-semibold transition',
                  t.highlight
                    ? 'bg-white text-brand-800 hover:bg-warm-75'
                    : 'bg-brand-cta text-white hover:brightness-110',
                )}
              >
                {t.cta}
              </Link>

              <ul className="mt-7 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px]">
                    <Check
                      size={16}
                      strokeWidth={2.5}
                      className={cn('mt-0.5 flex-shrink-0', t.highlight ? 'text-brand-300' : 'text-brand-600')}
                    />
                    <span className={t.highlight ? 'text-white/85' : 'text-warm-700'}>{f}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
