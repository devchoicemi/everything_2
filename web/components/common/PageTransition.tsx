import { cn } from '@/lib/utils'

/**
 * Screen-to-screen slide-in, mirroring the reference prototype's transitions.
 * CSS-driven and visible-by-default so a stalled animation clock never hides
 * a whole route.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('cm-page', className)}>{children}</div>
}
