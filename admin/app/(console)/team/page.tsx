'use client'

import { useState } from 'react'
import { Alert, Badge, Button, Field, PageTitle } from '@/components/ui'
import { LoadState, Section, Table, Td, Tr, ago, label, useAction, useLoad } from '@/components/kit'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

interface Res {
  staff: { id: string; email: string; username: string; role: string; roleLabel: string; active: boolean; lastSignIn: string | null; since: string }[]
  invited: { email: string; role: string; roleLabel: string; expiresAt: string }[]
  roles: { role: string; label: string; summary: string; permissions: string[] }[]
}

const PERM_LABEL: Record<string, string> = {
  'staff.manage': 'Manage the team',
  'users.read': 'See accounts',
  'users.manage': 'Suspend accounts',
  'kyc.read': 'See identity checks',
  'kyc.decide': 'Decide identity checks',
  'support.read': 'See helpdesk tickets',
  'support.reply': 'Answer tickets',
  'venues.review': 'Review venues',
  'bookings.read': 'See bookings',
  'bookings.manage': 'Move bookings along',
  'moderation.manage': 'Moderate comments and concerns',
  'audit.read': 'See the activity log',
  'data.read': 'Browse the data',
}

export default function TeamPage() {
  const { me } = useSession()
  const { data, error, loading, reload } = useLoad<Res>('/admin/staff')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('support_agent')
  const [sent, setSent] = useState('')
  const act = useAction(reload)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setSent('')
    const ok = await act.run(() => api('/admin/staff/invite', { body: { email, role } }))
    if (ok) {
      setSent(email)
      setEmail('')
    }
  }

  return (
    <div>
      <PageTitle title="Team & roles" sub="Who is on the ChoiceMi team and what each role may do." />
      <LoadState loading={loading && !data} error={error}>
        {act.error && <Alert className="mb-4">{act.error}</Alert>}
        <div className="space-y-6">
          <Section title="Invite someone" sub="They get an email with a personal link to create their sign-in. Staff use their own account, separate from members and restaurants.">
            <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
              <Field label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <div>
                <label className="label">Role</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  {data?.roles.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={act.busy || !email}>
                Send invitation
              </Button>
            </form>
            {sent && (
              <Alert tone="success" className="mt-3">
                Invitation sent to {sent}.
              </Alert>
            )}
            {data && data.invited.length > 0 && (
              <p className="mt-4 text-[13px] text-ink-500">
                Waiting to join: {data.invited.map((i) => `${i.email} (${i.roleLabel})`).join(', ')}
              </p>
            )}
          </Section>

          <Section title={`The team (${data?.staff.length ?? 0})`}>
            <Table head={['Person', 'Role', 'Status', 'Last sign-in', '']}>
              {data?.staff.map((s) => {
                const you = s.id === me?.userId
                return (
                  <Tr key={s.id}>
                    <Td>
                      <div className="font-semibold text-ink-900">
                        {s.username} {you && <span className="text-[12px] font-normal text-ink-400">(you)</span>}
                      </div>
                      <div className="text-[12px] text-ink-400">{s.email}</div>
                    </Td>
                    <Td>
                      {you ? (
                        <Badge tone="brand">{s.roleLabel}</Badge>
                      ) : (
                        <select className="input !w-auto !py-1.5 text-[13.5px]" value={s.role} disabled={act.busy} onChange={(e) => act.run(() => api(`/admin/staff/${s.id}/role`, { body: { role: e.target.value } }))}>
                          {data.roles.map((r) => (
                            <option key={r.role} value={r.role}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </Td>
                    <Td>{s.active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Switched off</Badge>}</Td>
                    <Td className="text-ink-500">{s.lastSignIn ? ago(s.lastSignIn) : 'Never'}</Td>
                    <Td className="text-right">
                      {!you && (
                        <Button size="sm" variant={s.active ? 'danger' : 'secondary'} disabled={act.busy} onClick={() => act.run(() => api(`/admin/staff/${s.id}/active`, { body: { active: !s.active } }))}>
                          {s.active ? 'Switch off' : 'Switch on'}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Table>
          </Section>

          <Section title="What each role can do" sub="Fixed in the system. Switching someone to a different role changes what they see the next time they open a page.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-ink-200 text-left">
                    <th className="px-2 py-2 font-bold text-ink-500">Permission</th>
                    {data?.roles.map((r) => (
                      <th key={r.role} className="px-2 py-2 text-center font-bold text-ink-800">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(PERM_LABEL).map((p) => (
                    <tr key={p} className="border-b border-ink-100 last:border-0">
                      <td className="px-2 py-2 text-ink-700">{PERM_LABEL[p]}</td>
                      {data?.roles.map((r) => (
                        <td key={r.role} className="px-2 py-2 text-center">
                          {r.permissions.includes(p) ? <span className="font-bold text-ok-600">✓</span> : <span className="text-ink-200">·</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-1 text-[13px] text-ink-500">
              {data?.roles.map((r) => (
                <li key={r.role}>
                  <b className="text-ink-700">{label(r.label)}:</b> {r.summary}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </LoadState>
    </div>
  )
}
