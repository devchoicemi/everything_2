// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { outbox } from '@/lib/server/auth/mailer'
import { smsOutbox } from '@/lib/server/auth/sms'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as verifyEmail } from '@/app/api/v1/auth/email/verify/route'
import { GET as pMe } from '@/app/api/v1/partner/me/route'
import { GET as pOnboarding } from '@/app/api/v1/partner/onboarding/route'
import { PUT as pBasics } from '@/app/api/v1/partner/onboarding/basics/route'
import { PUT as pLocation } from '@/app/api/v1/partner/onboarding/location/route'
import { PUT as pHours } from '@/app/api/v1/partner/onboarding/hours/route'
import { PUT as pContact } from '@/app/api/v1/partner/onboarding/contact/route'
import { PUT as pOffer } from '@/app/api/v1/partner/onboarding/offer/route'
import { POST as pTerms } from '@/app/api/v1/partner/onboarding/terms/route'
import { POST as pSubmit } from '@/app/api/v1/partner/onboarding/submit/route'
import { POST as pReadiness } from '@/app/api/v1/partner/onboarding/readiness/route'
import { POST as pGoLive } from '@/app/api/v1/partner/onboarding/go-live/route'
import { POST as pStatus } from '@/app/api/v1/partner/onboarding/status/route'
import { POST as pEmailLink } from '@/app/api/v1/partner/onboarding/contact/email-link/route'
import { POST as pPhoneCode } from '@/app/api/v1/partner/onboarding/contact/phone-code/route'
import { POST as pPhoneVerify } from '@/app/api/v1/partner/onboarding/contact/phone-verify/route'
import { POST as pVerifyContact } from '@/app/api/v1/partner/verify-contact/route'
import { GET as pTest } from '@/app/api/v1/partner/onboarding/test/route'
import { POST as pTestStart } from '@/app/api/v1/partner/onboarding/test/start/route'
import { GET as pPlaces } from '@/app/api/v1/partner/places/route'
import { POST as pPhotoPost, DELETE as pPhotoDelete } from '@/app/api/v1/partner/onboarding/photos/[slot]/route'
import { GET as venuePhoto } from '@/app/api/v1/venues/[id]/photos/[slot]/route'
import { GET as pAvail } from '@/app/api/v1/partner/availability/route'
import { POST as pClosureAdd } from '@/app/api/v1/partner/closures/route'
import { DELETE as pClosureDel } from '@/app/api/v1/partner/closures/[id]/route'
import { GET as pRequests } from '@/app/api/v1/partner/requests/route'
import { POST as pConfirm } from '@/app/api/v1/partner/bookings/[id]/confirm/route'
import { POST as pScan } from '@/app/api/v1/partner/checkin/scan/route'
import { POST as pEnd } from '@/app/api/v1/partner/bookings/[id]/end/route'
import { GET as pTeam } from '@/app/api/v1/partner/team/route'
import { POST as pInvite } from '@/app/api/v1/partner/team/invite/route'
import { DELETE as pRemove } from '@/app/api/v1/partner/team/[id]/route'
import { GET as aVenues } from '@/app/api/v1/admin/venues/route'
import { GET as aVenue } from '@/app/api/v1/admin/venues/[id]/route'
import { POST as aReview } from '@/app/api/v1/admin/venues/[id]/review/route'
import { POST as sInvite } from '@/app/api/v1/admin/staff/invite/route'
import { GET as listVenues } from '@/app/api/v1/venues/route'
import { GET as venueSlots } from '@/app/api/v1/venues/[id]/slots/route'
import { POST as adminCreate } from '@/app/api/v1/admin/partners/create/route'
import { validBusinessId } from '@/lib/server/partner/ytj'
import { PW, cookieOf, fakeJpeg, j, member, multipart, plusDays, req } from '@/lib/server/testkit'

const ADMIN = 'o'.repeat(48)
const bearer = { authorization: `Bearer ${ADMIN}` }
let n = 0
let uploads = ''
const realFetch = globalThis.fetch

