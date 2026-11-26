'use client'

import { Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Venue } from '@/types'

export function VenueCard({
  venue,
  selected,
  onSelect,
}: {
  venue: Venue
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('venue-card block w-full text-left', selected && 'on')}
    >
      <div className="flex items-start gap-2.5">
        <span className="v-radio">
          <span className="v-radio-dot" />
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-warm-900">{venue.n}</div>
          <div className="mt-0.5 text-[12px] text-warm-500">{venue.area}</div>
          <div className="mt-0.5 text-[12px] text-warm-700">{venue.type}</div>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">
            <Gift size={11} />
            {venue.offer}
          </span>
        </div>
      </div>
    </button>
  )
}
