import { MATCHES, PROFILES } from '@/lib/mock-data'
import MatchDetailView from './view'

// Pre-generated ids: seeded matches plus every Discover profile (liking one
// creates a match with that profile's id). Required by the static export.
export function generateStaticParams() {
  const ids = new Set([...MATCHES.map((m) => m.id), ...PROFILES.map((p) => p.id)])
  return [...ids].map((id) => ({ id: String(id) }))
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <MatchDetailView params={await params} />
}
