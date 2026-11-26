'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useLockBodyScroll } from '@/hooks'
import { cn } from '@/lib/utils'

/**
 * Responsive dialog: centred card on tablet/desktop, bottom sheet on mobile.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  dismissable = true,
  showClose = true,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  dismissable?: boolean
  showClose?: boolean
}) {
  useLockBodyScroll(open)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6"
          style={{ background: 'rgba(6,20,15,.55)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={() => dismissable && onClose()}
        >
          <motion.div
            className={cn(
              'no-scrollbar relative flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-[24px] bg-white shadow-xl sm:max-w-[460px] sm:rounded-3xl',
              className,
            )}
            initial={{ y: '4%', opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '4%', opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-warm-200 sm:hidden" />
            {showClose && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-warm-75 text-warm-500 transition hover:bg-warm-100 hover:text-warm-800"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            )}
            <div className="p-6 sm:p-7">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
