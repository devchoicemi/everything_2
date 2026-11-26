'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid, cn, MONTH_NAMES, WEEKDAYS_SHORT } from '@/lib/utils'
import type { CalendarEvent } from '@/types'

interface Props {
  year: number
  month: number
  selectedDay: number | null
  events: Record<string, CalendarEvent>
  onChangeMonth: (delta: number) => void
  onSelectDay: (day: number, key: string) => void
  /** 'mini' = date picker (past + today disabled). 'compact' = browse (only past disabled). */
  variant?: 'mini' | 'compact'
}

export function MonthCalendar({
  year,
  month,
  selectedDay,
  events,
  onChangeMonth,
  onSelectDay,
  variant = 'compact',
}: Props) {
  const cells = buildMonthGrid(year, month)
  const label = `${MONTH_NAMES[month]} ${year}`
  const picker = variant === 'mini'

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="cal-nav-btn" onClick={() => onChangeMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={15} />
        </button>
        <div className="text-[14px] font-semibold text-warm-900">{label}</div>
        <button type="button" className="cal-nav-btn" onClick={() => onChangeMonth(1)} aria-label="Next month">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-warm-400">
            {d[0]}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          const ev = cell.inMonth ? events[cell.key] : undefined
          const disabled = picker ? !cell.inMonth || cell.isPast || cell.isToday : cell.isPast
          const isSel = cell.inMonth && cell.day === selectedDay && !disabled
          const isDateDay = ev && (ev.type === 'confirmed' || ev.type === 'pending')

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => cell.inMonth && !disabled && onSelectDay(cell.day, cell.key)}
              className={cn(
                'cday text-[12px]',
                !cell.inMonth && 'other',
                cell.isToday && 'today',
                ev && 'has-ev',
                isDateDay && 'date-d',
                isSel && 'sel',
                disabled && 'disabled',
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
