import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { logEvent } from '../auth/events'
import { rateLimit } from '../auth/rateLimit'
import { readImage } from './imageInfo'
import { requireOwner, type PartnerContext } from './access'

/**
 * The venue's four photos (outside, entrance, inside looking in, inside looking back). The rules from the
 * spec are checked here: landscape, at least 1600 px on the long edge, JPG/PNG/HEIC, 10 MB at most, taken in
 * the last 12 months (when the file says). What a program cannot see (no faces, no filters) the venue
 * confirms when uploading, and a person at ChoiceMi checks each photo at review.
 */
export const PHOTO_SLOTS = [1, 2, 3, 4] as const
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024
export const PHOTO_MIN_LONG_EDGE = 1600

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), '.data', 'uploads'))

const EXT = { jpeg: 'jpg', png: 'png', heic: 'heic' } as const

const fileFor = (venueId: string, slot: number, ext: string) => path.join(uploadDir(), 'venue-photos', venueId.replace(/[^a-z0-9-]/gi, '_'), `${slot}.${ext}`)

export function parseSlot(v: unknown): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new ApiError(404, 'not_found', 'No such photo.')
  return n
}

export async function savePhoto(req: Request, ctx: PartnerContext, slot: number, form: FormData) {
  requireOwner(ctx)
  if (ctx.venue.review_status === 'submitted') throw new ApiError(409, 'in_review', 'ChoiceMi is reviewing your application.')
  await rateLimit('venue-photo', ctx.venue.id, 40, 3600)
  const file = form.get('photo')
  if (!(file instanceof File)) throw new ApiError(400, 'invalid_request', 'Choose a photo to upload.')
  for (const k of ['noPeople', 'noFilters', 'recent']) {
    if (form.get(k) !== 'true') throw new ApiError(400, 'confirm_required', 'Please tick all three boxes to confirm the photo follows the rules.')
  }
  if (file.size > PHOTO_MAX_BYTES) throw new ApiError(400, 'photo_too_large', 'This photo is over 10 MB. Export it smaller and try again.')
  const buf = Buffer.from(await file.arrayBuffer())
  const info = readImage(buf)
  if (!info) throw new ApiError(400, 'photo_type', 'Use a JPG, PNG or HEIC photo.')
  if (info.width < info.height) throw new ApiError(400, 'photo_portrait', 'Turn your phone sideways: the photo must be landscape.')
  if (Math.max(info.width, info.height) < PHOTO_MIN_LONG_EDGE) throw new ApiError(400, 'photo_small', `This photo is ${info.width} × ${info.height}. The long side must be at least ${PHOTO_MIN_LONG_EDGE} pixels.`)
  if (info.takenAt) {
    const age = Date.now() - info.takenAt.getTime()
    if (age > 366 * 86_400_000) throw new ApiError(400, 'photo_old', 'This photo was taken over 12 months ago. Please take a new one.')
  }
  const ext = EXT[info.kind]
  const dest = fileFor(ctx.venue.id, slot, ext)
  await mkdir(path.dirname(dest), { recursive: true })
  for (const other of Object.values(EXT)) if (other !== ext) await rm(fileFor(ctx.venue.id, slot, other), { force: true })
  await writeFile(dest, buf)
  const db = await getDb()
  await db.query(
    `insert into venue_photos (venue_id, slot, file_name, mime, width, height, bytes, status, reject_reason, checks, taken_on)
     values ($1, $2, $3, $4, $5, $6, $7, 'pending', '', $8::jsonb, $9)
     on conflict (venue_id, slot) do update set file_name = excluded.file_name, mime = excluded.mime, width = excluded.width, height = excluded.height,
       bytes = excluded.bytes, status = 'pending', reject_reason = '', checks = excluded.checks, taken_on = excluded.taken_on, created_at = now()`,
    [ctx.venue.id, slot, path.basename(dest), info.mime, info.width, info.height, buf.length, JSON.stringify({ noPeople: true, noFilters: true, recent: true, exif: Boolean(info.takenAt) }), info.takenAt ? info.takenAt.toISOString().slice(0, 10) : null],
  )
  await logEvent(db, 'venue_photo_saved', req, ctx.user.id, { venue: ctx.venue.id, slot })
  return { ok: true as const, slot, width: info.width, height: info.height }
}

export async function removePhoto(req: Request, ctx: PartnerContext, slot: number) {
  requireOwner(ctx)
  if (ctx.venue.review_status === 'submitted') throw new ApiError(409, 'in_review', 'ChoiceMi is reviewing your application.')
  const db = await getDb()
  const row = (await db.query<{ file_name: string }>('delete from venue_photos where venue_id = $1 and slot = $2 returning file_name', [ctx.venue.id, slot])).rows[0]
  if (row) await rm(path.join(uploadDir(), 'venue-photos', ctx.venue.id.replace(/[^a-z0-9-]/gi, '_'), row.file_name), { force: true })
  return { ok: true as const }
}

/** The bytes of a photo, for staff of the venue, ChoiceMi admins, or (once approved) anyone signed in. */
export async function readPhoto(venueId: string, slot: number, access: { staffOfVenue: boolean; admin: boolean }): Promise<{ data: Buffer; mime: string } | null> {
  const db = await getDb()
  const row = (await db.query<{ file_name: string; mime: string; status: string; review_status: string }>(
    `select p.file_name, p.mime, p.status, v.review_status from venue_photos p join venues v on v.id = p.venue_id where p.venue_id = $1 and p.slot = $2`,
    [venueId, slot],
  )).rows[0]
  if (!row) return null
  const public_ = row.status === 'accepted' && row.review_status === 'approved'
  if (!public_ && !access.staffOfVenue && !access.admin) return null
  try {
    return { data: await readFile(path.join(uploadDir(), 'venue-photos', venueId.replace(/[^a-z0-9-]/gi, '_'), row.file_name)), mime: row.mime }
  } catch {
    return null
  }
}
