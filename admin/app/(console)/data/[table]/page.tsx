'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { LoadState, Section, useLoad } from '@/components/kit'

interface Res {
  table: string
  total: number
  columns: { name: string; hidden: boolean }[]
  rows: Record<string, unknown>[]
}
const PAGE = 50

const show = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export default function TablePage() {
  const { table } = useParams<{ table: string }>()
  const [offset, setOffset] = useState(0)
  const { data, error, loading } = useLoad<Res>(`/admin/data/${encodeURIComponent(table)}?limit=${PAGE}&offset=${offset}`)
  return (
    <div>
      <Link href="/data" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Data
      </Link>
      <h1 className="mb-1 font-mono text-[24px] font-extrabold tracking-tight">{table}</h1>
      <p className="mb-5 text-[14px] text-ink-500">{data ? `${data.total.toLocaleString('en-GB')} rows, newest first. Read only.` : ' '}</p>
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-ink-200">
                  {data?.columns.map((c) => (
                    <th key={c.name} className="whitespace-nowrap px-2.5 py-2 font-mono font-bold text-ink-500">
                      {c.name}
                      {c.hidden && ' 🔒'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r, i) => (
                  <tr key={i} className="border-b border-ink-100 align-top last:border-0">
                    {data.columns.map((c) => (
                      <td key={c.name} className="max-w-[280px] truncate px-2.5 py-2 font-mono text-ink-700" title={show(r[c.name])}>
                        {show(r[c.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total > PAGE && (
            <div className="mt-4 flex items-center justify-between text-[13px] text-ink-500">
              <span>
                {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}
              </span>
              <span className="flex gap-3">
                <button className="font-semibold text-brand-700 disabled:text-ink-300" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  Newer
                </button>
                <button className="font-semibold text-brand-700 disabled:text-ink-300" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
                  Older
                </button>
              </span>
            </div>
          )}
        </LoadState>
      </Section>
    </div>
  )
}
