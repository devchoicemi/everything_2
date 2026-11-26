import Link from 'next/link'
import { Eye, Headset, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/ui'

/** The frame around sign-in and password screens: a short note on the left, the form on the right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl" />
        <Link href="/" className="relative">
          <Logo tone="dark" />
        </Link>
        <div className="relative mt-auto">
          <h2 className="text-[40px] font-extrabold leading-[1.08] tracking-tight">
            The ChoiceMi team, <span className="text-gradient">in one place.</span>
          </h2>
          <ul className="mt-8 space-y-4 text-[15px] text-white/80">
            <li className="flex items-center gap-3">
              <ShieldCheck size={19} className="text-brand-300" /> Your role decides what you can open
            </li>
            <li className="flex items-center gap-3">
              <Headset size={19} className="text-brand-300" /> Helpdesk, identity checks and venue reviews
            </li>
            <li className="flex items-center gap-3">
              <Eye size={19} className="text-brand-300" /> Everything you change is written to the activity log
            </li>
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="cm-rise w-full max-w-[440px]">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}
