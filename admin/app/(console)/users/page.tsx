'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageTitle } from '@/components/ui'
import { LoadState, Pill, Section, Table, Td, Tr, ago, label, useLoad } from '@/components/kit'

interface Res {
  total: number
  users: { id: string; email: string; username: string; role: string; status: string; emailVerified: boolean; identityVerified: boolean; lastSignIn: string | null; joined: string }[]
}

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [identity, setIdentity] = useState('')
  const qs = new URLSearchParams()
  if (q.trim()) qs.set('q', q.trim())
  if (role) qs.set('role', role)
  if (status) qs.set('status', status)
  if (identity) qs.set('identity', identity)
  const { data, error, loading } = useLoad<Res>(`/admin/users?${qs}`)

  return (
    <div>
      <PageTitle title="Members & venues" sub={data ? `${data.total} accounts` : undefined} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search email or username" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[160px]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Any type</option>
          <option value="member">Members</option>
          <option value="partner">Restaurants</option>
          <option value="admin">Staff</option>
          <option value="tester">Test accounts</option>
        </select>
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select className="input max-w-[180px]" value={identity} onChange={(e) => setIdentity(e.target.value)}>
          <option value="">Any identity check</option>
          <option value="verified">Verified</option>
          <option value="unverified">Not verified</option>
        </select>
      </div>
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <Table head={['Account', 'Type', 'Status', 'Identity', 'Last sign-in', 'Joined']} empty="No accounts match.">
            {data?.users.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <Link href={`/users/${u.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                    {u.username}
                  </Link>
                  <div className="text-[12px] text-ink-400">{u.email}</div>
                </Td>
                <Td>{label(u.role)}</Td>
                <Td>
                  <Pill value={u.status} />
                </Td>
                <Td>{u.role === 'member' || u.role === 'tester' ? u.identityVerified ? <Pill value="approved" text="Verified" /> : <Pill value="pending" text="Not verified" /> : <span className="text-ink-400">—</span>}</Td>
                <Td className="whitespace-nowrap text-ink-500">{u.lastSignIn ? ago(u.lastSignIn) : 'Never'}</Td>
                <Td className="whitespace-nowrap text-ink-500">{ago(u.joined)}</Td>
              </Tr>
            ))}
          </Table>
        </LoadState>
      </Section>
    </div>
  )
}
