import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export const LEGAL_VERSION = '12 October 2026'
export const CONTACT_EMAIL = 'admin@choicemi.com'

/** Shared shell for the Privacy Policy and Terms pages: plain, readable, no app chrome. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-warm-50">
      <header className="border-b border-warm-100 bg-white">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-5 py-4">
          <Link href="/" aria-label="ChoiceMi home">
            <Logo size={30} />
          </Link>
          <nav className="flex gap-5 text-[13.5px] font-semibold text-warm-600">
            <Link href="/privacy" className="hover:text-brand-700">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-brand-700">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-5 pb-24 pt-10">
        <h1 className="font-serif text-display-md text-warm-900">{title}</h1>
        <p className="mt-2 text-[13px] text-warm-400">Version of {LEGAL_VERSION}</p>
        <p className="mt-5 text-[16px] leading-relaxed text-warm-700">{intro}</p>
        <div className="legal mt-8 space-y-9 text-[15px] leading-relaxed text-warm-700">{children}</div>
        <p className="mt-14 border-t border-warm-100 pt-6 text-[13px] text-warm-500">
          Questions about this page? Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[19px] font-extrabold tracking-tight text-warm-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-warm-200 px-2 py-2 text-[11.5px] font-bold uppercase tracking-wider text-warm-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="align-top">
              {r.map((c, i) => (
                <td key={i} className={`border-b border-warm-100 px-2 py-2.5 ${i === 0 ? 'font-semibold text-warm-900' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}
