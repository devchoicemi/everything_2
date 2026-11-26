/**
 * Background photos for the full-screen entry screens. Files live in
 * public/brand/bg. `position` is the CSS object-position that keeps the
 * subject in frame when the photo is cropped to a phone or a wide screen.
 */
export interface BrandImage {
  src: string
  position: string
  alt: string
}

export const COMING_SOON_IMAGE: BrandImage = {
  src: '/brand/bg/silhouette.webp',
  position: '50% 40%',
  alt: '',
}

/** Rotated on the welcome screen, in this order. */
export const WELCOME_IMAGES: BrandImage[] = [
  { src: '/brand/bg/silhouette.webp', position: '50% 40%', alt: '' },
  { src: '/brand/bg/toast.webp', position: '45% 30%', alt: '' },
  { src: '/brand/bg/cafe.webp', position: '40% 45%', alt: '' },
  { src: '/brand/bg/dinner.webp', position: '40% 35%', alt: '' },
  { src: '/brand/bg/laugh.webp', position: '65% 40%', alt: '' },
]
