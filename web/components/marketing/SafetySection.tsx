import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BadgeCheck, Fingerprint, MapPinned, MessageSquareWarning, ShieldCheck, UserCheck } from 'lucide-react'

const POINTS = [
  { icon: Fingerprint, t: 'Verified identity', d: 'Every member completes an identity check before they can use ChoiceMi.' },
  { icon: UserCheck, t: 'Liveness-checked selfie', d: 'A one-time check confirms a real person is behind the account. The photo is never shown.' },
  { icon: MapPinned, t: 'Public partner venues only', d: 'First dates are booked at vetted cafés and restaurants. You choose the place and time.' },
  { icon: MessageSquareWarning, t: 'Two-way safety feedback', d: 'Both people rate every date. Repeated no-shows or bad behaviour lose access fast.' },
]

export function SafetySection() {
  return (
    <section id="safety" className="scroll-mt-24 bg-brand-950 py-22 text-white">
      <div className="container grid items-start gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <ScrollReveal>
          <span className="eyebrow mb-4 text-brand-300">Safety &amp; trust</span>
          <h2 className="font-serif text-display-lg">
            Zero fake profiles. That is the whole point.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-white/70">
            Because every member is identity-verified, there is no catfishing, no bots and no
            burner accounts. You always know you are talking to a real, local person.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
            <BadgeCheck size={22} className="text-brand-300" />
            <div className="text-[13px] leading-snug text-white/80">
              <strong className="text-white">Every member verified</strong>
              <br />
              Identity checked before first use
            </div>
          </div>
        </ScrollReveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <ScrollReveal
              key={p.t}
              delay={i * 0.07}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                <p.icon size={20} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{p.t}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/60">{p.d}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>

      <div className="container mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-t border-white/10 pt-10 text-[13px] text-white/50">
        <span className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-brand-400" /> GDPR-compliant · data minimised
        </span>
        <span>Real name never shown to other users</span>
        <span>No messaging at all, so nothing to abuse</span>
      </div>
    </section>
  )
}
