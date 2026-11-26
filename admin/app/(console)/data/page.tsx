'use client'

import Link from 'next/link'
import { Alert, PageTitle } from '@/components/ui'
import { LoadState, Section, useLoad } from '@/components/kit'

export default function DataPage() {
  const { data, error, loading } = useLoad<{ tables: { name: string; rows: number }[] }>('/admin/data')
  return (
    <div>
      <PageTitle title="Data" sub="A read-only look at what ChoiceMi stores. Passwords, tokens, codes and keys are always hidden." />
      <Alert tone="info" className="mb-5">
        Looking at this data is recorded as part of normal access control. Only open what you need for your work.
      </Alert>
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data?.tables.map((t) => (
              <Link key={t.name} href={`/data/${t.name}`} className="flex items-center justify-between rounded-xl border border-ink-200/70 px-4 py-3 transition hover:border-brand-300 hover:bg-brand-50/60">
                <span className="font-mono text-[13.5px] font-semibold text-ink-900">{t.name}</span>
                <span className="text-[13px] text-ink-500">{t.rows.toLocaleString('en-GB')}</span>
              </Link>
            ))}
          </div>
        </LoadState>
      </Section>
    </div>
  )
}
