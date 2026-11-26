import {
  BookOpen,
  Coffee,
  Footprints,
  Gem,
  Leaf,
  MapPin,
  Megaphone,
  MessageCircle,
  Baby,
  Sparkles,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import type { ConnectReasonIconKey } from '@/types'

/** Maps each ConnectReason icon key to the lucide-react icon that replaced its former emoji. */
export const CONNECT_REASON_ICONS: Record<ConnectReasonIconKey, LucideIcon> = {
  chat: MessageCircle,
  coffee: Coffee,
  leaf: Leaf,
  active: Footprints,
  talk: Megaphone,
  pin: MapPin,
  book: BookOpen,
  walk: Footprints,
  curious: Sparkles,
  serious: Gem,
  family: Baby,
  casual: Sprout,
}

export function ConnectReasonIcon({
  kind,
  size,
  className,
}: {
  kind: ConnectReasonIconKey
  size?: number
  className?: string
}) {
  const Icon = CONNECT_REASON_ICONS[kind]
  return <Icon size={size} className={className} />
}
