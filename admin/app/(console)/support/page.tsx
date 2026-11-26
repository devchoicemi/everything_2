'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageTitle } from '@/components/ui'
import { LoadState, Pill, Section, Table, Tabs, Td, Tr, ago, label, useLoad } from '@/components/kit'

interface Ticket {
  id: string
  ref: string
  subject: string
  category: string
  status: string
  priority: string
  source: string
  requester_kind: string
  requester: string | null
  assignee: string | null
  breached: boolean
  last_activity_at: string
  first_response_due_at: string
}
interface Res {
  counts: { open: number; waiting: number; breached: number; unassigned: number; mine: number; resolved_today: number; avg_first_minutes: number | null }
  tickets: Ticket[]
}

export default function SupportPage() {
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
  const status = params.get('status') ?? 'active'
  const assignee = params.get('assignee') ?? ''
  const priority = params.get('priority') ?? ''
  const breached = params.get('breached') === '1'
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (assignee) qs.set('assignee', assignee)
  if (priority) qs.set('priority', priority)
  if (breached) qs.set('breached', '1')
  if (q.trim()) qs.set('q', q.trim())
  const { data, error, loading } = useLoad<Res>(`/admin/support?${qs}`)

  const go = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k))
    router.replace(`/support?${n}`)
  }
  const c = data?.counts

  return (
    <div>
      <PageTitle title="Helpdesk" sub="Questions and concerns from members and restaurants." />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Mini label="Open" value={c?.open} />
        <Mini label="Past deadline" value={c?.breached} danger />
        <Mini label="Solved today" value={c?.resolved_today} />
        <Mini label="Avg first reply" value={c?.avg_first_minutes == null ? '—' : c.avg_first_minutes < 90 ? `${c.avg_first_minutes} min` : `${Math.round(c.avg_first_minutes / 60)} h`} />
      </div>
      <Tabs
        value={breached ? 'breached' : assignee === 'me' ? 'mine' : assignee === 'unassigned' ? 'unassigned' : status}
        onChange={(id) => {
          if (id === 'breached') go({ breached: '1', assignee: null, status: 'open' })
          else if (id === 'mine') go({ assignee: 'me', breached: null, status: 'active' })
          else if (id === 'unassigned') go({ assignee: 'unassigned', breached: null, status: 'open' })
          else go({ status: id, assignee: null, breached: null })
        }}
        tabs={[
          { id: 'active', label: 'Active' },
          { id: 'mine', label: 'Mine', count: c?.mine },
          { id: 'unassigned', label: 'Not assigned', count: c?.unassigned },
          { id: 'breached', label: 'Past deadline', count: c?.breached },
          { id: 'waiting_customer', label: 'Waiting for them', count: c?.waiting },
          { id: 'resolved', label: 'Solved' },
          { id: 'closed', label: 'Closed' },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search reference, subject or person" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[180px]" value={priority} onChange={(e) => go({ priority: e.target.value || null })}>
          <option value="">Any priority</option>
          {['urgent', 'high', 'normal', 'low'].map((p) => (
            <option key={p} value={p}>
              {label(p)}
            </option>
          ))}
        </select>
      </div>
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <Table head={['Ticket', 'From', 'Priority', 'Status', 'Owner', 'Last activity']} empty="No tickets match.">
            {data?.tickets.map((t) => (
              <Tr key={t.id} tone={t.breached ? 'danger' : undefined}>
                <Td>
                  <Link href={`/support/${t.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                    {t.subject}
                  </Link>
                  <div className="text-[12px] text-ink-400">
                    {t.ref} · {label(t.category)}
                    {t.source === 'report' && ' · concern report'}
                  </div>
                </Td>
                <Td>
                  {t.requester ?? 'Deleted account'}
                  <div className="text-[12px] text-ink-400">{t.requester_kind === 'partner' ? 'Restaurant' : 'Member'}</div>
                </Td>
                <Td>
                  <Pill value={t.priority} />
                </Td>
                <Td>
                  <Pill value={t.status} />
                  {t.breached && <div className="mt-1 text-[11.5px] font-bold text-danger">Past deadline</div>}
                </Td>
                <Td>{t.assignee ?? <span className="text-ink-400">Nobody</span>}</Td>
                <Td className="whitespace-nowrap text-ink-500">{ago(t.last_activity_at)}</Td>
              </Tr>
            ))}
          </Table>
        </LoadState>
      </Section>
    </div>
  )
}

function Mini({ label, value, danger }: { label: string; value?: number | string; danger?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[12px] font-semibold text-ink-500">{label}</div>
      <div className={`mt-1 text-[24px] font-extrabold leading-none ${danger && Number(value) > 0 ? 'text-danger' : ''}`}>{value ?? '…'}</div>
    </div>
  )
}
