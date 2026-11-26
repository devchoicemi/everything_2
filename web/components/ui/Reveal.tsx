import { cn } from '@/lib/utils'

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  slow?: boolean
}

/**
 * Fade + rise on mount. CSS-driven and visible-by-default: if the animation
 * clock is stalled (background tab, reduced motion, no JS) the content still
 * shows. Mirrors the reference design's `.fu` reveal.
 */
export function Reveal({ slow, className, children, ...props }: RevealProps) {
  return (
    <div className={cn(slow ? 'cm-reveal-slow' : 'cm-reveal', className)} {...props}>
      {children}
    </div>
  )
}
