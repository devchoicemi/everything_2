'use client'

import { useState } from 'react'
import { Alert, Badge, Button, Field, PageTitle } from '@/components/ui'
import { LoadState, Section, Table, Td, Tr, ago, useAction, useLoad } from '@/components/kit'
import { api, type TeamResponse } from '@/lib/api'
import { useSession } from '@/lib/session'

export default function TeamPage() {
  const { me } = useSession()
  const { data, error, loading, reload } = useLoad<TeamResponse>('/partner/team')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const act = useAction(reload)
  const owner = me?.staffRole === 'owner'

  return (
    <div>
      <PageTitle title="Team and devices" sub="Everyone with a sign-in to this portal, and how to set up the check-in device." />
      <LoadState loading={loading && !data} error={error}>
        <div className="space-y-6">
          <Section title="Team">
            {act.error && <Alert className="mb-3">{act.error}</Alert>}
            <Table head={['Person', 'Role', 'Last sign-in', '']}>
              {data?.members.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    {m.email} {m.you && <span className="text-[12px] text-ink-400">(you)</span>}
                  </Td>
                  <Td>{m.role === 'owner' ? <Badge tone="brand">Owner</Badge> : <Badge>Staff</Badge>}</Td>
                  <Td className="text-ink-500">{m.lastSignIn ? ago(m.lastSignIn) : 'Never'}</Td>
                  <Td className="text-right">
                    {owner && !m.you && (
                      <Button size="sm" variant="danger" disabled={act.busy} onClick={() => confirm(`Remove ${m.email}? They are signed out at once.`) && act.run(() => api(`/partner/team/${m.id}`, { method: 'DELETE' }))}>
                        Remove
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
            {data && data.invited.length > 0 && <p className="mt-3 text-[13px] text-ink-500">Waiting to join: {data.invited.map((i) => i.email).join(', ')}</p>}
          </Section>

          {owner && (
            <Section title="Add a colleague" sub="Staff can answer requests and check guests in. Only owners change hours, details and the team.">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setSent('')
                  if (await act.run(() => api('/partner/team/invite', { body: { email } }))) {
                    setSent(email)
                    setEmail('')
                  }
                }}
              >
                <div className="min-w-[260px] flex-1">
                  <Field label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" disabled={act.busy || !email}>
                  Send invitation
                </Button>
              </form>
              {sent && <Alert tone="success" className="mt-3">Invitation sent to {sent}.</Alert>}
            </Section>
          )}

          <Section title="Check-in devices" sub="A device is any phone or tablet signed in to this portal.">
            <ol className="list-decimal space-y-2 pl-5 text-[14.5px] text-ink-700">
              <li>Sign in on the device at the host stand with a staff login, not the owner’s.</li>
              <li>
                Open <b>Check-in</b> and allow the camera when the browser asks.
              </li>
              <li>Add the page to the home screen so it opens full screen.</li>
              <li>Keep it charged and the screen awake during service.</li>
            </ol>
            <p className="mt-3 text-[13px] text-ink-500">Remove a person above to sign out their device at once. Staff who leave should be removed the same day.</p>
          </Section>
        </div>
      </LoadState>
    </div>
  )
}
