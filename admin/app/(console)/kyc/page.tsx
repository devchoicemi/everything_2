'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Button, PageTitle, TextArea } from '@/components/ui'
import { LoadState, Pill, Section, Stat, Table, Tabs, Td, Tr, ago, useAction, useLoad } from '@/components/kit'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

interface Case {
  id: string
  status: string
  reason: string
  decision_note: string
  created_at: string
  decided_at: string | null
  user_id: string
  username: string
  email: string
  verified: boolean
}
interface Stuck {
  id: string
  username: string
  email: string
  created_at: string
  email_verified: boolean
}
interface Res {
  counts: { open: number; stuck: number; verified: number; unverified: number }
  view: 'cases' | 'stuck'
  rows: (Case & Stuck)[]
}

export default function KycPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const params = useSearchParams()
  const router = useRouter()
  const { can } = useSession()
  const view = params.get('view') ?? 'cases'
  const status = params.get('status') ?? 'open'
  const { data, error, loading, reload } = useLoad<Res>(view === 'stuck' ? '/admin/kyc?view=stuck' : `/admin/kyc?status=${status}`)
  const [open, setOpen] = useState<string | null>(null)
  const act = useAction(async () => {
    setOpen(null)
    await reload()
  })
  const decide = can('kyc.decide')

  return (
    <div>
      <PageTitle title="Identity checks" sub="Members verify themselves through their bank. This is for the ones that need a person." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cases open" value={data?.counts.open ?? '…'} tone="warn" />
        <Stat label="Stuck over 24 hours" value={data?.counts.stuck ?? '…'} />
        <Stat label="Members verified" value={data?.counts.verified ?? '…'} tone="ok" />
        <Stat label="Members not verified" value={data?.counts.unverified ?? '…'} />
      </div>
      <Tabs
        value={view === 'stuck' ? 'stuck' : status}
        onChange={(id) => router.replace(id === 'stuck' ? '/kyc?view=stuck' : `/kyc?status=${id}`)}
        tabs={[
          { id: 'open', label: 'Open cases' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'revoked', label: 'Revoked' },
          { id: 'stuck', label: 'Stuck unverified' },
        ]}
      />
      {act.error && <Alert className="mb-4">{act.error}</Alert>}
      <Section>
        <LoadState loading={loading && !data} error={error}>
          {data?.view === 'stuck' ? (
            <Table head={['Member', 'Email confirmed', 'Joined', '']} empty="Nobody is stuck.">
              {data.rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link href={`/users/${r.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                      {r.username}
                    </Link>
                    <div className="text-[12px] text-ink-400">{r.email}</div>
                  </Td>
                  <Td>{r.email_verified ? 'Yes' : 'No'}</Td>
                  <Td className="text-ink-500">{ago(r.created_at)}</Td>
                  <Td className="text-right">
                    {decide && (
                      <OpenCase
                        busy={act.busy}
                        onOpen={(reason) => act.run(() => api('/admin/kyc/cases', { body: { userId: r.id, reason } }))}
                      />
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <Table head={['Member', 'Why', 'Status', 'Opened', '']} empty="No cases here.">
              {data?.rows.map((c) => (
                <>
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/users/${c.user_id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                        {c.username}
                      </Link>
                      <div className="text-[12px] text-ink-400">{c.email}</div>
                    </Td>
                    <Td className="max-w-[320px]">
                      {c.reason}
                      {c.decision_note && <div className="text-[12.5px] text-ink-500">Decision: {c.decision_note}</div>}
                    </Td>
                    <Td>
                      <Pill value={c.status} />
                    </Td>
                    <Td className="text-ink-500">{ago(c.created_at)}</Td>
                    <Td className="text-right">
                      {decide && c.status === 'open' && (
                        <Button size="sm" variant="secondary" onClick={() => setOpen(open === c.id ? null : c.id)}>
                          Decide
                        </Button>
                      )}
                    </Td>
                  </Tr>
                  {open === c.id && (
                    <tr key={`${c.id}-form`} className="border-b border-ink-100 bg-ink-100/40">
                      <td colSpan={5} className="p-4">
                        <DecideForm busy={act.busy} verified={c.verified} onDecide={(body) => act.run(() => api(`/admin/kyc/cases/${c.id}/decide`, { body }))} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </Table>
          )}
        </LoadState>
      </Section>
    </div>
  )
}

function OpenCase({ busy, onOpen }: { busy: boolean; onOpen: (reason: string) => void }) {
  const [show, setShow] = useState(false)
  const [reason, setReason] = useState('')
  if (!show)
    return (
      <Button size="sm" variant="secondary" onClick={() => setShow(true)}>
        Open a case
      </Button>
    )
  return (
    <div className="flex items-center justify-end gap-2">
      <input className="input !w-56 !py-1.5 text-[13px]" placeholder="Why does this need a person?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      <Button size="sm" disabled={busy || !reason.trim()} onClick={() => onOpen(reason)}>
        Open
      </Button>
    </div>
  )
}

function DecideForm({ busy, verified, onDecide }: { busy: boolean; verified: boolean; onDecide: (b: Record<string, unknown>) => void }) {
  const [note, setNote] = useState('')
  const [over18, setOver18] = useState(false)
  return (
    <div className="max-w-xl">
      <TextArea label="What did you check? (required, kept on record)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <label className="mt-3 flex items-start gap-2.5 text-[13.5px] text-ink-700">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={over18} onChange={(e) => setOver18(e.target.checked)} />
        <span>I have seen proof that this member is 18 or older (needed to approve).</span>
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy || !note.trim() || !over18} onClick={() => onDecide({ decision: 'approve', note, over18Confirmed: true })}>
          Approve: verified by staff
        </Button>
        <Button variant="secondary" disabled={busy || !note.trim()} onClick={() => onDecide({ decision: 'reject', note })}>
          Reject
        </Button>
        {verified && (
          <Button variant="danger" disabled={busy || !note.trim()} onClick={() => onDecide({ decision: 'revoke', note })}>
            Revoke their verification
          </Button>
        )}
      </div>
    </div>
  )
}
