'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { MonthCalendar } from '@/components/dates/MonthCalendar'
import { DateCard } from '@/components/dates/DateCard'
import { LIVE } from '@/lib/live'
import { DEMO_TODAY } from '@/lib/utils'
import { LiveDates } from '@/app/(app)/dates/LiveDates'
import { useStore } from '@/store'

type Tab = 'upcoming' | 'pending' | 'past'

export default function DatesPage() {
  return LIVE ? <LiveDates /> : <DemoDates />
}

function DemoDates() {
  const router = useRouter()
  const bookings = useStore((s) => s.bookings)
  const events = useStore((s) => s.calendarEvents)

  const [year, setYear] = useState(DEMO_TODAY.getFullYear())
  const [month, setMonth] = useState(DEMO_TODAY.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(DEMO_TODAY.getDate())
  const [tab, setTab] = useState<Tab>('upcoming')
  const loading = false
  const loadError: string | null = null

  const load = useCallback(() => {}, [])

  const selectedKey = selectedDay ? `${year}-${month + 1}-${selectedDay}` : ''
  const dayEvent = events[selectedKey]

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m)
    setYear(y)
  }

  const list = useMemo(() => bookings[tab] ?? [], [bookings, tab])

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming', count: bookings.upcoming.length },
    { id: 'pending', label: 'Pending', count: bookings.pending.length },
    { id: 'past', label: 'Past', count: bookings.past.length },
  ]

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <PageHeader
        photo="cafe"
        photoPosition="40% 45%"
        title="Dates"
        subtitle={`${bookings.upcoming.length} upcoming · ${bookings.pending.length} pending · ${bookings.past.length} past`}
        actions={
          <Button block={false} size="sm" onClick={() => router.push('/dates/propose')}>
            <Plus size={15} /> Propose a date
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* agenda */}
        <div className="min-w-0">
          <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
                <span className={'ml-1.5 text-[11px] ' + (tab === t.id ? 'text-white/70' : 'text-warm-400')}>
                  {t.count}
                </span>
              </Chip>
            ))}
          </div>

          {loading || loadError ? (
        loadError ? (
          <div className="rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center text-[15px] text-warm-600">{loadError}</div>
        ) : (
          <div className="h-[200px] animate-pulse-soft rounded-3xl bg-warm-100" />
        )
      ) : list.length === 0 ? (
            <div className="rounded-3xl border border-warm-100 bg-white px-8 py-20 text-center">
              <CalendarDays size={40} className="mb-3 text-warm-300" />
              <div className="font-serif text-[20px] text-warm-900">Nothing here yet</div>
              <p className="mt-1.5 text-[14px] text-warm-500">Propose a date from one of your matches.</p>
              <Button block={false} className="mt-5" onClick={() => router.push('/matches')}>
                Go to matches
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((b) => (
                <DateCard key={b.id} booking={b} onChanged={load} />
              ))}
            </div>
          )}
        </div>

        {/* calendar rail */}
        <aside>
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
              <MonthCalendar
                variant="compact"
                year={year}
                month={month}
                selectedDay={selectedDay}
                events={events}
                onChangeMonth={changeMonth}
                onSelectDay={(d) => setSelectedDay(d)}
              />
              <div className="mt-4 border-t border-warm-100 pt-4">
                {dayEvent ? (
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: dayEvent.color }} />
                    <span className="font-medium text-warm-800">{dayEvent.label}</span>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-warm-400">No events on this day</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-warm-400">Legend</div>
              <div className="space-y-2 text-[12.5px] text-warm-600">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Confirmed date
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Awaiting response
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-warm-300" /> Past date
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
