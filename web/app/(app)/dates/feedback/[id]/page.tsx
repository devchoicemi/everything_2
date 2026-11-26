import { DATE_BOOKINGS } from '@/lib/mock-data'
import FeedbackView from './view'

export function generateStaticParams() {
  const all = [...DATE_BOOKINGS.past, ...DATE_BOOKINGS.upcoming, ...DATE_BOOKINGS.pending]
  return all.map((b) => ({ id: String(b.id) }))
}

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  return <FeedbackView params={await params} />
}
