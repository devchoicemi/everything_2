'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useLockBodyScroll } from '@/hooks'

export function FullOverlay({
  open,
  children,
  background = 'rgba(10,74,55,.93)',
}: {
  open: boolean
  children: React.ReactNode
  background?: string
}) {
  useLockBodyScroll(open)
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-y-auto px-6 py-8"
          style={{ background, backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-full max-w-[420px]">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
