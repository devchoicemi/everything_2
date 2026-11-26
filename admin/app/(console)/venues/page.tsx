'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageTitle } from '@/components/ui'
import { LoadState, Pill, Section, Table, Tabs, Td, Tr, ago, useLoad } from '@/components/kit'

interface Res {
  counts: Record<string, number>
  venues: { id: string; name: string; area: string; business_id: string | null; review_status: string; status: string; submitted_at: string | null; reviewed_at: string | null; went_live_at: string | null; contact_name: string; contact_email: string }[]
}

export default function VenuesPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const params = useSearchParams()
  const router = useRouter()
  const status = params.get('status') ?? 'submitted'
  const { data, error, loading } = useLoad<Res>(`/admin/venues?status=${status}`)
  const c = data?.counts ?? {}
  return (
    <div>
      <PageTitle title="Venues" sub="Restaurant applications and the venues already on ChoiceMi." />
      <Tabs
        value={status}
        onChange={(id) => router.replace(`/venues?status=${id}`)}
        tabs={[
          { id: 'submitted', label: 'To review', count: c.submitted ?? 0 },
          { id: 'sent_back', label: 'Sent back', count: c.sent_back ?? 0 },
          { id: 'approved', label: 'Approved', count: c.approved ?? 0 },
          { id: 'draft', label: 'Still applying', count: c.draft ?? 0 },
        ]}
      />
      <Section>
        <LoadState loading={loading && !data} error={error}>
          <Table head={['Venue', 'Business ID', 'Contact', 'Review', 'On ChoiceMi', 'Sent']} empty="Nothing here.">
            {data?.venues.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <Link href={`/venues/${v.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                    {v.name}
                  </Link>
                  <div className="text-[12px] text-ink-400">{v.area || '—'}</div>
                </Td>
                <Td className="font-mono text-[13px]">{v.business_id ?? '—'}</Td>
                <Td>
                  {v.contact_name || '—'}
                  <div className="text-[12px] text-ink-400">{v.contact_email}</div>
                </Td>
                <Td>
                  <Pill value={v.review_status} />
                </Td>
                <Td>{v.went_live_at ? <Pill value={v.status} /> : <span className="text-ink-400">Not live</span>}</Td>
                <Td className="whitespace-nowrap text-ink-500">{ago(v.submitted_at)}</Td>
              </Tr>
            ))}
          </Table>
        </LoadState>
      </Section>
    </div>
  )
}
