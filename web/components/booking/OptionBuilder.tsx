'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { membersApi, type SlotView, type VenueView } from '@/services/members'
import type { OptionInput } from '@/services/bookings'

const SLOT_LABEL: Record<string, string> = { full: 'Fully booked', closed: 'Closed', too_close_to_closing: 'Too close to closing', not_offered: 'Not offered' }

interface Draft {
  venueId: string
  dateKey: string
  time: string
}

const blank = (): Draft => ({ venueId: '', dateKey: '', time: '' })

/** One option: a venue, a day inside the window, and a start time that venue still has free. */
function OptionEditor({ index, value, venues, window, onChange }: { index: number; value: Draft; venues: VenueView[]; window: { from: string; to: string }; onChange: (d: Draft) => void }) {
  const [slots, setSlots] = useState<SlotView[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!value.venueId || !value.dateKey) return setSlots(null)
    let off = false
    setError('')
    membersApi
      .slots(value.venueId, value.dateKey)
      .then((r) => !off && setSlots(r.slots))
      .catch((e) => !off && setError(e instanceof Error ? e.message : 'Could not load the times.'))
    return () => {
      off = true
    }
  }, [value.venueId, value.dateKey])

  const venue = venues.find((v) => v.id === value.venueId)
  return (
    <div className="rounded-2xl border border-warm-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-warm-400">Option {index + 1}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-warm-700">Venue</span>
          <select className="w-full rounded-xl border border-warm-200 bg-white px-3 py-2.5 text-[14px]" value={value.venueId} onChange={(e) => onChange({ venueId: e.target.value, dateKey: value.dateKey, time: '' })}>
            <option value="">Choose a venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.area}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-warm-700">Day</span>
          <input type="date" className="w-full rounded-xl border border-warm-200 bg-white px-3 py-2.5 text-[14px]" min={window.from} max={window.to} value={value.dateKey} onChange={(e) => onChange({ ...value, dateKey: e.target.value, time: '' })} />
        </label>
      </div>
      {venue && (
        <p className="mt-2 text-[12.5px] text-warm-500">
          {venue.offer ? `${venue.offer} · ` : ''}
          {venue.address}
        </p>
      )}
      {value.venueId && value.dateKey && (
        <div className="mt-3">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-warm-700">Start time</span>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          {!slots && !error && <div className="h-9 w-48 animate-pulse-soft rounded-full bg-warm-100" />}
          <div className="flex flex-wrap gap-2">
            {slots?.map((s) => (
              <Chip key={s.time} size="sm" active={value.time === s.time} disabled={!s.available} title={s.reason ? SLOT_LABEL[s.reason] : undefined} onClick={() => onChange({ ...value, time: s.time })}>
                {s.label}
                {!s.available && <span className="ml-1 text-[10.5px]">{SLOT_LABEL[s.reason ?? ''] ?? ''}</span>}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Three options to send. Nothing is sent to the venue: the other person picks one, and you confirm it. */
export function OptionBuilder({ window, submitLabel, busy, onSubmit, intro }: { window: { from: string; to: string }; submitLabel: string; busy: boolean; onSubmit: (o: OptionInput[]) => void; intro?: React.ReactNode }) {
  const [venues, setVenues] = useState<VenueView[] | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([blank(), blank(), blank()])
  useEffect(() => {
    membersApi
      .venues()
      .then((r) => setVenues(r.venues))
      .catch(() => setVenues([]))
  }, [])

  const complete = drafts.every((d) => d.venueId && d.dateKey && d.time)
  const keys = drafts.map((d) => `${d.venueId}|${d.dateKey}|${d.time}`)
  const duplicate = new Set(keys).size !== keys.length
  const ok = useMemo(() => complete && !duplicate, [complete, duplicate])

  if (!venues) return <div className="h-[300px] animate-pulse-soft rounded-3xl bg-warm-100" />
  return (
    <div className="space-y-4">
      {intro}
      {drafts.map((d, i) => (
        <OptionEditor key={i} index={i} value={d} venues={venues} window={window} onChange={(n) => setDrafts((all) => all.map((x, j) => (j === i ? n : x)))} />
      ))}
      {duplicate && complete && <p className="text-[13px] font-medium text-danger">The three options must be different from each other.</p>}
      <Button disabled={!ok || busy} onClick={() => onSubmit(drafts)}>
        {busy ? 'Sending…' : submitLabel}
      </Button>
    </div>
  )
}
