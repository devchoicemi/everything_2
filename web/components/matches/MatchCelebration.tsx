'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { FullOverlay } from '@/components/common/FullOverlay'
import { useStore } from '@/store'
import type { Profile } from '@/types'

// The one deliberate, confirmed exception to the app's brand palette —
// literal Tinder red for this one celebratory moment only. Nothing else in
// the app uses these tokens.
const MATCH_RED = '#FF3B5C'
const MATCH_RED_DEEP = '#B0193A'
const CONFETTI_COLORS = ['#FF3B5C', '#FF7A93', '#fff', '#FFC2CE']

export function MatchCelebration({
  profile,
  score,
  open,
  onView,
  onKeepDiscovering,
}: {
  profile: Profile | null
  /** live overall % from the compatibility engine */
  score?: number
  open: boolean
  onView: () => void
  onKeepDiscovering: () => void
}) {
  const user = useStore((s) => s.user)

  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 0.7,
        duration: 1.1 + Math.random() * 0.9,
      })),
    // regenerate each time the overlay opens
    [open], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <FullOverlay
      open={open}
      background={`radial-gradient(120% 100% at 50% -10%, ${MATCH_RED} 0%, ${MATCH_RED_DEEP} 60%, #4A0518 100%)`}
    >
      {confetti.map((c) => (
        <span
          key={c.id}
          className="pointer-events-none absolute top-2 h-1.5 w-1.5 rounded-full"
          style={{
            left: `${c.left}%`,
            background: c.color,
            animation: `confettiFall ${c.duration}s ease-in ${c.delay}s forwards`,
          }}
        />
      ))}

      {profile && (
        <div className="flex flex-col items-center">
          {/* two big hearts colliding, Tinder's signature beat */}
          <div className="relative mb-1 flex h-[64px] items-center justify-center">
            <motion.div
              className="absolute text-white"
              initial={{ x: -46, scale: 0, rotate: -25 }}
              animate={{ x: -14, scale: 1, rotate: -12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.05 }}
            >
              <Heart size={44} fill="currentColor" />
            </motion.div>
            <motion.div
              className="absolute text-white"
              initial={{ x: 46, scale: 0, rotate: 25 }}
              animate={{ x: 14, scale: 1, rotate: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}
            >
              <Heart size={44} fill="currentColor" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.2 }}
            className="mb-2 text-center font-serif-i text-[38px] uppercase not-italic tracking-wide text-white"
            style={{ textShadow: '0 4px 24px rgba(0,0,0,.35)' }}
          >
            It&apos;s a match!
          </motion.div>
          <p className="mb-6 text-center text-[14px] leading-relaxed text-white/75">
            You and {profile.un} both said yes to each other.
          </p>

          {/* the two names, together, a heart between them */}
          <motion.div
            className="mb-6 flex w-full items-center justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                className="font-serif-i flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white/40 text-[24px] text-white shadow-lg"
                style={{ background: 'var(--t6)' }}
              >
                {user.username.charAt(0)}
              </span>
              <span className="max-w-full truncate text-[13px] font-semibold text-white">{user.username}</span>
            </div>

            <motion.span
              className="mb-5 flex-shrink-0 text-white/90"
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            >
              <Heart size={22} fill="currentColor" />
            </motion.span>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                className="font-serif-i flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white/40 text-[24px] text-white shadow-lg"
                style={{ background: profile.avc }}
              >
                {profile.av}
              </span>
              <span className="max-w-full truncate text-[13px] font-semibold text-white">{profile.un}</span>
            </div>
          </motion.div>

          <motion.div
            className="mb-4.5 w-full rounded-[22px] border border-white/25 bg-white/[.14] px-[18px] py-3.5 backdrop-blur-sm"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            {[
              ['Compatibility', score === undefined ? 'Calculating…' : `${score}% match`],
              ['Intent', profile.intent],
              ['Expires in', '7 days to propose a date'],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                className={
                  'flex justify-between py-1.5 text-[13px]' +
                  (i < arr.length - 1 ? ' border-b border-white/15' : '')
                }
              >
                <span className="text-white/65">{k}</span>
                <span className="font-semibold text-white">{v}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            className="mt-4 flex w-full flex-col gap-2.5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <button
              onClick={onView}
              className="flex w-full items-center justify-center rounded-full bg-white px-4 py-3.5 text-[15px] font-bold transition active:scale-95"
              style={{ color: MATCH_RED_DEEP }}
            >
              View match →
            </button>
            <button
              onClick={onKeepDiscovering}
              className="flex w-full items-center justify-center rounded-full border-[1.5px] border-white/30 px-4 py-2.5 text-[14px] font-medium text-white/80 transition active:scale-95"
            >
              Keep discovering
            </button>
          </motion.div>
        </div>
      )}
    </FullOverlay>
  )
}
