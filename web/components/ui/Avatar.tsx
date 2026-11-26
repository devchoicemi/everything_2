import { cn } from '@/lib/utils'

/** Single-letter avatar — the "no photo" rule. Colour is the identity. */
export function Avatar({
  letter,
  color,
  size = 56,
  className,
  ring,
}: {
  letter: string
  color: string
  size?: number
  className?: string
  ring?: boolean
}) {
  return (
    <span
      className={cn(
        'font-serif-i inline-flex flex-shrink-0 items-center justify-center rounded-full text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.4,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        border: ring ? '3px solid rgba(255,255,255,.25)' : undefined,
      }}
    >
      {letter}
    </span>
  )
}
