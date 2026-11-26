'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /** seconds */
  delay?: number
}

/**
 * Reveals its child when scrolled into view. Base state is fully visible, so if
 * the observer never fires (SSR, reduced motion, a frozen/hidden tab) the
 * content still shows — the animation only adds motion, never hides.
 */
export function ScrollReveal({ delay = 0, className, children, style, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  return (
    <div
      ref={ref}
      className={cn('cm-scroll', inView && 'is-in', className)}
      style={{ animationDelay: inView && delay ? `${delay}s` : undefined, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
