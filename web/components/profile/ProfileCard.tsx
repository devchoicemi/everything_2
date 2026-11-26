'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { Check, Coffee, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

const PASS_THRESHOLD = 110
const GROW_RANGE = 220

export function ProfileCard({
  profile,
  score,
  behind,
  behind2,
  exiting,
  onOpen,
  onPass,
}: {
  profile: Profile
  /** live compatibility % from the engine — undefined while still loading */
  score?: number
  /** the next profile in the queue — rendered as a Tinder-style card underneath */
  behind?: Profile
  /** one more back — a third, mostly-static layer for stack depth */
  behind2?: Profile
  exiting?: 'like' | 'pass' | null
  onOpen: () => void
  /**
   * Optional drag-to-pass, Tinder-style. Deliberately one-directional: a
   * right swipe never "likes" here — liking requires reading the full
   * profile and passing the read-check first (requirement: no liking
   * without reading), so a right drag just springs back with a hint.
   */
  onPass?: () => void
}) {
  const scoreLabel = score === undefined ? '···' : `${score}%`
  const reducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-GROW_RANGE, GROW_RANGE], [-9, 9])
  const passHintOpacity = useTransform(x, [-PASS_THRESHOLD, -30, 0], [1, 0, 0])
  const passHintScale = useTransform(x, [-PASS_THRESHOLD, -20, 0], [1, 0.75, 0.6])
  const readHintOpacity = useTransform(x, [0, 30, PASS_THRESHOLD], [0, 0, 1])
  const readHintScale = useTransform(x, [0, 20, PASS_THRESHOLD], [0.6, 0.75, 1])
  // the card directly underneath "grows" into place as the top card is dragged away —
  // in either direction, mirroring how Tinder's stack reacts to drag distance alone.
  const ghostScale = useTransform(x, [-GROW_RANGE, 0, GROW_RANGE], [1, 0.95, 1])
  const ghostY = useTransform(x, [-GROW_RANGE, 0, GROW_RANGE], [0, 10, 0])
  const ghostOpacity = useTransform(x, [-GROW_RANGE, 0, GROW_RANGE], [1, 0.82, 1])
  const draggingRef = useRef(false)

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const committed = info.offset.x < -PASS_THRESHOLD || info.velocity.x < -650
    if (committed && onPass) onPass()
    // small delay so the trailing click event (if the browser fires one) is still suppressed
    setTimeout(() => {
      draggingRef.current = false
    }, 50)
  }

  const draggable = !reducedMotion && !!onPass && !exiting

  return (
    <div className="relative">
      {behind2 && (
        <div
          className="absolute inset-x-8 top-6 z-0 h-20 origin-top scale-[.9] overflow-hidden rounded-3xl border border-warm-100 bg-white opacity-45 shadow-sm"
          aria-hidden
        >
          <div className="h-1.5 bg-brand-cta" />
        </div>
      )}

      {behind && (
        <motion.div
          className="absolute inset-x-3 top-2 z-[1] origin-top overflow-hidden rounded-3xl border border-warm-100 bg-white shadow-sm"
          style={
            draggable
              ? { scale: ghostScale, y: ghostY, opacity: ghostOpacity }
              : { scale: 0.96, y: 8, opacity: 0.75 }
          }
          aria-hidden
        >
          <div className="h-1.5 bg-brand-cta" />
          <div className="flex items-center gap-3 px-6 pb-4 pt-3.5 sm:px-8">
            <Avatar letter={behind.av} color={behind.avc} size={44} />
            <div>
              <div className="font-serif-i text-[16px] text-warm-900">{behind.un}</div>
              <div className="text-[12px] text-warm-500">
                {behind.age} · {behind.city}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        drag={draggable ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.65}
        onDragStart={() => {
          draggingRef.current = true
        }}
        onDragEnd={handleDragEnd}
        style={draggable ? { x, rotate } : undefined}
        className="relative z-[2]"
      >
        {draggable && (
          <>
            <motion.div
              style={{ opacity: passHintOpacity, scale: passHintScale, rotate: -18 }}
              className="pointer-events-none absolute left-6 top-8 z-10 rounded-xl border-[3px] border-danger bg-white/95 px-4 py-1.5 text-[22px] font-black uppercase tracking-wider text-danger shadow-lg"
            >
              Nope
            </motion.div>
            <motion.div
              style={{ opacity: readHintOpacity, scale: readHintScale, rotate: 18 }}
              className="pointer-events-none absolute right-6 top-8 z-10 rounded-xl border-[3px] border-brand-600 bg-white/95 px-4 py-1.5 text-[22px] font-black uppercase tracking-wider text-brand-700 shadow-lg"
            >
              Read
            </motion.div>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            if (draggingRef.current) return
            onOpen()
          }}
          className={cn(
            'cm-card-in lift relative block w-full overflow-hidden rounded-3xl border border-warm-100 bg-white text-left shadow-lg',
            exiting === 'like' && 'swipe-r',
            exiting === 'pass' && 'swipe-l',
          )}
        >
          <div className="h-1.5 bg-brand-cta" />

          <div className="border-b border-warm-100 bg-[linear-gradient(155deg,var(--t0)_0%,transparent_62%)] px-6 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <Avatar letter={profile.av} color={profile.avc} size={64} />
              <div className="flex-1">
                <div className="font-serif-i text-[23px] tracking-tight text-warm-900">{profile.un}</div>
                <div className="mt-0.5 text-[13px] text-warm-500">
                  {profile.age} · {profile.city}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="verified">
                    <Check size={12} /> Verified
                  </Badge>
                  <Badge tone="intent">{profile.intent}</Badge>
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className={cn('font-serif-i text-[30px] leading-none text-brand-700', score === undefined && 'animate-pulse-soft')}>
                  {scoreLabel}
                </div>
                <div className="text-[11px] text-warm-400">match</div>
              </div>
            </div>

            <p className="mt-4 text-[15px] italic leading-relaxed text-warm-700">{profile.headline}</p>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-warm-100">
                <div
                  className={cn('h-full rounded-full bg-brand-500', score !== undefined && 'cm-bar')}
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>
              <span className="text-[13px] font-bold text-brand-700 sm:hidden">{scoreLabel}</span>
            </div>

            {profile.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.tags.slice(0, 5).map((t) => (
                  <span key={t} className="chip brand sm">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <div>
              <div className="sec-lbl">Lifestyle</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.ls.map((t) => (
                  <span key={t} className="chip sm">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="sec-lbl">Ideal first date</div>
              <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-3">
                <Coffee size={16} className="flex-shrink-0 text-brand-700" />
                <span className="text-[13px] font-medium text-brand-800">{profile.ds}</span>
              </div>
            </div>

            {/* shown here on mobile; the desktop layout surfaces it in the right rail */}
            <div className="sm:col-span-2 lg:hidden">
              <div className="sec-lbl">Why you might connect</div>
              <div className="space-y-1.5">
                {profile.hl.slice(0, 2).map((h) => (
                  <div key={h.t} className="flex items-start gap-2 text-[13px] leading-snug text-warm-700">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
                    {h.t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-warm-100 bg-warm-50 px-6 py-3 text-center text-[12.5px] font-medium text-brand-700 sm:px-8">
            {draggable ? (
              <span className="inline-flex items-center gap-1.5">
                <X size={13} /> Swipe left to pass · tap to open full profile →
              </span>
            ) : (
              'Open full profile →'
            )}
          </div>
        </button>
      </motion.div>
    </div>
  )
}
