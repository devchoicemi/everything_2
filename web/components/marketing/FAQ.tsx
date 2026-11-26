'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

const QA = [
  {
    q: 'Why are there no photos?',
    a: 'Photos make attraction a snap judgement and push everything else to the background. Removing them means people are chosen for how they think, what they value and how they live. Those are the things that actually determine whether a relationship works.',
  },
  {
    q: 'How does verification work?',
    a: 'You verify your identity once when you sign up. It confirms you are a real adult, so every profile you read belongs to a real person. We only store what we need, and your real name is never shown to other members.',
  },
  {
    q: 'What is the read-check quiz?',
    a: 'Before you can like someone, you answer one multiple-choice question that comes from our question pool, which they answered about themselves. It takes seconds if you read the profile and is impossible to guess if you did not. Free members get three attempts per profile; Plus members get unlimited.',
  },
  {
    q: 'Can I chat with a match before meeting?',
    a: 'No. ChoiceMi is completely text-free: there is no chat and no messages, before a date or after it. You choose, you do not type. The first real conversation happens in person, at the venue. It sounds bold, but it is the fastest way to know if there is chemistry.',
  },
  {
    q: 'What happens on a match?',
    a: 'You see a full compatibility breakdown and can propose a date: pick a day, a time and a partner venue. Your match has 48 hours to accept. Once confirmed, it lands in both calendars with the venue details and any ChoiceMi offer.',
  },
  {
    q: 'Is ChoiceMi only in Helsinki?',
    a: 'For now, yes. The pilot is Helsinki-only so we can vet venues, tune matching and keep the community tight. Other Finnish cities follow once the pilot proves out.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="scroll-mt-24 bg-warm-50 py-22">
      <div className="container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <ScrollReveal>
          <span className="eyebrow mb-4">Questions</span>
          <h2 className="font-serif text-display-lg text-warm-900">
            The things everyone asks first
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-warm-600">
            Still curious? Write to{' '}
            <a href="mailto:hello@choicemi.fi" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
              hello@choicemi.fi
            </a>
            .
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
          {QA.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q} className="faq-item">
                <button className="faq-q" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  {item.q}
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-warm-200 bg-white text-warm-700">
                    {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                  </span>
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-6 pr-10 text-[15px] leading-relaxed text-warm-600">{item.a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </ScrollReveal>
      </div>
    </section>
  )
}
