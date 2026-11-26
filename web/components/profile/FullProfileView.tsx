'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { ProfileCVView } from '@/components/profile/ProfileCVView'
import { cvFromProfile } from '@/lib/profile/cv'
import { normalizeLayout } from '@/lib/profile/layouts'
import { cn } from '@/lib/utils'
import type { CategoryResult } from '@/lib/compat/types'
import type { Profile } from '@/types'

/**
 * The full, readable profile. Unlocks the "I've read this" action once the
 * reader has scrolled a sentinel near the end of the content into view; it works
 * with any scroll container (page or panel).
 *
 * The profile is drawn as a CV in the design its owner chose (`profile.layout`):
 * timeline, sidebar, colour block or bloom. All four share the same read tracking,
 * so the read-check gate behaves identically whichever one is showing.
 */
export function FullProfileView({
  profile,
  score,
  categories,
  onReadEnough,
}: {
  profile: Profile
  /** live overall % from the compatibility engine; undefined while loading */
  score?: number
  /** live per-fit-category breakdown from the compatibility engine */
  categories?: CategoryResult[]
  onReadEnough: (v: boolean) => void
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(false)

  useEffect(() => {
    setRead(false)
    onReadEnough(false)
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRead(true)
          onReadEnough(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const cv = useMemo(() => cvFromProfile(profile), [profile])

  return (
    <ProfileCVView
      cv={cv}
      layout={normalizeLayout(profile.layout)}
      score={score}
      showCompat
      categories={categories}
      sentinel={sentinel}
      footer={<ReadFooter read={read} />}
    />
  )
}

function ReadFooter({ read }: { read: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 px-6 py-4 text-center text-[13px] transition-colors duration-300 sm:px-8',
        read ? 'bg-brand-50 font-medium text-brand-700' : 'bg-warm-50 text-warm-400',
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {read ? (
          <motion.span
            key="read"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Check size={14} strokeWidth={3} />
            You&apos;ve read the full profile, you can continue
          </motion.span>
        ) : (
          <motion.span key="unread" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Scroll to the end of the profile to continue
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
