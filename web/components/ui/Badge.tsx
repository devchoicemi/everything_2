import { cn } from '@/lib/utils'

type BadgeTone = 'verified' | 'plus' | 'intent' | 'confirmed' | 'pending' | 'neutral'

const map: Record<BadgeTone, string> = {
  verified: 'bv',
  plus: 'bs',
  intent: 'bi',
  confirmed: 'bc',
  pending: 'bp',
  neutral: '',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: { tone?: BadgeTone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('badge', map[tone], tone === 'neutral' && 'bg-warm-100 text-warm-500', className)}
      {...props}
    >
      {children}
    </span>
  )
}
