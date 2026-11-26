'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useStore } from '@/store'

export function MobileTopBar() {
  const city = useStore((s) => s.user.city)
  return (
    <div className="glass sticky top-0 z-30 flex items-center justify-between border-b border-warm-200 px-5 py-3 lg:hidden">
      <Link href="/discover">
        <Logo size={28} />
      </Link>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-warm-500">
        <MapPin size={13} className="text-brand-600" />
        {city}
      </span>
    </div>
  )
}
