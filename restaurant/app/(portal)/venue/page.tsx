'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert, Badge, Button, Field, PageTitle, cn } from '@/components/ui'
import { Section } from '@/components/kit'
import { WithOnboarding } from '@/components/OnboardingParts'
import { api, type Onboarding } from '@/lib/api'
import { useOnboarding } from '@/lib/onboarding'
import { useSession } from '@/lib/session'

export default function VenuePage() {
  return (
    <div>
      <PageTitle title="Venue" sub="What guests see about you, and your contact details." />
      <WithOnboarding>
        <Inner />
      </WithOnboarding>
    </div>
  )
}

const YesNo = ({ label, value, onChange, disabled }: { label: string; value: boolean | null; onChange: (v: boolean) => void; disabled: boolean }) => (
  <div>
    <div className="label">{label}</div>
    <div className="flex gap-2">
      {[true, false].map((b) => (
        <button key={String(b)} type="button" disabled={disabled} aria-pressed={value === b} onClick={() => onChange(b)} className={cn('rounded-full border px-5 py-2 text-[14px] font-semibold', value === b ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600')}>
          {b ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  </div>
)

function Inner() {
  const { me } = useSession()
  const { ob, save, saving, saveError } = useOnboarding()
  const v = ob!.venue
  const owner = me?.staffRole === 'owner'
  const [kind, setKind] = useState(v.kind)
  const [area, setArea] = useState(v.area)
  const [description, setDescription] = useState(v.description)
  const [offer, setOffer] = useState(v.offer)
  const [stepFree, setStepFree] = useState(v.stepFree)
  const [toilet, setToilet] = useState(v.accessibleToilet)
  const [price, setPrice] = useState(v.priceLevel)
  const [cName, setCName] = useState(v.contact.name)
  const [cRole, setCRole] = useState(v.contact.role)
  const [email, setEmail] = useState(v.contact.email)
  const [phone, setPhone] = useState(v.contact.phone)
  const [saved, setSaved] = useState('')

  const run = async (label: string, fn: () => Promise<Onboarding>) => {
    setSaved('')
    if (await save(fn)) setSaved(label)
  }

  return (
    <div className="space-y-6">
      {!owner && <Alert tone="info">Only the owner can change these details.</Alert>}
      <Section title="Checked by ChoiceMi" sub="These were checked in review. To change one, write to ChoiceMi through Help.">
        <dl className="grid gap-x-8 gap-y-3 text-[14.5px] sm:grid-cols-2">
          <Item k="Venue name" v={v.name} />
          <Item k="Business ID" v={v.businessId ?? '—'} />
          <Item k="Location" v={v.location?.address ?? '—'} />
          <Item k="Photos" v={`${ob!.photos.length} of 4 uploaded`} />
        </dl>
        <Link href="/onboarding/photos" className="mt-4 inline-block text-[13.5px] font-bold text-brand-700">
          Replace a photo (it goes to ChoiceMi for a quick check)
        </Link>
      </Section>

      <Section title="About the venue">
        <fieldset disabled={!owner} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind of place" value={kind} onChange={(e) => setKind(e.target.value)} maxLength={90} />
            <Field label="Neighbourhood" value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="d">
              Description
            </label>
            <textarea id="d" className="input min-h-[96px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
          </div>
          <Button disabled={saving} onClick={() => run('details', () => api<Onboarding>('/partner/onboarding/basics', { method: 'PUT', body: { kind, area, description } }))}>
            Save
          </Button>
          {saved === 'details' && <Badge tone="ok">Saved</Badge>}
        </fieldset>
      </Section>

      <Section title="ChoiceMi offer, access and price">
        <fieldset disabled={!owner} className="space-y-4">
          <Field label="Offer" value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={120} />
          <div className="grid gap-4 sm:grid-cols-2">
            <YesNo label="Step-free entrance" value={stepFree} onChange={setStepFree} disabled={!owner} />
            <YesNo label="Accessible toilet" value={toilet} onChange={setToilet} disabled={!owner} />
          </div>
          <div>
            <div className="label">Price level</div>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" aria-pressed={price === n} onClick={() => setPrice(n)} className={cn('rounded-full border px-5 py-2 text-[14px] font-semibold', price === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600')}>
                  {'€'.repeat(n)}
                </button>
              ))}
            </div>
          </div>
          <Button disabled={saving || !offer.trim()} onClick={() => run('offer', () => api<Onboarding>('/partner/onboarding/offer', { method: 'PUT', body: { offer, stepFree, accessibleToilet: toilet, priceLevel: price } }))}>
            Save
          </Button>
          {saved === 'offer' && <Badge tone="ok">Saved</Badge>}
        </fieldset>
      </Section>

      <Section title="Contact" sub="Booking alerts go to this email and phone. Changing either means confirming it again.">
        <fieldset disabled={!owner} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact person" value={cName} onChange={(e) => setCName(e.target.value)} />
            <Field label="Role" value={cRole} onChange={(e) => setCRole(e.target.value)} />
            <Field label="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint={v.contact.emailVerified ? 'Confirmed' : 'Not confirmed: alerts will not be emailed'} />
            <Field label="Booking phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint={v.contact.phoneVerified ? 'Verified' : 'Not verified: alerts will not be texted'} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled={saving} onClick={() => run('contact', () => api<Onboarding>('/partner/onboarding/contact', { method: 'PUT', body: { name: cName, role: cRole, email, phone } }))}>
              Save
            </Button>
            {!v.contact.emailVerified && (
              <Button variant="secondary" onClick={async () => { await api('/partner/onboarding/contact/email-link', { body: {} }); setSaved('link') }}>
                Send confirmation link
              </Button>
            )}
            {!v.contact.phoneVerified && (
              <Button variant="secondary" onClick={async () => { await api('/partner/onboarding/contact/phone-code', { body: {} }); setSaved('code') }}>
                Send a code
              </Button>
            )}
          </div>
          {saved === 'link' && <Alert tone="info">Check your inbox for the confirmation link.</Alert>}
          {saved === 'code' && <PhoneCode />}
          {saved === 'contact' && <Badge tone="ok">Saved</Badge>}
        </fieldset>
      </Section>

      {owner && (
        <Section title="Taking dates" sub={v.status === 'active' ? 'You are live. Pausing hides your venue from new bookings; confirmed dates stay.' : 'Not live yet.'}>
          {v.status === 'active' && (
            <Button variant="danger" onClick={() => confirm('Pause your venue? Guests cannot book it until you resume.') && run('paused', () => api<Onboarding>('/partner/onboarding/status', { body: { status: 'paused' } }))}>
              Pause taking dates
            </Button>
          )}
          {v.status === 'paused' && (
            <Button onClick={() => run('resumed', () => api<Onboarding>('/partner/onboarding/status', { body: { status: 'active' } }))}>Resume taking dates</Button>
          )}
          {v.status === 'pending' && (
            <Link href="/onboarding/go-live" className="btn btn-primary">
              Finish getting ready
            </Link>
          )}
        </Section>
      )}
      {saveError && <Alert>{saveError}</Alert>}
    </div>
  )
}

function PhoneCode() {
  const { save } = useOnboarding()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input className="input max-w-[160px] text-center font-mono tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="······" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      <Button size="sm" disabled={code.length !== 6} onClick={async () => { setErr(''); if (!(await save(() => api<Onboarding>('/partner/onboarding/contact/phone-verify', { body: { code } })))) setErr('That code did not work.') }}>
        Verify
      </Button>
      {err && <span className="text-[13px] text-danger">{err}</span>}
    </div>
  )
}

const Item = ({ k, v }: { k: string; v: string }) => (
  <div>
    <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-400">{k}</dt>
    <dd>{v}</dd>
  </div>
)
