import { redirect } from 'next/navigation'
import { PROFILES } from '@/lib/mock-data'

export function generateStaticParams() {
  return PROFILES.map((p) => ({ id: String(p.id) }))
}

/** Full-profile reading happens inline on /discover to preserve feed state. */
export default function DiscoverProfileRedirect() {
  redirect('/discover')
}
