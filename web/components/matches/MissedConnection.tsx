'use client'

import { motion } from 'framer-motion'
import { HeartCrack } from 'lucide-react'
import { FullOverlay } from '@/components/common/FullOverlay'
import { Avatar } from '@/components/ui/Avatar'
import type { Profile } from '@/types'

/**
 * The gentler counterpart to MatchCelebration — shown when a like doesn't
 * turn out to be mutual. Deliberately stays on-brand (brand purple, not the match
 * screen's red) since this is a soft letdown, not a celebration; the "MISSED"
 * stamp on the avatar is the one visual nod to Tinder/Bumble's rejection-card
 * language, kept tasteful rather than harsh.
 */
export function MissedConnection({
  profile,
  open,
  onClose,
}: {
  profile: Profile | null
  open: boolean
  onClose: () => void
}) {
  return (
    <FullOverlay open={open} background="rgba(6,20,15,.95)">
      {profile && (
        <div className="flex flex-col items-center">
          <motion.div
            className="relative mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 16 }}
          >
            <div className="opacity-50 grayscale">
              <Avatar letter={profile.av} color={profile.avc} size={84} ring />
            </div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 1.6, opacity: 0, rotate: -18 }}
              animate={{ scale: 1, opacity: 1, rotate: -18 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 14 }}
            >
              <span className="rounded-md border-2 border-danger/80 px-2.5 py-0.5 text-[13px] font-black uppercase tracking-wider text-danger">
                Missed
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="mb-1.5 flex items-center gap-2 text-[13px] text-white/50"
          >
            <HeartCrack size={15} />
            Missed connection
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.35 }}
            className="mb-2 text-center font-serif text-[24px] text-white"
          >
            Not this time
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.36, duration: 0.35 }}
            className="mb-8 max-w-[300px] text-center text-[14px] leading-relaxed text-white/65"
          >
            You liked {profile.un}, but it wasn&apos;t mutual this time. That happens. The right
            match is still ahead.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44, duration: 0.35 }}
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-full bg-white px-4 py-3.5 text-[15px] font-bold text-brand-800 transition active:scale-95"
          >
            Keep discovering →
          </motion.button>
        </div>
      )}
    </FullOverlay>
  )
}
