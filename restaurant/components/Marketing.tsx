import Link from 'next/link'
import { ButtonLink, Logo } from '@/components/ui'

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3">
          <Link href="/#how" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold text-ink-600 hover:text-ink-900 md:block">
            How it works
          </Link>
          <Link href="/#faq" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold text-ink-600 hover:text-ink-900 md:block">
            Questions
          </Link>
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/apply" size="sm">
            Start your application
          </ButtonLink>
        </nav>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-200/70 bg-paper-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-[13px] text-ink-500">ChoiceMi is anonymous, compatibility-first dating. This site is for the restaurants and cafés that host the first dates.</p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-semibold text-ink-600">
          <li>
            <a href="https://choicemi.com" className="hover:text-brand-700">
              choicemi.com
            </a>
          </li>
          <li>
            <a href="https://choicemi.com/privacy" className="hover:text-brand-700">
              Privacy
            </a>
          </li>
          <li>
            <a href="https://choicemi.com/terms" className="hover:text-brand-700">
              Terms
            </a>
          </li>
          <li>
            <a href="mailto:admin@choicemi.com" className="hover:text-brand-700">
              admin@choicemi.com
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
