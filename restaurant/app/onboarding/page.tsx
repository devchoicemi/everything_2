'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, MapPin } from 'lucide-react'
import { Alert, Badge, Button, Field, cn } from '@/components/ui'
import { api, messageOf, type Onboarding, type Place } from '@/lib/api'
import { useOnboarding } from '@/lib/onboarding'
import { Checklist } from '@/components/OnboardingParts'

/** Step 1: who the venue is, where it is, and who to contact. Saved when you press Save and continue. */
export default function VenueStep() {
  const router = useRouter()
  const { ob, save, saving, saveError, clearError, reload } = useOnboarding()
  const v = ob!.venue
  const locked = v.reviewStatus === 'submitted'
  const critical = v.reviewStatus === 'approved'

  const [name, setName] = useState(v.name === 'My venue' ? '' : v.name)
  const [kind, setKind] = useState(v.kind)
  const [area, setArea] = useState(v.area)
  const [bid, setBid] = useState(v.businessId ?? '')
  const [contactName, setContactName] = useState(v.contact.name)
  const [role, setRole] = useState(v.contact.role)
  const [email, setEmail] = useState(v.contact.email)
  const [phone, setPhone] = useState(v.contact.phone)

  const [query, setQuery] = useState(v.location?.address ?? '')
  const [results, setResults] = useState<Place[]>([])
  const [picked, setPicked] = useState<Place | null>(null)
  const [searchError, setSearchError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [notice, setNotice] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [side, setSide] = useState(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  function onQuery(value: string) {
    setQuery(value)
    setPicked(null)
    clearTimeout(timer.current)
    if (value.trim().length < 3) return setResults([])
    timer.current = setTimeout(async () => {
      try {
        setSearchError('')
        setResults((await api<{ places: Place[] }>(`/partner/places?q=${encodeURIComponent(value.trim())}`)).places)
      } catch (e) {
        setSearchError(messageOf(e))
      }
    }, 350)
  }

  const bidValid = /^\d{6,7}-\d$/.test(bid.trim())
  const location = picked ?? (v.location ? { lat: v.location.lat, lng: v.location.lng, address: v.location.address } : null)

  async function saveAll(): Promise<boolean> {
    return save(async () => {
      let view: Onboarding = ob!
      if (!critical) view = await api<Onboarding>('/partner/onboarding/basics', { method: 'PUT', body: { name, kind, area, businessId: bid } })
      else view = await api<Onboarding>('/partner/onboarding/basics', { method: 'PUT', body: { kind, area } })
      if (picked && !critical) view = await api<Onboarding>('/partner/onboarding/location', { method: 'PUT', body: { pick: picked.pick } })
      view = await api<Onboarding>('/partner/onboarding/contact', { method: 'PUT', body: { name: contactName, role, email, phone } })
      return view
    })
  }

  async function next() {
    if (await saveAll()) router.push('/onboarding/hours')
  }

  async function sideCall(fn: () => Promise<unknown>, msg: string) {
    setSide(true)
    setNotice('')
    clearError()
    try {
      if (!(await saveAll())) return
      await fn()
      setNotice(msg)
    } catch (e) {
      setNotice(messageOf(e))
    } finally {
      setSide(false)
      void reload()
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card p-6 sm:p-9">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Tell us about your venue</h1>
        <p className="mt-2 text-ink-600">These details are checked by a person at ChoiceMi before you can go live.</p>

        <fieldset disabled={locked} className="mt-7 space-y-6">
          <div>
            <Field label="Venue name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={critical} />
            <div className="mt-1.5 flex justify-between text-[12px] text-ink-400">
              <span>Exactly as it shows on the street sign.</span>
              <span>{name.length} / 80</span>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="What kind of place is it?" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Specialty coffee, quiet" maxLength={90} />
            <Field label="Neighbourhood" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Punavuori" maxLength={60} />
          </div>

          <div>
            <label className="label" htmlFor="bid">
              Business ID (Y-tunnus)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input id="bid" className="input max-w-[200px]" value={bid} onChange={(e) => setBid(e.target.value)} placeholder="1234567-8" disabled={critical} />
              {bid && (bidValid ? <Badge tone="ok">Format looks right</Badge> : <Badge tone="warn">Use the format 1234567-8</Badge>)}
              {v.ytj?.found && <Badge tone="ok">Found: {v.ytj.name}</Badge>}
              {v.ytj && !v.ytj.found && !v.ytj.unavailable && <Badge tone="danger">Not found in the trade register</Badge>}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-400">We check it against the Finnish trade register (YTJ) when we review your application.</p>
          </div>

          <div>
            <label className="label" htmlFor="loc">
              Location
            </label>
            <input id="loc" className="input" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search for your venue by name or address" autoComplete="off" disabled={critical} />
            {searchError && <p className="mt-1.5 text-[12.5px] font-medium text-danger">{searchError}</p>}
            {results.length > 0 && !picked && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
                {results.map((p) => (
                  <li key={p.pick}>
                    <button
                      type="button"
                      className="block w-full px-4 py-3 text-left transition hover:bg-brand-50"
                      onClick={() => {
                        setPicked(p)
                        setQuery(p.address)
                        setResults([])
                      }}
                    >
                      <div className="text-[14.5px] font-semibold text-ink-900">{p.name}</div>
                      <div className="text-[13px] text-ink-500">{p.address}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {location && (
              <div className="mt-3 overflow-hidden rounded-xl border border-ink-200">
                <iframe
                  title="Map preview"
                  className="h-52 w-full"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.004}%2C${location.lat - 0.002}%2C${location.lng + 0.004}%2C${location.lat + 0.002}&layer=mapnik&marker=${location.lat}%2C${location.lng}`}
                />
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 text-[13px] text-ink-600">
                  <MapPin size={15} className="text-brand-700" /> {location.address}
                  {picked && <Badge tone="brand">New pin, saved with this step</Badge>}
                </div>
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink-400">Pick your venue from the search results. We store the map place, its coordinates and the address. Typed addresses are not accepted.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Contact person" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={100} hint="The person ChoiceMi calls if a booking stalls." />
            <Field label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Restaurant manager" maxLength={80} />
          </div>

          <div>
            <label className="label" htmlFor="email">
              Contact email
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input id="email" type="email" className="input max-w-[360px]" value={email} onChange={(e) => setEmail(e.target.value)} />
              {v.contact.emailVerified && email === v.contact.email ? (
                <Badge tone="ok">
                  <Check size={12} /> Confirmed
                </Badge>
              ) : (
                <Button variant="secondary" size="sm" disabled={side || !email} onClick={() => sideCall(() => api('/partner/onboarding/contact/email-link', { body: {} }), 'Check your inbox: we sent a confirmation link.')}>
                  Send confirmation link
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-400">Booking alerts go here. We need you to open the link in the email.</p>
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Booking phone (mobile)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input id="phone" type="tel" className="input max-w-[260px]" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+358 40 123 4567" />
              {v.contact.phoneVerified && phone.replace(/[\s()-]/g, '') === v.contact.phone ? (
                <Badge tone="ok">
                  <Check size={12} /> Verified
                </Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={side || !phone}
                  onClick={() =>
                    sideCall(async () => {
                      await api('/partner/onboarding/contact/phone-code', { body: {} })
                      setCodeSent(true)
                    }, 'We sent a 6-digit code by text message.')
                  }
                >
                  Send a code
                </Button>
              )}
            </div>
            {codeSent && !v.contact.phoneVerified && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input className="input max-w-[160px] text-center font-mono tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="······" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <Button
                  size="sm"
                  disabled={side || code.length !== 6}
                  onClick={async () => {
                    setSide(true)
                    setNotice('')
                    try {
                      await save(() => api<Onboarding>('/partner/onboarding/contact/phone-verify', { body: { code } }))
                      setCode('')
                      setCodeSent(false)
                    } finally {
                      setSide(false)
                    }
                  }}
                >
                  Verify
                </Button>
              </div>
            )}
            <p className="mt-1.5 text-[12px] text-ink-400">International format. Booking alerts are sent here by SMS, so we verify it with a code.</p>
          </div>
        </fieldset>

        {notice && (
          <Alert tone="info" className="mt-5">
            {notice}
          </Alert>
        )}
        {saveError && <Alert className="mt-5">{saveError}</Alert>}
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={next} disabled={saving || side || locked}>
            {saving ? 'Saving…' : 'Save and continue'}
          </Button>
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-[15px] font-extrabold">Why we ask for all of this</h2>
          <p className="mt-2 text-[13.5px] text-ink-600">A venue can only go live when all eight required items are complete and checked. This protects guests meeting a stranger for the first time.</p>
        </div>
        <Checklist ob={ob!} />
      </aside>
    </div>
  )
}
