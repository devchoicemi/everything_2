'use client'

import { useEffect, useState } from 'react'
import { LIVE } from '@/lib/live'
import { bookingsApi } from '@/services/bookings'
import { useStore } from '@/store'

/**
 * The little counts on the navigation: matches with no date in motion, and dates waiting for my move
 * (options to answer, a pick to confirm). Real accounts count their own; the offline demo keeps its sample.
 */
export function useNavBadges(): Record<string, string | undefined> {
  const waiting = useStore((s) => s.matches.filter((m) => !m.inMotion).length)
  const [needsMe, setNeedsMe] = useState(0)
  useEffect(() => {
    if (!LIVE) return
    let off = false
    const load = () =>
      bookingsApi
        .list()
        .then((r) => !off && setNeedsMe(r.bookings.filter((b) => b.needsMe).length))
        .catch(() => {})
    void load()
    const t = setInterval(load, 60_000)
    return () => {
      off = true
      clearInterval(t)
    }
  }, [])
  if (!LIVE) return { '/matches': '3' }
  return { '/matches': waiting ? String(waiting) : undefined, '/dates': needsMe ? String(needsMe) : undefined }
}
