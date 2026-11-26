/* eslint-disable @next/next/no-img-element -- static assets in /public, sized explicitly below */

import { cn } from '@/lib/utils'

// Aspect ratios of the exported lockup / mark (see public/brand).
const LOCKUP_RATIO = 900 / 262
const MARK_RATIO = 247 / 256

/**
 * The ChoiceMi logo. `tone` is the surface it sits on: "dark" (default) for
 * light backgrounds, "light" for dark or photo backgrounds.
 *
 * The blue half of the logo's gradient is too dark to read on a purple or
 * photo background, so on those surfaces it sits on a white rounded plate
 * instead of floating directly on the background.
 *
 * `size` is the height of the heart mark in px; the full lockup (mark plus
 * wordmark) is drawn slightly taller so the wordmark reads at a comfortable
 * weight next to it.
 */
export function Logo({
  size = 36,
  tone = 'dark',
  wordmark = true,
  className,
}: {
  size?: number
  tone?: 'dark' | 'light'
  wordmark?: boolean
  className?: string
}) {
  const height = wordmark ? Math.round(size * 1.15) : size
  const width = Math.round(height * (wordmark ? LOCKUP_RATIO : MARK_RATIO))

  const image = (
    <img
      src={`/brand/${wordmark ? 'logo' : 'mark'}-on-light.webp`}
      alt="ChoiceMi"
      width={width}
      height={height}
      className="flex-shrink-0 select-none object-contain"
      style={{ width, height }}
      draggable={false}
    />
  )

  if (tone === 'dark') return <span className={cn('inline-flex', className)}>{image}</span>

  const pad = Math.max(5, Math.round(size * 0.17))
  return (
    <span
      className={cn('inline-flex items-center justify-center bg-white/95 shadow-lg ring-1 ring-white/60', className)}
      style={{ padding: `${pad}px ${Math.round(pad * 1.9)}px`, borderRadius: 999 }}
    >
      {image}
    </span>
  )
}
