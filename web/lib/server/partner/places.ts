import { ApiError } from '../auth/http'
import { linkSecret } from '../auth/config'
import { safeEqual, signValue } from '../auth/crypto'

/**
 * Picking a venue's location. The spec says the venue picks it from a map search, never typed free text, and
 * that we keep the place id, coordinates and formatted address. Search results come back with a signed
 * `pick` token; saving the location needs that token, so only a result we returned can be saved.
 *
 * Google Places is used when GOOGLE_MAPS_API_KEY is set; otherwise OpenStreetMap's Nominatim (no key, same
 * pick-from-results behaviour) so the flow works before the key exists.
 */
export interface PlaceResult {
  provider: 'google' | 'osm'
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  pick: string
}

const secret = () => `place:${linkSecret() || 'dev-only-place-secret'}`

function sign(p: Omit<PlaceResult, 'pick'>): PlaceResult {
  const body = Buffer.from(JSON.stringify([p.provider, p.placeId, p.name, p.address, p.lat, p.lng])).toString('base64url')
  return { ...p, pick: `${body}.${signValue(secret(), body)}` }
}

/** The place behind a pick token, or null if it was not issued by us. */
export function readPick(pick: unknown): Omit<PlaceResult, 'pick'> | null {
  if (typeof pick !== 'string' || pick.length > 2000) return null
  const [body, sig] = pick.split('.')
  if (!body || !sig || !safeEqual(sig, signValue(secret(), body))) return null
  try {
    const [provider, placeId, name, address, lat, lng] = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as [PlaceResult['provider'], string, string, string, number, number]
    if ((provider !== 'google' && provider !== 'osm') || typeof placeId !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') return null
    return { provider, placeId, name: String(name), address: String(address), lat, lng }
  } catch {
    return null
  }
}

/** Searches near Helsinki first. Results are cached for a minute per query so typing does not hammer the provider. */
const cache = new Map<string, { at: number; results: PlaceResult[] }>()

export async function searchPlaces(queryText: unknown): Promise<PlaceResult[]> {
  const q = typeof queryText === 'string' ? queryText.trim().slice(0, 120) : ''
  if (q.length < 3) return []
  const hit = cache.get(q.toLowerCase())
  if (hit && Date.now() - hit.at < 60_000) return hit.results
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  let results: PlaceResult[]
  try {
    results = key ? await google(q, key) : await osm(q)
  } catch (e) {
    console.error('[places] search failed', (e as Error).message)
    throw new ApiError(503, 'search_unavailable', 'Place search is not available right now. Try again in a moment.')
  }
  cache.set(q.toLowerCase(), { at: Date.now(), results })
  if (cache.size > 200) cache.delete(cache.keys().next().value as string)
  return results
}

async function google(q: string, key: string): Promise<PlaceResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location' },
    body: JSON.stringify({ textQuery: q, regionCode: 'FI', locationBias: { circle: { center: { latitude: 60.1699, longitude: 24.9384 }, radius: 40000 } }, maxResultCount: 6 }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`google ${res.status}`)
  const data = (await res.json()) as { places?: { id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[] }
  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => sign({ provider: 'google', placeId: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '', lat: p.location!.latitude, lng: p.location!.longitude }))
}

async function osm(q: string): Promise<PlaceResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'fi', viewbox: '24.5,60.4,25.4,60.0' }).toString()
  const res = await fetch(url, { headers: { 'User-Agent': 'ChoiceMi-partner-portal/1.0 (admin@choicemi.com)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`osm ${res.status}`)
  const data = (await res.json()) as { osm_type: string; osm_id: number; name?: string; display_name: string; lat: string; lon: string }[]
  return data.map((p) => sign({ provider: 'osm', placeId: `${p.osm_type[0]}${p.osm_id}`, name: p.name || p.display_name.split(',')[0], address: p.display_name, lat: Number(p.lat), lng: Number(p.lon) }))
}
