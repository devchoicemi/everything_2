import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'The no-photo rule', href: '#no-photos' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Sign in', href: '/login' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Safety', href: '#safety' },
      { label: 'Identity verification', href: '#safety' },
      { label: 'Community guidelines', href: '#' },
      { label: 'Report a concern', href: 'mailto:admin@choicemi.com' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Contact', href: 'mailto:admin@choicemi.com' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of use', href: '/terms' },
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Cookies', href: '/privacy#cookies' },
      { label: 'Your data rights', href: '/privacy' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="relative bg-brand-950 text-white">
      <div className="h-1 bg-brand-cta" />
      <div className="container py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,0.9fr)]">
          <div>
            <Link href="/">
              <Logo size={32} tone="light" />
            </Link>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-white/60">
              Anonymous, compatibility-first blind dating. Built in Helsinki.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-bold uppercase tracking-widest text-white/40">{col.title}</div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[13.5px] text-white/70 transition hover:text-pink-300">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-[12.5px] text-white/45 sm:flex-row">
          <span>© {new Date().getFullYear()} ChoiceMi Oy · Helsinki, Finland</span>
          <span>Helsinki pilot · 18+ only · Every member identity-verified</span>
        </div>
      </div>
    </footer>
  )
}
