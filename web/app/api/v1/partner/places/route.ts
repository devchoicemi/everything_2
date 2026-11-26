export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requireLive, requirePartner } from '@/lib/server/partner/access'
import { pathAfter } from '@/lib/server/social/http'
import { searchPlaces } from '@/lib/server/partner/places'

/** Search for your venue on the map: ?q=name or address. Only these results can be saved as the location. */
export const GET = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner-places', ctx.user.id, 120, 3600)
  return json({ places: await searchPlaces(new URL(req.url).searchParams.get('q')) })
})
