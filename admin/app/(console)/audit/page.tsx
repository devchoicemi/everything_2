'use client'

import { useState } from 'react'
import { PageTitle } from '@/components/ui'
import { LoadState, Section, Table, Td, Tr, dateTime, useLoad } from '@/components/kit'

interface Res {
  total: number
  entries: { id: number; at: string; actor_label: string; action: string; target_type: string | null; target_id: string | null; meta: Record<string, unknown> | null; ip: string | null }[]
}

const PAGE = 100

export default function AuditPage() {
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [offset, setOffset] = useState(0)
  const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
  if (action.trim()) qs.set('action', action.trim())
  if (actor.trim()) qs.set('actor', actor.trim())
  const { data, error, loading } = useLoad<Res>(`/admin/audit?${qs}`)

  return (
    <div>
      <PageTitle title="Activity log" sub="Everything staff changed: who, what, and when. Entries cannot be edited." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Action starts with (for example user. or kyc.)" value={action} onChange={(e) => { setAction(e.target.value); setOffset(0) }} />
        <input className="input max-w-xs" placeholder="Person" value={actor} onChange={(e) => { setActor(e.target.value); setOffset(0) }} />
      </div>
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <Table head={['When', 'Who', 'Did', 'To', 'Details']} empty="Nothing logged yet.">
            {data?.entries.map((e) => (
              <Tr key={e.id}>
                <Td className="whitespace-nowrap text-ink-500">{dateTime(e.at)}</Td>
                <Td className="font-semibold">{e.actor_label || '—'}</Td>
                <Td className="font-mono text-[12.5px]">{e.action}</Td>
                <Td className="text-[12.5px] text-ink-600">{e.target_type ? `${e.target_type} ${e.target_id ?? ''}` : '—'}</Td>
                <Td className="max-w-[320px] break-words text-[12.5px] text-ink-500">{e.meta ? Object.entries(e.meta).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') : ''}</Td>
              </Tr>
            ))}
          </Table>
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
