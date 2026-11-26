'use client'

import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/Logo'
import { WaitlistForm } from '@/components/common/WaitlistForm'
import { COMING_SOON_IMAGE } from '@/lib/brandImages'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
})

/**
 * Full-screen holding page for "/". A photo fills the screen under a purple
 * to pink wash that matches the logo, with one job above it: join the
 * waitlist. No navigation and no other links.
 */
export function ComingSoon() {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#1b0a3d] text-white">
      {/* photo, slowly drifting */}
      <motion.img
        src={COMING_SOON_IMAGE.src}
        alt={COMING_SOON_IMAGE.alt}
        className="absolute inset-0 -z-30 h-full w-full object-cover"
        style={{ objectPosition: COMING_SOON_IMAGE.position }}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1.16 }}
        transition={{ duration: 24, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      />
      {/* brand wash: legible at the top and bottom, lets the photo breathe in the middle */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            'linear-gradient(180deg, rgba(27,10,61,0.82) 0%, rgba(76,29,149,0.55) 38%, rgba(190,24,93,0.55) 72%, rgba(27,10,61,0.92) 100%)',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_100%,rgba(236,72,153,0.28),transparent)]" />

      <header className="flex justify-center px-6 pb-2 pt-[max(2rem,env(safe-area-inset-top))]">
        <motion.div {...rise(0)}>
          <Logo tone="light" size={34} />
        </motion.div>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div
          {...rise(0.1)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur-md"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-300 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pink-200" />
          </span>
          Coming soon
        </motion.div>

        <motion.h1
          {...rise(0.2)}
          className="text-balance text-[40px] font-extrabold leading-[1.04] tracking-tight sm:text-[60px]"
        >
          Meet people for who they are.
        </motion.h1>

        <motion.p {...rise(0.32)} className="mt-5 max-w-[30rem] text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
          ChoiceMi is anonymous, compatibility-first dating. No profile photos and no endless small talk. Read a
          profile, pass a quick check, then meet for a real first date.
        </motion.p>

        <motion.div {...rise(0.46)} className="mt-9 w-full max-w-[520px]">
          <WaitlistForm tone="dark" />
        </motion.div>
      </main>

      <motion.footer
        {...rise(0.6)}
        className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[12px] uppercase tracking-[0.2em] text-white/55"
      >
        Launching first in Helsinki
      </motion.footer>
    </div>
  )
}