/** A Business ID with a correct check digit. */
function businessId(seed = 2345678 + ++n): string {
  const digits = String(seed).padStart(7, '0')
  const w = [7, 9, 10, 5, 8, 4, 2]
  const sum = [...digits].reduce((a, d, i) => a + Number(d) * w[i], 0)
  const rem = sum % 11
  if (rem === 1) return businessId(seed + 1)
  return `${digits}-${rem === 0 ? 0 : 11 - rem}`
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  process.env.ADMIN_TOKEN = ADMIN
  uploads = mkdtempSync(path.join(tmpdir(), 'cm-uploads-'))
  process.env.UPLOAD_DIR = uploads
  delete process.env.APP_LAUNCHED
  delete process.env.REQUIRE_EMAIL_VERIFICATION
  delete process.env.GOOGLE_MAPS_API_KEY
  await getDb()
  // the trade register and the map search are outside services: answered here, not on the internet
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('avoindata.prh.fi')) {
        const id = new URL(url).searchParams.get('businessId')
        if (id === '9999999-9') return new Response('{}', { status: 404 })
        return Response.json({ companies: [{ names: [{ name: 'Kahvila Aalto Oy', type: '1', endDate: null }], companyForms: [{ descriptions: [{ languageCode: '3', description: 'Limited company' }] }], registrationDate: '2015-01-01', status: 'Registered' }] })
      }
      if (url.includes('nominatim.openstreetmap.org')) {
        return Response.json([{ osm_type: 'node', osm_id: 4242, name: 'Kahvila Aalto', display_name: 'Kahvila Aalto, Rautatientori 2, 00100 Helsinki, Finland', lat: '60.1712', lon: '24.9414' }])
      }
      return realFetch(input)
    }),
  )
}, 60_000)
beforeEach(() => {
  outbox.length = 0
  smsOutbox.length = 0
})
afterAll(async () => {
  vi.unstubAllGlobals()
  delete process.env.ADMIN_TOKEN
  delete process.env.UPLOAD_DIR
  rmSync(uploads, { recursive: true, force: true })
  process.env.APP_LAUNCHED = '1'
  await resetDb()
})

const call = (h: (r: Request) => Promise<Response>, path: string, cookie: string | null, method: string, body?: unknown) => h(req(path, { method, body, ...(cookie ? { cookie } : { headers: bearer }) }))
const get = (h: (r: Request) => Promise<Response>, path: string, cookie: string | null) => call(h, path, cookie, 'GET')
const post = (h: (r: Request) => Promise<Response>, path: string, cookie: string | null, body: unknown = {}) => call(h, path, cookie, 'POST', body)
const put = (h: (r: Request) => Promise<Response>, path: string, cookie: string | null, body: unknown = {}) => call(h, path, cookie, 'PUT', body)

