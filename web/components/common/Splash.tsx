'use client'

import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/Logo'

/**
 * The branded loading moment shown while AppEntryGate decides where to send
 * a native-app launch, and the brief reveal that plays before a plain web
 * visit fades in. The logo on the same purple wash as the entry screens.
 */
export function Splash() {
  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style={{
        background:
          'radial-gradient(90% 70% at 50% 40%, #5b21b6 0%, transparent 70%), linear-gradient(160deg, #1b0a3d 0%, #3b0f6b 55%, #7a1559 100%)',
      }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 16 }}
      >
        <Logo tone="light" size={52} />
      </motion.div>

      <motion.div
        className="absolute bottom-16 h-[3px] w-[120px] overflow-hidden rounded-full bg-white/15"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-400"
          animate={{ x: ['-100%', '220%'] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
