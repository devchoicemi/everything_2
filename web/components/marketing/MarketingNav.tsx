'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#no-photos', label: 'The no-photo rule' },
  { href: '#safety', label: 'Safety' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Over the dark photo hero the nav is transparent with light text; once the
  // page scrolls it turns into a frosted bar with the light-surface logo.
  const onHero = !scrolled

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'glass border-b border-warm-200/70 py-3 shadow-sm' : 'py-5',
      )}
    >
      <div className="container flex items-center justify-between">
        <Link href="/">
          <Logo size={32} tone={onHero ? 'light' : 'dark'} />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={cn('nav-link', onHero && 'text-white/85 hover:text-white')}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/discover" className={cn('nav-link', onHero && 'text-white/85 hover:text-white')}>
            Sign in
          </Link>
          <a
            href="#waitlist"
            className="rounded-full bg-brand-cta px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(192,38,211,0.35)] transition hover:brightness-110"
          >
            Join the waitlist
          </a>
        </div>

        <button
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border lg:hidden',
            onHero ? 'border-white/30 bg-white/10 text-white' : 'border-warm-200 bg-white text-warm-800',
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="container lg:hidden">
          <div className="mt-3 flex flex-col gap-1 rounded-2xl border border-warm-200 bg-white p-3 shadow-lg">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-warm-800 hover:bg-warm-75"
              >
                {l.label}
              </a>
            ))}
            <div className="my-1 h-px bg-warm-100" />
            <Link href="/discover" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-warm-800 hover:bg-warm-75">
              Sign in
            </Link>
            <a
              href="#waitlist"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-full bg-brand-cta px-3 py-3 text-center text-[15px] font-semibold text-white"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