/** A restaurant starting its application: account created, email confirmed with the code from the email. */
async function applicant() {
  const email = `owner${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, applyAsPartner: true, contactName: 'Aino Mäkinen' } }))
  expect(res.status).toBe(201)
  const cookie = cookieOf(res)
  const mail = outbox.find((m) => m.to === email)!
  expect(mail.text).toMatch(/localhost:3200\/verify-email/)
  const code = /\b(\d{6})\b/.exec(mail.text)![1]
  expect((await post(verifyEmail, '/api/v1/auth/email/verify', cookie, { code })).status).toBe(200)
  return { email, cookie, user: (await j(res)).user }
}

const view = async (cookie: string) => j(await get(pOnboarding, '/api/v1/partner/onboarding', cookie))
const photo = (cookie: string, slot: number, file: { name?: string; type?: string; data: Buffer }, over: Record<string, string> = {}) =>
  pPhotoPost(multipart(`/api/v1/partner/onboarding/photos/${slot}`, cookie, { photo: { name: file.name ?? 'p.jpg', type: file.type ?? 'image/jpeg', data: file.data }, noPeople: 'true', noFilters: 'true', recent: 'true', ...over }))
const goodPhoto = () => fakeJpeg({ width: 2400, height: 1600, takenAt: new Date(Date.now() - 30 * 86_400_000) })

/** Fills in the whole application. */
async function completeApplication(a: { cookie: string }, name = 'Kahvila Aalto') {
  const c = a.cookie
  expect((await put(pBasics, '/api/v1/partner/onboarding/basics', c, { name, kind: 'Specialty coffee', area: 'Kluuvi', businessId: businessId() })).status).toBe(200)
  const places = (await j(await get(pPlaces, '/api/v1/partner/places?q=Kahvila%20Aalto', c))).places
  expect((await put(pLocation, '/api/v1/partner/onboarding/location', c, { pick: places[0].pick })).status).toBe(200)
  const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), { open: '10:00', close: '22:00' }]))
  expect((await put(pHours, '/api/v1/partner/onboarding/hours', c, { hours, slotTimes: ['13:30', '15:00', '16:30', '18:00'], maxPerSlot: 2 })).status).toBe(200)
  expect((await put(pContact, '/api/v1/partner/onboarding/contact', c, { name: 'Aino Mäkinen', role: 'Manager', email: (await view(c)).venue.contact.email, phone: '+358 40 123 4567' })).status).toBe(200)
  await post(pPhoneCode, '/api/v1/partner/onboarding/contact/phone-code', c)
  const code = /(\d{6})/.exec(smsOutbox.at(-1)!.text)![1]
  expect((await post(pPhoneVerify, '/api/v1/partner/onboarding/contact/phone-verify', c, { code })).status).toBe(200)
  for (const slot of [1, 2, 3, 4]) expect((await photo(c, slot, { data: goodPhoto() })).status).toBe(200)
  expect((await put(pOffer, '/api/v1/partner/onboarding/offer', c, { offer: '10% off for ChoiceMi dates', stepFree: true, accessibleToilet: false, priceLevel: 2 })).status).toBe(200)
  expect((await post(pTerms, '/api/v1/partner/onboarding/terms', c, { partnerTerms: true, dataTerms: true, photoRights: true, marketingPhotos: false })).status).toBe(200)
}

async function staffCookie(role: string) {
  const email = `staff${++n}-${Date.now()}@choicemi.test`
  await sInvite(req('/api/v1/admin/staff/invite', { method: 'POST', headers: bearer, body: { email, role } }))
  const token = /invite=([\w-]+)/.exec(outbox.find((m) => m.to === email)!.text)![1]
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true, inviteToken: token } }))
  return cookieOf(res)
}

describe('starting an application', () => {
  it('creates the account and a draft venue, and needs the email confirmed first', async () => {
    const email = `new${++n}@example.com`
    const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, applyAsPartner: true, contactName: 'Aino' } }))
    expect(res.status).toBe(201)
    expect((await j(res)).user.role).toBe('partner')
    const cookie = cookieOf(res)
    const early = await get(pMe, '/api/v1/partner/me', cookie)
    expect(early.status).toBe(403)
    expect((await j(early)).error.code).toBe('email_unverified')
    const code = /\b(\d{6})\b/.exec(outbox.find((m) => m.to === email)!.text)![1]
    await post(verifyEmail, '/api/v1/auth/email/verify', cookie, { code })
    const me = await j(await get(pMe, '/api/v1/partner/me', cookie))
    expect(me).toMatchObject({ staffRole: 'owner', venue: { status: 'pending', reviewStatus: 'draft' } })
    expect(me.goLiveProblems.length).toBeGreaterThan(0)
    // the contact email they signed up with needs no second link
    const v = await view(cookie)
    expect(v.venue.contact).toMatchObject({ name: 'Aino', email, emailVerified: true })
    expect(v.missing).toEqual(expect.arrayContaining(['Business ID (Y-tunnus)', 'The four photos']))
  })

  it('needs a name and a real password, and a normal signup cannot become a partner by guessing', async () => {
    const bad = (body: Record<string, unknown>) => signup(req('/api/v1/auth/signup', { method: 'POST', body: { email: `x${++n}@example.com`, password: PW, acceptTerms: true, ...body } }))
    expect((await bad({ applyAsPartner: true })).status).toBe(400)
    expect((await bad({ applyAsPartner: true, contactName: 'A' })).status).toBe(400)
    expect((await bad({ applyAsPartner: true, contactName: 'Aino', password: 'short' })).status).toBe(400)
    const m = await member('man', ['Women'])
    expect((await get(pMe, '/api/v1/partner/me', m.cookie)).status).toBe(403)
  })
})

describe('the application, step by step', () => {
  it('checks the Business ID format and check digit, and looks it up in the register', async () => {
    const a = await applicant()
    const save = (id: string) => put(pBasics, '/api/v1/partner/onboarding/basics', a.cookie, { name: 'Kahvila Aalto', businessId: id })
    expect(validBusinessId('1234567-8')).toBe(false)
    expect((await save('12345')).status).toBe(400)
    const bad = await save('1234567-8')
    expect(bad.status).toBe(400)
    expect((await j(bad)).error.code).toBe('invalid_business_id')
    const id = businessId()
    const ok = await j(await save(id))
    expect(ok.venue.businessId).toBe(id)
    expect(ok.venue.ytj).toMatchObject({ found: true, name: 'Kahvila Aalto Oy' })
    // the same company cannot be on ChoiceMi twice
    const other = await applicant()
    expect((await put(pBasics, '/api/v1/partner/onboarding/basics', other.cookie, { name: 'Another', businessId: id })).status).toBe(409)
    // name rules
    expect((await put(pBasics, '/api/v1/partner/onboarding/basics', a.cookie, { name: 'x' })).status).toBe(400)
    expect((await put(pBasics, '/api/v1/partner/onboarding/basics', a.cookie, { name: 'y'.repeat(81) })).status).toBe(400)
  })

  it('the location must be picked from the search results, never typed', async () => {
    const a = await applicant()
    const typed = await put(pLocation, '/api/v1/partner/onboarding/location', a.cookie, { pick: 'Rautatientori 2, Helsinki' })
    expect(typed.status).toBe(400)
    expect((await j(typed)).error.code).toBe('pick_from_search')
    const places = (await j(await get(pPlaces, '/api/v1/partner/places?q=Kahvila%20Aalto', a.cookie))).places
    expect(places[0]).toMatchObject({ provider: 'osm', name: 'Kahvila Aalto', lat: 60.1712 })
    // a result with its coordinates changed no longer matches its signature
    const [body, sig] = places[0].pick.split('.')
    const forged = Buffer.from(JSON.stringify(['osm', 'n1', 'x', 'y', 1, 2])).toString('base64url')
    expect((await put(pLocation, '/api/v1/partner/onboarding/location', a.cookie, { pick: `${forged}.${sig}` })).status).toBe(400)
    expect(body).toBeTruthy()
    const saved = await j(await put(pLocation, '/api/v1/partner/onboarding/location', a.cookie, { pick: places[0].pick }))
    expect(saved.venue.location).toMatchObject({ provider: 'osm', placeId: 'n4242', lat: 60.1712, lng: 24.9414 })
    expect((await get(pPlaces, '/api/v1/partner/places?q=ab', a.cookie).then(j)).places).toEqual([])
  })

  it('opening hours per weekday, start times and dates per slot are validated', async () => {
    const a = await applicant()
    const save = (body: unknown) => put(pHours, '/api/v1/partner/onboarding/hours', a.cookie, body)
    const open = { '1': { open: '10:00', close: '22:00' } }
    expect((await save({ hours: {}, slotTimes: ['15:00'], maxPerSlot: 2 })).status).toBe(400)
    expect((await save({ hours: { '1': { open: '22:00', close: '10:00' } }, slotTimes: ['15:00'], maxPerSlot: 2 })).status).toBe(400)
    expect((await save({ hours: { '1': { open: 'late', close: '22:00' } }, slotTimes: ['15:00'], maxPerSlot: 2 })).status).toBe(400)
    expect((await save({ hours: open, slotTimes: ['11:00'], maxPerSlot: 2 })).status).toBe(400)
    expect((await save({ hours: open, slotTimes: ['15:00'], maxPerSlot: 0 })).status).toBe(400)
    expect((await save({ hours: open, slotTimes: ['15:00'], maxPerSlot: 21 })).status).toBe(400)
    const ok = await j(await save({ hours: { ...open, '6': { open: '11:00', close: '23:00' } }, slotTimes: ['18:00', '15:00'], maxPerSlot: 3 }))
    expect(ok.venue).toMatchObject({ slotTimes: ['15:00', '18:00'], maxPerSlot: 3 })
    expect(Object.keys(ok.venue.hours).sort()).toEqual(['1', '6'])
  })

  it('exception dates close a day or from a time, and say how many bookings are already there', async () => {
    const a = await applicant()
    const day = plusDays(12)
    const add = (body: unknown) => post(pClosureAdd, '/api/v1/partner/closures', a.cookie, body)
    expect((await add({ dateOn: '2020-01-01' })).status).toBe(400)
    expect((await add({ dateOn: day, startTime: '25:00' })).status).toBe(400)
    expect((await add({ dateOn: day, startTime: '15:00', endTime: '14:00' })).status).toBe(400)
    const whole = await j(await add({ dateOn: day, reason: 'Christmas' }))
    expect(whole.closure).toMatchObject({ dateOn: day, startTime: null })
    expect((await add({ dateOn: day })).status).toBe(409)
    const part = await j(await add({ dateOn: plusDays(13), startTime: '15:00', reason: 'Private event' }))
    const list = (await j(await get(pAvail, '/api/v1/partner/availability', a.cookie))).closures
    expect(list).toHaveLength(2)
    expect((await call(pClosureDel as never, `/api/v1/partner/closures/${part.closure.id}`, a.cookie, 'DELETE')).status).toBe(200)
  })

  it('confirms the contact email by link, and the phone by a text message code', async () => {
    const a = await applicant()
    const c = a.cookie
    expect((await put(pContact, '/api/v1/partner/onboarding/contact', c, { name: 'Aino', role: 'Manager', email: 'host@kahvila.example', phone: '040 123 4567' })).status).toBe(400) // not international
    const saved = await j(await put(pContact, '/api/v1/partner/onboarding/contact', c, { name: 'Aino', role: 'Manager', email: 'host@kahvila.example', phone: '+358 40 123 4567' }))
    expect(saved.venue.contact).toMatchObject({ email: 'host@kahvila.example', emailVerified: false, phone: '+358401234567', phoneVerified: false })

    // email link
    outbox.length = 0
    expect((await post(pEmailLink, '/api/v1/partner/onboarding/contact/email-link', c)).status).toBe(200)
    const mail = outbox.find((m) => m.to === 'host@kahvila.example')!
    const token = /token=([\w-]+)/.exec(mail.text)![1]
    expect((await post(pVerifyContact, '/api/v1/partner/verify-contact', null, { token: 'x'.repeat(30) })).status).toBe(400)
    expect((await pVerifyContact(req('/api/v1/partner/verify-contact', { method: 'POST', body: { token } }))).status).toBe(200)
    expect((await pVerifyContact(req('/api/v1/partner/verify-contact', { method: 'POST', body: { token } }))).status).toBe(400) // once
    expect((await view(c)).venue.contact.emailVerified).toBe(true)

    // phone code: wrong codes are counted, the right one works
    await post(pPhoneCode, '/api/v1/partner/onboarding/contact/phone-code', c)
    const sms = smsOutbox.at(-1)!
    expect(sms.to).toBe('+358401234567')
    const code = /(\d{6})/.exec(sms.text)![1]
    const wrong = code === '000000' ? '111111' : '000000'
    expect((await post(pPhoneVerify, '/api/v1/partner/onboarding/contact/phone-verify', c, { code: wrong })).status).toBe(400)
    expect((await post(pPhoneVerify, '/api/v1/partner/onboarding/contact/phone-verify', c, { code: 'abc' })).status).toBe(400)
    expect((await post(pPhoneVerify, '/api/v1/partner/onboarding/contact/phone-verify', c, { code })).status).toBe(200)
    expect((await view(c)).venue.contact.phoneVerified).toBe(true)
    // changing the number asks for a new check
    const changed = await j(await put(pContact, '/api/v1/partner/onboarding/contact', c, { name: 'Aino', role: 'Manager', email: 'host@kahvila.example', phone: '+358 50 999 8888' }))
    expect(changed.venue.contact.phoneVerified).toBe(false)
    expect(changed.venue.contact.emailVerified).toBe(true)
  })

  it('five wrong phone codes lock that code', async () => {
    const a = await applicant()
    await put(pContact, '/api/v1/partner/onboarding/contact', a.cookie, { name: 'Aino', role: 'Manager', email: a.email, phone: '+358 40 111 2222' })
    await post(pPhoneCode, '/api/v1/partner/onboarding/contact/phone-code', a.cookie)
    const code = /(\d{6})/.exec(smsOutbox.at(-1)!.text)![1]
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await post(pPhoneVerify, '/api/v1/partner/onboarding/contact/phone-verify', a.cookie, { code: wrong })
    const locked = await post(pPhoneVerify, '/api/v1/partner/onboarding/contact/phone-verify', a.cookie, { code })
    expect(locked.status).toBe(429)
  })
})

describe('the four photos', () => {
  it('enforces the photo rules from the file itself', async () => {
    const a = await applicant()
    const c = a.cookie
    expect((await photo(c, 1, { data: goodPhoto() }, { noPeople: 'false' })).status).toBe(400) // the confirmations
    expect((await photo(c, 1, { data: Buffer.from('not an image at all, just some text that is long enough') })).status).toBe(400)
    const portrait = await photo(c, 1, { data: fakeJpeg({ width: 1600, height: 2400 }) })
    expect([portrait.status, (await j(portrait)).error.code]).toEqual([400, 'photo_portrait'])
    const small = await photo(c, 1, { data: fakeJpeg({ width: 1200, height: 800 }) })
    expect([small.status, (await j(small)).error.code]).toEqual([400, 'photo_small'])
    const old = await photo(c, 1, { data: fakeJpeg({ width: 2400, height: 1600, takenAt: new Date(Date.now() - 500 * 86_400_000) }) })
    expect([old.status, (await j(old)).error.code]).toEqual([400, 'photo_old'])
    const big = await photo(c, 1, { data: fakeJpeg({ width: 2400, height: 1600, bytes: 10 * 1024 * 1024 + 200 }) })
    expect([big.status, (await j(big)).error.code]).toEqual([400, 'photo_too_large'])
    expect((await photo(c, 5, { data: goodPhoto() })).status).toBe(404)
    // a good one, then replaced, then removed
    const ok = await j(await photo(c, 2, { data: goodPhoto() }))
    expect(ok).toMatchObject({ ok: true, slot: 2, width: 2400, height: 1600 })
    expect((await view(c)).photos).toHaveLength(1)
    expect((await photo(c, 2, { data: fakeJpeg({ width: 3000, height: 2000 }) })).status).toBe(200)
    expect((await view(c)).photos[0]).toMatchObject({ slot: 2, width: 3000, status: 'pending' })
    expect((await call(pPhotoDelete as never, '/api/v1/partner/onboarding/photos/2', c, 'DELETE')).status).toBe(200)
    expect((await view(c)).photos).toHaveLength(0)
  })

  it('a photo is private until ChoiceMi approves the venue', async () => {
    const a = await applicant()
    await photo(a.cookie, 1, { data: goodPhoto() })
    const id = (await view(a.cookie)).venue.id
    const m = await member('man', ['Women'])
    expect((await venuePhoto(req(`/api/v1/venues/${id}/photos/1`, { cookie: m.cookie }))).status).toBe(404)
    const own = await venuePhoto(req(`/api/v1/venues/${id}/photos/1`, { cookie: a.cookie }))
    expect(own.status).toBe(200)
    expect(own.headers.get('content-type')).toBe('image/jpeg')
    const other = await applicant()
    expect((await venuePhoto(req(`/api/v1/venues/${id}/photos/1`, { cookie: other.cookie }))).status).toBe(404)
    const staff = await staffCookie('partner_manager')
    expect((await venuePhoto(req(`/api/v1/venues/${id}/photos/1`, { cookie: staff }))).status).toBe(200) // ChoiceMi staff review them
  })
})

describe('sending it, review, and going live', () => {
  it('cannot be sent incomplete, is locked while in review, and a complete application goes through review to approval', async () => {
    const a = await applicant()
    const c = a.cookie
    const early = await post(pSubmit, '/api/v1/partner/onboarding/submit', c)
    expect(early.status).toBe(409)
    expect((await j(early)).error.code).toBe('incomplete')
    await completeApplication(a)
    expect((await view(c)).missing).toEqual([])

    const sent = await j(await post(pSubmit, '/api/v1/partner/onboarding/submit', c))
    expect(sent.venue.reviewStatus).toBe('submitted')
    // locked while ChoiceMi reads it
    const locked = await put(pBasics, '/api/v1/partner/onboarding/basics', c, { name: 'Changed' })
    expect(locked.status).toBe(409)
    expect((await j(locked)).error.code).toBe('in_review')
    expect((await post(pSubmit, '/api/v1/partner/onboarding/submit', c)).status).toBe(409)
    // not bookable, not on the member list, no portal yet
    const id = sent.venue.id
    const m = await member('man', ['Women'])
    expect((await j(await get(listVenues, '/api/v1/venues', m.cookie))).venues.map((v: { id: string }) => v.id)).not.toContain(id)
    expect((await get(pRequests, '/api/v1/partner/requests', c)).status).toBe(409)

    // staff review it
    const reviewer = await staffCookie('partner_manager')
    const queue = await j(await get(aVenues, '/api/v1/admin/venues?status=submitted', reviewer))
    expect(queue.venues.map((v: { id: string }) => v.id)).toContain(id)
    const packet = await j(await get(aVenue, `/api/v1/admin/venues/${id}`, reviewer))
    expect(packet.venue.ytj.found).toBe(true)
    expect(packet.photos).toHaveLength(4)
    expect(packet.owner).toBe(a.email)
    expect(packet.venue.contact_email_verified_at).toBeTruthy()

    const review = (body: unknown, who: string | null = reviewer) => post(aReview, `/api/v1/admin/venues/${id}/review`, who, body)
    const allOk = Object.fromEntries(['name', 'business_id', 'location', 'hours', 'contact', 'photo1', 'photo2', 'photo3', 'photo4', 'offer'].map((k) => [k, { ok: true }]))
    expect((await review({ decision: 'maybe' })).status).toBe(400)
    expect((await review({ decision: 'approve', items: { ...allOk, photo2: { ok: false, reason: 'The name is not readable' } } })).status).toBe(400) // cannot approve a failure
    expect((await review({ decision: 'send_back', items: allOk })).status).toBe(400) // nothing to fix
    expect((await review({ decision: 'send_back', items: { photo2: { ok: false } } })).status).toBe(400) // a reason is needed
    const support = await staffCookie('support_agent')
    expect((await review({ decision: 'approve', items: allOk }, support)).status).toBe(403)

    outbox.length = 0
    expect((await review({ decision: 'send_back', note: 'Almost there', items: { ...allOk, photo2: { ok: false, reason: 'The venue name is not readable' } } })).status).toBe(200)
    expect(outbox.find((mm) => mm.to === a.email)!.text).toContain('The venue name is not readable')
    const back = await view(c)
    expect(back.venue.reviewStatus).toBe('sent_back')
    expect(back.venue.review.items.photo2).toEqual({ ok: false, reason: 'The venue name is not readable' })
    expect(back.photos.find((p: { slot: number }) => p.slot === 2)).toMatchObject({ status: 'rejected', rejectReason: 'The venue name is not readable' })
    expect(back.photos.find((p: { slot: number }) => p.slot === 1).status).toBe('accepted')

    // they fix the photo and send it again
    expect((await photo(c, 2, { data: goodPhoto() })).status).toBe(200)
    expect((await post(pSubmit, '/api/v1/partner/onboarding/submit', c)).status).toBe(200)
    outbox.length = 0
    expect((await review({ decision: 'approve', items: allOk })).status).toBe(200)
    expect(outbox.find((mm) => mm.to === a.email)!.subject).toContain('approved')
    expect((await view(c)).venue.reviewStatus).toBe('approved')
    // approved photos are shown to signed-in members
    expect((await venuePhoto(req(`/api/v1/venues/${id}/photos/1`, { cookie: m.cookie }))).status).toBe(200)
    // what was checked in review is locked
    const lockedAfter = await put(pBasics, '/api/v1/partner/onboarding/basics', c, { name: 'Renamed' })
    expect(lockedAfter.status).toBe(409)
    expect((await j(lockedAfter)).error.code).toBe('locked')
    expect((await put(pBasics, '/api/v1/partner/onboarding/basics', c, { kind: 'Cosy brunch' })).status).toBe(200)
  })

  it('cannot go live until the device, staff and test booking are done; then the venue is bookable', async () => {
    const a = await applicant()
    const c = a.cookie
    await completeApplication(a, 'Kahvila Test Live')
    await post(pSubmit, '/api/v1/partner/onboarding/submit', c)
    const id = (await view(c)).venue.id
    const reviewer = await staffCookie('admin')
    const allOk = Object.fromEntries(['name', 'business_id', 'location', 'hours', 'contact', 'photo1', 'photo2', 'photo3', 'photo4', 'offer'].map((k) => [k, { ok: true }]))
    await post(aReview, `/api/v1/admin/venues/${id}/review`, reviewer, { decision: 'approve', items: allOk })

    const early = await post(pGoLive, '/api/v1/partner/onboarding/go-live', c)
    expect(early.status).toBe(409)
    expect((await j(early)).error.message).toMatch(/device.*staff.*test/i)
    expect((await post(pReadiness, '/api/v1/partner/onboarding/readiness', c, { deviceReady: true, staffBriefed: true })).status).toBe(200)
    expect((await post(pGoLive, '/api/v1/partner/onboarding/go-live', c)).status).toBe(409) // the test booking is still missing

    // ChoiceMi sends a test request: the venue confirms it, scans the two test codes, and confirms the end
    const startRes = await post(pTestStart, '/api/v1/partner/onboarding/test/start', c)
    const started = await j(startRes)
    expect(started.booking.status).toBe('requested')
    expect(started.booking.testGuests.map((g: { username: string }) => g.username.startsWith('Test_Guest'))).toEqual([true, true])
    expect(started.booking.testGuests[0].qr).toBeNull() // codes appear once it is confirmed
    expect((await post(pTestStart, '/api/v1/partner/onboarding/test/start', c).then(j)).booking.id).toBe(started.booking.id) // one at a time
    const request = (await j(await get(pRequests, '/api/v1/partner/requests', c))).requests[0]
    expect(request.id).toBe(started.booking.id)
    expect((await post(pConfirm, `/api/v1/partner/bookings/${request.id}/confirm`, c)).status).toBe(200)
    const ready = (await j(await get(pTest, '/api/v1/partner/onboarding/test', c))).booking
    expect(ready.status).toBe('confirmed')
    for (const g of ready.testGuests) expect((await post(pScan, '/api/v1/partner/checkin/scan', c, { token: g.qr })).status).toBe(200)
    expect((await post(pEnd, `/api/v1/partner/bookings/${request.id}/end`, c)).status).toBe(200)
    expect((await view(c)).venue.testDone).toBe(true)

    // the test never reaches real members or the numbers
    const db = await getDb()
    expect((await db.query(`select count(*)::int as n from users where role = 'tester' and status = 'suspended'`)).rows[0].n).toBeGreaterThanOrEqual(2)

    const m = await member('man', ['Women'])
    const listed = async () => (await j(await get(listVenues, '/api/v1/venues', m.cookie))).venues.map((v: { id: string }) => v.id)
    expect(await listed()).not.toContain(id)
    const live = await j(await post(pGoLive, '/api/v1/partner/onboarding/go-live', c))
    expect(live.venue).toMatchObject({ status: 'active' })
    expect(live.venue.wentLiveAt).toBeTruthy()
    expect(await listed()).toContain(id)
    const slots = (await j(await get(venueSlots, `/api/v1/venues/${id}/slots?date=${plusDays(7)}`, m.cookie))).slots
    expect(slots.filter((s: { available: boolean }) => s.available).map((s: { time: string }) => s.time)).toEqual(['13:30', '15:00', '16:30', '18:00'])
    // pausing hides it again, resuming brings it back
    expect((await post(pStatus, '/api/v1/partner/onboarding/status', c, { status: 'paused' })).status).toBe(200)
    expect(await listed()).not.toContain(id)
    expect((await post(pStatus, '/api/v1/partner/onboarding/status', c, { status: 'active' })).status).toBe(200)
    expect(await listed()).toContain(id)
    expect((await post(pStatus, '/api/v1/partner/onboarding/status', c, { status: 'nope' })).status).toBe(400)
  })

  it('a venue that was already live keeps working through the upgrade', async () => {
    const m = await member('man', ['Women'])
    const venues = (await j(await get(listVenues, '/api/v1/venues', m.cookie))).venues
    expect(venues.map((v: { name: string }) => v.name).slice(0, 4)).toEqual(['Kaffa Roastery', 'Good Life Coffee', 'Café Regatta', 'Fazer Café'])
  })
})

describe('the team', () => {
  it('the owner invites a colleague by an invitation link; staff can answer requests but not change settings; removal ends access', async () => {
    const a = await applicant()
    await completeApplication(a, 'Kahvila Team')
    await post(pSubmit, '/api/v1/partner/onboarding/submit', a.cookie)
    const id = (await view(a.cookie)).venue.id
    const reviewer = await staffCookie('admin')
    const allOk = Object.fromEntries(['name', 'business_id', 'location', 'hours', 'contact', 'photo1', 'photo2', 'photo3', 'photo4', 'offer'].map((k) => [k, { ok: true }]))
    await post(aReview, `/api/v1/admin/venues/${id}/review`, reviewer, { decision: 'approve', items: allOk })

    const email = `staff${++n}@example.com`
    outbox.length = 0
    expect((await post(pInvite, '/api/v1/partner/team/invite', a.cookie, { email })).status).toBe(200)
    const mail = outbox.find((x) => x.to === email)!
    expect(mail.text).toMatch(/localhost:3200\/join\?invite=/)
    const token = /invite=([\w-]+)/.exec(mail.text)![1]
    const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true, inviteToken: token } }))
    expect(res.status).toBe(201)
    const staff = cookieOf(res)
    expect((await j(await get(pMe, '/api/v1/partner/me', staff))).staffRole).toBe('staff')
    expect((await get(pRequests, '/api/v1/partner/requests', staff)).status).toBe(200)
    const denied = await put(pHours, '/api/v1/partner/onboarding/hours', staff, { hours: { '1': { open: '10:00', close: '22:00' } }, slotTimes: ['15:00'], maxPerSlot: 1 })
    expect(denied.status).toBe(403)
    expect((await post(pInvite, '/api/v1/partner/team/invite', staff, { email: `x${++n}@example.com` })).status).toBe(403)
    expect((await post(pStatus, '/api/v1/partner/onboarding/status', staff, { status: 'paused' })).status).toBe(403)

    const members = (await j(await get(pTeam, '/api/v1/partner/team', a.cookie))).members
    expect((await call(pRemove as never, `/api/v1/partner/team/${members.find((x: { you: boolean }) => x.you).id}`, a.cookie, 'DELETE')).status).toBe(400)
    const staffId = members.find((x: { email: string }) => x.email === email).id
    expect((await call(pRemove as never, `/api/v1/partner/team/${staffId}`, a.cookie, 'DELETE')).status).toBe(200)
    expect((await get(pMe, '/api/v1/partner/me', staff)).status).toBe(401)
  })

  it('a pre-agreed venue can still be set up by ChoiceMi and the owner then completes the same application', async () => {
    const email = `agreed${++n}@example.com`
    const made = await adminCreate(req('/api/v1/admin/partners/create', { method: 'POST', headers: bearer, body: { venueName: 'Ravintola Meri', email } }))
    expect(made.status).toBe(201)
    const token = /invite=([\w-]+)/.exec(outbox.find((x) => x.to === email)!.text)![1]
    const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true, inviteToken: token } }))
    const cookie = cookieOf(res)
    const me = await j(await get(pMe, '/api/v1/partner/me', cookie))
    expect(me).toMatchObject({ staffRole: 'owner', venue: { name: 'Ravintola Meri', reviewStatus: 'draft' } })
  })
})
