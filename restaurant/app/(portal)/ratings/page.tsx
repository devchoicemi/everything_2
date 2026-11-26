'use client'

import { PageTitle } from '@/components/ui'
import { LoadState, Section, useLoad } from '@/components/kit'
import type { Stats } from '@/lib/api'
import { dayLabel } from '@/lib/format'

/** The venue's own numbers and how guests rated it. An average appears only after enough ratings, comments only once checked. */
export default function RatingsPage() {
  const { data, error, loading } = useLoad<Stats>('/partner/stats')
  const r = data?.ratings
  const max = Math.max(1, ...(data?.weekly.map((w) => w.booked) ?? [1]))
  return (
    <div>
      <PageTitle title="Ratings" sub="How guests rated the venue, without anything that could identify a couple." />
      <LoadState loading={loading && !data} error={error}>
        {data && r && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-4">
              <Big label="Dates hosted" value={data.hostedAllTime} />
              <Big label="Hosted, last 30 days" value={data.last30.hosted} />
              <Big label="No-shows, 30 days" value={data.last30.noShows} />
              <Big label="Offers given, 30 days" value={data.last30.offersClaimed} />
            </div>

            <Section title="Venue rating">
              {r.average !== null ? (
                <div className="flex items-end gap-3">
                  <span className="text-[48px] font-extrabold leading-none">{r.average.toFixed(1)}</span>
                  <span className="pb-1.5 text-[14px] text-ink-500">out of 5 · {r.count} ratings</span>
                </div>
              ) : (
                <p className="text-[14.5px] text-ink-600">
                  You have {r.count} {r.count === 1 ? 'rating' : 'ratings'}. Your average appears after {r.needed}, so no single guest can be recognised.
                </p>
              )}
            </Section>

            {r.comments.length > 0 && (
              <Section title="What guests said" sub="Checked by ChoiceMi, with dates and usernames removed.">
                <ul className="space-y-3">
                  {r.comments.map((c, i) => (
                    <li key={i} className="rounded-xl bg-ink-100/60 px-4 py-3 text-[14.5px] text-ink-800">
                      “{c}”
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Dates by week" sub="Booked and hosted, the last eight weeks.">
              <div className="flex h-40 items-end gap-3">
                {data.weekly.length === 0 && <p className="text-[14px] text-ink-400">No dates yet.</p>}
                {data.weekly.map((w) => (
                  <div key={w.week} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full items-end gap-1">
                      <div className="flex-1 rounded-t bg-brand-200" style={{ height: `${(w.booked / max) * 100}%` }} title={`${w.booked} booked`} />
                      <div className="flex-1 rounded-t bg-brand-600" style={{ height: `${(w.hosted / max) * 100}%` }} title={`${w.hosted} hosted`} />
                    </div>
                    <span className="text-[11px] text-ink-500">{dayLabel(w.week).slice(4)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-5 text-[12.5px] text-ink-500">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand-200" /> Booked</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Hosted</span>
              </div>
            </Section>
          </div>
        )}
      </LoadState>
    </div>
  )
}

const Big = ({ label, value }: { label: string; value: number }) => (
  <div className="card p-5">
    <div className="text-[12.5px] font-semibold text-ink-500">{label}</div>
    <div className="mt-1.5 text-[32px] font-extrabold leading-none">{value}</div>
  </div>
)
