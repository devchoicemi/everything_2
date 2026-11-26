'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageTitle } from '@/components/ui'
import { LoadState, Pill, Section, Table, Td, Tr, ago, label, useLoad } from '@/components/kit'

interface Row {
  id: string
  ref: string
  kind: string
  status: string
  daters: [string, string]
  venue: string | null
  dateOn: string | null
  time: string | null
  deadlineAt: string | null
  lateCancel: boolean
  createdAt: string
}
interface Res {
  counts: Record<string, number>
  bookings: Row[]
}

const STATUSES = ['proposed', 'picked', 'requested', 'confirmed', 'partially_checked_in', 'in_progress', 'ended', 'declined', 'expired', 'closed', 'cancelled', 'no_show']

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const params = useSearchParams()
  const router = useRouter()
  const [q, setQ] = useState('')
  const status = params.get('status') ?? ''
  const stalled = params.get('stalled') === '1'
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (stalled) qs.set('stalled', '1')
  if (q.trim()) qs.set('q', q.trim())
  const { data, error, loading } = useLoad<Res>(`/admin/bookings?${qs}`)

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k))
    router.replace(`/bookings?${n}`)
  }

  return (
    <div>
      <PageTitle title="Booking log" sub="Every booking and every status change, from the match to the rating." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Reference or username" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[220px]" value={status} onChange={(e) => set({ status: e.target.value || null })}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)} {data?.counts[s] ? `(${data.counts[s]})` : ''}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={stalled} onChange={(e) => set({ stalled: e.target.checked ? '1' : null })} /> Stalled only
        </label>
      </div>
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <Table head={['Booking', 'Daters', 'Venue', 'Date', 'Status', 'Updated']} empty="No bookings match.">
            {data?.bookings.map((b) => (
              <Tr key={b.id}>
                <Td>
                  <Link href={`/bookings/${b.id}`} className="font-mono font-semibold text-ink-900 hover:text-brand-700">
                    {b.ref}
                  </Link>
                  <div className="text-[12px] text-ink-400">{b.kind === 'redate' ? 'Redate' : 'First date'}</div>
                </Td>
                <Td>
                  {b.daters[0]} & {b.daters[1]}
                </Td>
                <Td>{b.venue ?? <span className="text-ink-400">Not chosen</span>}</Td>
                <Td className="whitespace-nowrap">{b.dateOn ? `${b.dateOn} ${b.time ?? ''}` : '—'}</Td>
                <Td>
                  <Pill value={b.status} />
                  {b.lateCancel && <div className="mt-1 text-[11.5px] font-bold text-saffron-600">Late cancellation</div>}
                </Td>
                <Td className="whitespace-nowrap text-ink-500">{ago(b.createdAt)}</Td>
              </Tr>
            ))}
          </Table>
        </LoadState>
      </Section>
    </div>
  )
}
