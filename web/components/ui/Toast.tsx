'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store'

export function ToastViewport() {
  const toasts = useStore((s) => s.toasts)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[9999] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-auto max-w-[90vw] rounded-full px-5 py-2.5 text-center text-[13px] font-medium text-white shadow-[var(--sh-md)]"
            style={{
              background:
                t.tone === 'danger'
                  ? 'var(--dng)'
                  : t.tone === 'success'
                    ? 'var(--t7)'
                    : 'var(--w9)',
            }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
