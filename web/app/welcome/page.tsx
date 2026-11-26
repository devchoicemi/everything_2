'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from '@/components/ui/Logo'
import { WELCOME_IMAGES } from '@/lib/brandImages'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
})

/**
 * The native app's front door: splash, then this screen, then sign up or sign
 * in. A full-bleed photo that changes every few seconds, a brand-coloured
 * wash so the logo and buttons always read, and two large pill buttons.
 */
export default function WelcomePage() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % WELCOME_IMAGES.length), 5200)
    return () => clearInterval(t)
  }, [])

  const image = WELCOME_IMAGES[index]

  return (
    <main className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#1b0a3d] px-7 pb-[max(2.25rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-white">
      <AnimatePresence initial={false}>
        <motion.img
          key={image.src}
          src={image.src}
          alt={image.alt}
          className="absolute inset-0 -z-30 h-full w-full object-cover"
          style={{ objectPosition: image.position }}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1.12 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.2 }, scale: { duration: 7, ease: 'linear' } }}
        />
      </AnimatePresence>
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            'linear-gradient(180deg, rgba(27,10,61,0.78) 0%, rgba(27,10,61,0.10) 30%, rgba(46,16,101,0.35) 55%, rgba(76,29,149,0.88) 82%, rgba(27,10,61,0.97) 100%)',
        }}
      />

      <motion.div {...rise(0)} className="flex justify-center">
        <Logo tone="light" size={36} />
      </motion.div>

      <div className="flex-1" />

      <motion.div {...rise(0.15)} className="mx-auto w-full max-w-[420px] text-center">
        <h1 className="text-balance text-[34px] font-extrabold leading-[1.08] tracking-tight">
          Meet people for who they are.
        </h1>
        <p className="mx-auto mt-3 max-w-[20rem] text-[15.5px] leading-snug text-white/80">
          No photos on profiles. Matched on what you share, then a real first date.
        </p>

        <Link
          href="/signup"
          className="mt-8 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#6d28d9] via-[#c026d3] to-[#ec4899] px-6 py-4 text-[16px] font-bold text-white shadow-[0_10px_34px_rgba(192,38,211,0.45)] transition active:scale-[0.97]"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="mt-3 flex w-full items-center justify-center rounded-full border-2 border-white/80 px-6 py-3.5 text-[16px] font-bold text-white transition active:scale-[0.97]"
        >
          Sign in
        </Link>

        <p className="mt-5 text-[11.5px] leading-relaxed text-white/55">
          By tapping Create account or Sign in, you agree to our{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>
          . Learn how we process your data in our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    </main>
  )
}
