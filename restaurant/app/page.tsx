import { CalendarCheck, Clock, EyeOff, Gift, QrCode, Users } from 'lucide-react'
import { MarketingFooter, MarketingHeader } from '@/components/Marketing'
import { ButtonLink } from '@/components/ui'

const STEPS = [
  { n: '1', title: 'Set up your venue', body: 'Add your details and your offer. Choose the days, start times and how many tables you can give to ChoiceMi dates.' },
  { n: '2', title: 'Couples book you', body: 'Two people who matched on compatibility pick a day, a time and a venue. Confirmed bookings appear in your portal.' },
  { n: '3', title: 'Welcome them with a code', body: 'When the guests arrive they show a short code. Enter it, they are checked in, and you give them your offer.' },
]

const CONTROLS = [
  { icon: Clock, title: 'Your hours', body: 'Pick the weekdays and the start times you take dates, between 12:00 and 19:00. Close a day or a single time whenever you need to.' },
  { icon: Users, title: 'Your tables', body: 'Say how many tables each time can hold. When they are taken, that time stops being offered. Nobody can overbook you.' },
  { icon: Gift, title: 'Your offer', body: 'Write the welcome you give ChoiceMi guests: a free coffee, a pastry, a share off the bill. It is yours to change.' },
  { icon: CalendarCheck, title: 'Your team', body: 'Invite colleagues. Everyone can see bookings and check guests in; only owners change opening times and settings.' },
]

const FAQ = [
  { q: 'What do I see about the guests?', a: 'Two anonymous names and a booking reference. No photos, no phone numbers, no email addresses. ChoiceMi verifies the identity of every member before they can book, and keeps that private.' },
  { q: 'When can couples book?', a: 'Dates start between 12:00 and 19:00, at fixed times: 12:00, 13:30, 15:00, 16:30, 18:00 and 19:00. You choose which of those you offer.' },
  { q: 'What if I need to close, or a table is not free?', a: 'Close a whole day or one time from the Availability page. If a booking already exists you can call it off, and the couple see it as cancelled and can choose another venue.' },
  { q: 'How do guests claim the offer?', a: 'Each confirmed date has a short code that only the two guests can see. They show it, you type it in, and the booking is marked as arrived and the offer as claimed.' },
  { q: 'What if they do not turn up?', a: 'Twenty minutes after their time you can mark a no-show. It keeps your numbers honest and is shown only to you.' },
  { q: 'What does it cost, and how do I join?', a: 'Tell us about your venue and a person at ChoiceMi will write to you. We are opening in Helsinki in small groups and approve partner venues one by one.' },
]

export default function Landing() {
  return (
    <div>
      <MarketingHeader />
      <main>
        {/* hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-brand-200/60 blur-3xl" />
          <div className="pointer-events-none absolute -left-40 top-40 h-[380px] w-[380px] rounded-full bg-saffron-100/80 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div className="cm-rise">
              <span className="eyebrow">ChoiceMi for restaurants</span>
              <h1 className="mt-4 text-[44px] font-extrabold leading-[1.04] tracking-tight sm:text-[58px]">
                Fill your quiet afternoons with <span className="text-gradient">first dates.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink-600">
                ChoiceMi matches people on compatibility, with no photos and no small talk. Matched couples then meet in person at a partner restaurant or café. Be one of the places they choose.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/apply" size="lg">
                  Start your application the pilot
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg">
                  Partner sign-in
                </ButtonLink>
              </div>
              <p className="mt-5 text-[13.5px] text-ink-500">Helsinki pilot. Partner venues are approved one by one.</p>
            </div>

            {/* a picture of the portal's own booking list */}
            <div className="cm-rise [animation-delay:.12s]" aria-hidden>
              <div className="card rotate-1 p-5 shadow-lift">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-widest text-ink-400">Today</div>
                    <div className="text-[17px] font-extrabold">Saturday 17 October</div>
                  </div>
                  <span className="rounded-full bg-ok-50 px-3 py-1 text-[12px] font-bold text-ok-600">3 bookings</span>
                </div>
                {[
                  { t: '13:30', g: 'Cedar_Mist & River_Ash', s: 'Arrived', tone: 'bg-ok-50 text-ok-600' },
                  { t: '15:00', g: 'Storm_Pine & Maple_Dusk', s: 'Upcoming', tone: 'bg-brand-100 text-brand-800' },
                  { t: '18:00', g: 'Birch_Storm & Aspen_Glow', s: 'Upcoming', tone: 'bg-brand-100 text-brand-800' },
                ].map((b) => (
                  <div key={b.t} className="mb-2.5 flex items-center gap-3 rounded-xl border border-ink-100 bg-paper px-4 py-3 last:mb-0">
                    <div className="w-12 text-[15px] font-extrabold">{b.t}</div>
                    <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-700">{b.g}</div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${b.tone}`}>{b.s}</span>
                  </div>
                ))}
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-saffron-50 px-4 py-3 text-[13px] text-saffron-600">
                  <QrCode size={17} /> Guest code entered: offer claimed
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-3 max-w-2xl text-[34px] font-extrabold leading-tight tracking-tight">Three steps, and nothing to install.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-7">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-[16px] font-extrabold text-white">{s.n}</div>
                <h3 className="text-[19px] font-extrabold">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* what the venue controls */}
        <section className="bg-ink-950 py-16 text-white">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-brand-300">You stay in charge</span>
            <h2 className="mt-3 max-w-2xl text-[34px] font-extrabold leading-tight tracking-tight">Dates fit around your business, not the other way round.</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {CONTROLS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                  <Icon size={22} className="text-brand-300" />
                  <h3 className="mt-4 text-[19px] font-extrabold">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* privacy */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="card flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
              <EyeOff size={26} />
            </div>
            <div>
              <h2 className="text-[24px] font-extrabold tracking-tight">Guests stay anonymous to you, too.</h2>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-600">
                You see two anonymous names, the time and a booking reference. Nothing else about the guests is shared with the venue. Every ChoiceMi member is identity-checked before they can book, so the people at your table are who they say they are.
              </p>
            </div>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
          <span className="eyebrow">Questions</span>
          <h2 className="mt-3 text-[34px] font-extrabold leading-tight tracking-tight">What restaurants ask us</h2>
          <div className="mt-8 divide-y divide-ink-200/80 rounded-2xl border border-ink-200/70 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-bold">
                  {f.q}
                  <span className="text-[22px] font-light text-ink-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* closing call */}
        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-ink-950 px-8 py-14 text-center text-white sm:px-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
            <h2 className="relative mx-auto max-w-2xl text-[34px] font-extrabold leading-tight tracking-tight">Want first dates at your tables?</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[16px] text-white/70">Tell us about your venue. A person at ChoiceMi reads every request and writes back.</p>
            <div className="relative mt-8">
              <ButtonLink href="/apply" size="lg">
                Start your application the pilot
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
