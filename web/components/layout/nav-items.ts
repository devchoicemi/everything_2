import { CalendarDays, Compass, Heart, User, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/matches', label: 'Matches', icon: Heart },
  { href: '/dates', label: 'Dates', icon: CalendarDays },
  { href: '/profile', label: 'Profile', icon: User },
]
