/* eslint-disable @next/next/no-img-element -- static brand photos in /public, already web-sized */

import { cn } from '@/lib/utils'

export type BrandPhotoName = 'silhouette' | 'toast' | 'cafe' | 'dinner' | 'laugh'

/** One of the brand background photos (public/brand/bg). Decorative, so no alt text. */
export function BrandPhoto({
  name,
  position = '50% 50%',
  className,
  eager,
}: {
  name: BrandPhotoName
  position?: string
  className?: string
  eager?: boolean
}) {
  return (
    <img
      src={`/brand/bg/${name}.webp`}
      alt=""
      aria-hidden="true"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('select-none object-cover', className)}
      style={{ objectPosition: position }}
    />
  )
}
