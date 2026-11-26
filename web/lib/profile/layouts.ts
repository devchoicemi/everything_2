import type { ProfileLayout } from '@/types'

/**
 * The CV-style profile designs a member can choose from. All are text-only
 * (ChoiceMi never shows photos); they differ in how the same sections are laid out.
 */
export const PROFILE_LAYOUTS: { id: ProfileLayout; label: string; desc: string }[] = [
  { id: 'timeline', label: 'Timeline', desc: 'Your story down a single line, easy to follow from top to bottom' },
  { id: 'sidebar', label: 'Sidebar', desc: 'A bold side panel with the essentials, your story on the right' },
  { id: 'colorblock', label: 'Colour block', desc: 'A strong header and clear blocks, quick to scan' },
  { id: 'bloom', label: 'Bloom', desc: 'Soft, warm and personal with a floral touch' },
]

export const DEFAULT_LAYOUT: ProfileLayout = 'timeline'

const LEGACY: Record<string, ProfileLayout> = {
  classic: 'timeline',
  editorial: 'bloom',
  minimal: 'sidebar',
}

/** Accepts current ids and the three older ones (classic / editorial / minimal). */
export function normalizeLayout(value: string | null | undefined): ProfileLayout {
  if (!value) return DEFAULT_LAYOUT
  if (PROFILE_LAYOUTS.some((l) => l.id === value)) return value as ProfileLayout
  return LEGACY[value] ?? DEFAULT_LAYOUT
}
