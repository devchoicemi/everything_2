export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requirePartner } from '@/lib/server/partner/access'
import { parseSlot, removePhoto, savePhoto } from '@/lib/server/partner/photos'
import { pathAfter } from '@/lib/server/social/http'

/** Upload one of the four photos (multipart: photo, noPeople, noFilters, recent). */
export const POST = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  const form = await req.formData()
  return json(await savePhoto(req, ctx, parseSlot(pathAfter(req, 'photos')), form))
})

export const DELETE = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  return json(await removePhoto(req, ctx, parseSlot(pathAfter(req, 'photos'))))
})
