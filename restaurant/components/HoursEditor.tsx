'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Field, Toggle, cn } from '@/components/ui'
import { api, messageOf, type Closure, type DayHours, type Onboarding } from '@/lib/api'
import { dayLabel, timeLabel, WEEKDAYS, WEEK_ORDER } from '@/lib/format'
import { useOnboarding } from '@/lib/onboarding'

export const START_TIMES = ['12:00', '13:30', '15:00', '16:30', '18:00', '19:00']
const DEFAULT: DayHours = { open: '10:00', close: '22:00' }

/** Opening hours per weekday, exception dates, the start times offered and how many dates share one. Used in the application and later in the portal. */
export function HoursEditor({ footer }: { footer?: (save: () => Promise<boolean>, saving: boolean, locked: boolean) => React.ReactNode }) {
  const { ob, save, saving, saveError } = useOnboarding()
  const v = ob!.venue
  const locked = v.reviewStatus === 'submitted'

  const [hours, setHours] = useState<Record<string, DayHours | null>>(() => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), v.hours[String(d)] ?? null])))
  const [slots, setSlots] = useState<string[]>(v.slotTimes.length ? v.slotTimes : ['13:30', '15:00', '16:30', '18:00'])
  const [max, setMax] = useState(v.maxPerSlot || 2)
  const [closures, setClosures] = useState<Closure[]>([])
  const [adding, setAdding] = useState(false)
  const [cDate, setCDate] = useState('')
  const [cFrom, setCFrom] = useState('')
  const [cReason, setCReason] = useState('')
  const [cError, setCError] = useState('')

  const loadClosures = useCallback(async () => {
    try {
      setClosures((await api<{ closures: Closure[] }>('/partner/availability')).closures)
    } catch {
      /* the list is a convenience; saving still works */
    }
  }, [])
  useEffect(() => {
    void loadClosures()
  }, [loadClosures])

  const anyOpen = Object.values(hours).some(Boolean)
  const bad = useMemo(() => Object.entries(hours).some(([, h]) => h && h.close <= h.open), [hours])

  async function saveHours(): Promise<boolean> {
    const body = { hours: Object.fromEntries(Object.entries(hours).filter(([, h]) => h).map(([d, h]) => [d, h])), slotTimes: slots, maxPerSlot: max }
    return save(() => api<Onboarding>('/partner/onboarding/hours', { method: 'PUT', body }))
  }

  async function addClosure() {
    setCError('')
    try {
      await api('/partner/closures', { body: { dateOn: cDate, startTime: cFrom || null, reason: cReason } })
      setAdding(false)
      setCDate('')
      setCFrom('')
      setCReason('')
      await loadClosures()
    } catch (e) {
      setCError(messageOf(e))
    }
  }

  // a sample day for the right-hand preview
  const sample = slots.slice(0, 4)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="card p-6 sm:p-8">
          <h1 className="text-[30px] font-extrabold tracking-tight">Opening hours</h1>
          <p className="mt-1.5 text-ink-600">Open and close time for each weekday. Guests can only pick times inside these hours, and the last date starts 90 minutes before closing.</p>
          <fieldset disabled={locked} className="mt-6 divide-y divide-ink-100">
            {WEEK_ORDER.map((d) => {
              const h = hours[String(d)]
              return (
                <div key={d} className="flex flex-wrap items-center gap-4 py-3.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(h)}
                    aria-label={`${WEEKDAYS[d]} open`}
                    onClick={() => setHours((s) => ({ ...s, [String(d)]: s[String(d)] ? null : { ...DEFAULT } }))}
                    className={cn('relative h-7 w-12 flex-shrink-0 rounded-full transition', h ? 'bg-brand-600' : 'bg-ink-200')}
                  >
                    <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', h ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                  <span className="w-28 text-[15px] font-bold">{WEEKDAYS[d]}</span>
                  {h ? (
                    <span className="flex items-center gap-3 text-ink-500">
                      <input type="time" aria-label={`${WEEKDAYS[d]} opens`} className="input !w-[120px]" value={h.open} onChange={(e) => setHours((s) => ({ ...s, [String(d)]: { ...h, open: e.target.value } }))} />
                      to
                      <input type="time" aria-label={`${WEEKDAYS[d]} closes`} className="input !w-[120px]" value={h.close} onChange={(e) => setHours((s) => ({ ...s, [String(d)]: { ...h, close: e.target.value } }))} />
                      {h.close <= h.open && <span className="text-[12.5px] font-semibold text-danger">Closing must be later</span>}
                    </span>
                  ) : (
                    <span className="text-ink-400">Closed</span>
                  )}
                </div>
              )
            })}
          </fieldset>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-[22px] font-extrabold tracking-tight">Exception dates</h2>
          <p className="mt-1 text-[14.5px] text-ink-600">Holidays and private events. No dates are offered on these days.</p>
          <ul className="mt-4 space-y-2">
            {closures.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-2.5 text-[14px]">
                <span>
                  <b>{dayLabel(c.dateOn)}</b> <span className="text-ink-500">{c.reason ? `${c.reason} · ` : ''}{c.startTime ? `closed from ${c.startTime}` : 'closed all day'}</span>
                </span>
                <button className="text-[13px] font-bold text-danger" onClick={async () => { await api(`/partner/closures/${c.id}`, { method: 'DELETE' }).catch(() => {}); await loadClosures() }}>
                  Remove
                </button>
              </li>
            ))}
            {closures.length === 0 && <li className="text-[14px] text-ink-400">No exceptions yet.</li>}
          </ul>
          {adding ? (
            <div className="mt-4 grid gap-3 rounded-xl bg-ink-100/60 p-4 sm:grid-cols-3">
              <Field label="Day" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
              <Field label="Closed from (empty = all day)" type="time" value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
              <Field label="Reason (optional)" value={cReason} onChange={(e) => setCReason(e.target.value)} maxLength={120} />
              {cError && <div className="sm:col-span-3"><Alert>{cError}</Alert></div>}
              <div className="flex gap-2 sm:col-span-3">
                <Button size="sm" disabled={!cDate} onClick={addClosure}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-4" variant="secondary" size="sm" onClick={() => setAdding(true)}>
              Add an exception date
            </Button>
          )}
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-[22px] font-extrabold tracking-tight">Date slots you offer</h2>
          <p className="mt-1 text-[14.5px] text-ink-600">Choose the start times you accept ChoiceMi dates for, and how many dates you take at the same time.</p>
          <div className="label mt-5">Start times (dates start between 12:00 and 19:00)</div>
          <div className="flex flex-wrap gap-2">
            {START_TIMES.map((t) => (
              <Toggle key={t} on={slots.includes(t)} disabled={locked} onClick={() => setSlots((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}>
                {t}
              </Toggle>
            ))}
          </div>
          <div className="mt-5 max-w-[260px]">
            <label className="label" htmlFor="max">
              Dates at the same start time
            </label>
            <select id="max" className="input" value={max} disabled={locked} onChange={(e) => setMax(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {saveError && <Alert>{saveError}</Alert>}
        {!anyOpen && <Alert tone="warn">Turn on at least one day.</Alert>}
        {footer ? (
          footer(async () => (bad ? false : saveHours()), saving || bad || !anyOpen || slots.length === 0, locked)
        ) : (
          <div className="flex justify-end">
            <Button size="lg" disabled={saving || locked || bad || !anyOpen || slots.length === 0} onClick={() => void saveHours()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <h2 className="text-[15px] font-extrabold">What a guest will see</h2>
          <p className="mt-1.5 text-[13px] text-ink-500">A sample day. Only open, offered, free slots can be picked.</p>
          <ul className="mt-4 space-y-2">
            {sample.map((t, i) => (
              <li key={t} className={cn('flex items-center justify-between rounded-xl border px-4 py-2.5 text-[14px] font-semibold', i === 2 ? 'border-ink-200 bg-ink-100/60 text-ink-500' : 'border-ink-200')}>
                {timeLabel(t)}
                <span className={cn('text-[13px]', i === 2 ? 'font-normal' : i === 1 && max > 1 ? 'text-saffron-600' : 'text-ok-600')}>{i === 2 ? 'Closed' : i === 1 && max > 1 ? '1 left' : 'Free'}</span>
              </li>
            ))}
            {sample.length === 0 && <li className="text-[13.5px] text-ink-400">Choose at least one start time.</li>}
          </ul>
        </div>
      </aside>
    </div>
  )
}
