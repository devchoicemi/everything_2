'use client'

import Link from 'next/link'
import { PageTitle } from '@/components/ui'
import { LoadState, Section, Stat, ago, useLoad } from '@/components/kit'
import { useSession } from '@/lib/session'
import type { Summary } from '@/lib/api'

interface SupportCounts {
  counts: { open: number; waiting: number; breached: number; unassigned: number; mine: number }
}
interface KycCounts {
  counts: { open: number; stuck: number }
}

export default function DashboardPage() {
  const { me, can } = useSession()
  const summary = useLoad<Summary>('/admin/summary')
  const support = useLoad<SupportCounts>(can('support.read') ? '/admin/support?status=active' : null)
  const kyc = useLoad<KycCounts>(can('kyc.read') ? '/admin/kyc' : null)

  const c = summary.data?.counts
  return (
    <div>
      <PageTitle title={`Hello, ${me?.username ?? ''}`} sub={`You are signed in as ${me?.roleLabel.toLowerCase()}. Here is what needs a person right now.`} />
      <LoadState loading={summary.loading} error={summary.error}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {can('support.read') && support.data && (
            <>
              <Stat label="Open tickets" value={support.data.counts.open} href="/support?status=open" />
              <Stat label="Past their deadline" value={support.data.counts.breached} href="/support?breached=1" tone="danger" />
              <Stat label="Not assigned" value={support.data.counts.unassigned} href="/support?assignee=unassigned" tone="warn" />
              <Stat label="Assigned to me" value={support.data.counts.mine} href="/support?assignee=me" />
            </>
          )}
          {can('venues.review') && c && <Stat label="Venues to review" value={c.submitted} href="/venues?status=submitted" tone="warn" />}
          {can('bookings.read') && c && (
            <>
              <Stat label="Waiting for a venue" value={c.requested} href="/bookings?status=requested" />
              <Stat label="Stalled bookings" value={c.stalled} href="/bookings?stalled=1" tone="danger" />
            </>
          )}
          {can('moderation.manage') && c && (
            <>
              <Stat label="Open concerns" value={c.reports} href="/moderation" tone="danger" />
              <Stat label="Comments to check" value={c.comments} href="/moderation" tone="warn" />
              <Stat label="No-shows, 7 days" value={c.no_shows7} href="/bookings?status=no_show" />
              <Stat label="Late cancellations, 7 days" value={c.late7} href="/bookings?status=cancelled" />
            </>
          )}
          {can('kyc.read') && kyc.data && (
            <>
              <Stat label="Identity cases open" value={kyc.data.counts.open} href="/kyc" tone="warn" />
              <Stat label="Members stuck unverified" value={kyc.data.counts.stuck} href="/kyc?view=stuck" />
            </>
          )}
        </div>

        {summary.data && summary.data.alerts.length > 0 && (
          <Section title="Latest alerts" sub="What the system flagged for staff." className="mt-8">
            <ul className="divide-y divide-ink-100">
              {summary.data.alerts.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold text-ink-900">{a.title}</div>
                    <div className="text-[13px] text-ink-500">{a.body}</div>
                  </div>
                  <span className="flex-shrink-0 text-[12.5px] text-ink-400">{ago(a.created_at)}</span>
                </li>
              ))}
            </ul>
            {can('bookings.read') && (
              <Link href="/bookings" className="mt-4 inline-block text-[13.5px] font-semibold text-brand-700">
                Open the booking log
              </Link>
            )}
          </Section>
        )}
      </LoadState>
    </div>
  )
}
