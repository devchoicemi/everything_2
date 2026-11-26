'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Field, cn } from '@/components/ui'
import { api, type Onboarding } from '@/lib/api'
import { useOnboarding } from '@/lib/onboarding'
import { Checklist } from '@/components/OnboardingParts'

function stored(): { rights: boolean; marketing: boolean } {
  try {
    return JSON.parse(sessionStorage.getItem('cm-photo-rights') ?? '') as { rights: boolean; marketing: boolean }
  } catch {
    return { rights: false, marketing: false }
  }
}

const YesNo = ({ label, value, onChange, disabled }: { label: string; value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div>
    <div className="label">{label}</div>
    <div className="flex gap-2">
      {[true, false].map((b) => (
        <button key={String(b)} type="button" disabled={disabled} aria-pressed={value === b} onClick={() => onChange(b)} className={cn('rounded-full border px-5 py-2 text-[14px] font-semibold transition', value === b ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300')}>
          {b ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  </div>
)

/** Step 4: the ChoiceMi offer, access and price, the terms, and sending the application. */
export default function OfferStep() {
  const router = useRouter()
  const { ob, save, saving, saveError } = useOnboarding()
  const v = ob!.venue
  const locked = v.reviewStatus === 'submitted'
  const s = stored()

  const [offer, setOffer] = useState(v.offer)
  const [stepFree, setStepFree] = useState<boolean | null>(v.stepFree)
  const [toilet, setToilet] = useState<boolean | null>(v.accessibleToilet)
  const [price, setPrice] = useState<number | null>(v.priceLevel)
  const [partnerTerms, setPartnerTerms] = useState(v.termsAccepted)
  const [dataTerms, setDataTerms] = useState(v.termsAccepted)
  const [rights, setRights] = useState(v.photoRights || s.rights)
  const [marketing, setMarketing] = useState(v.marketingPhotos || s.marketing)

  async function saveAll(): Promise<boolean> {
    return save(async () => {
      let view: Onboarding = await api<Onboarding>('/partner/onboarding/offer', { method: 'PUT', body: { offer, stepFree, accessibleToilet: toilet, priceLevel: price } })
      if (!v.termsAccepted || marketing !== v.marketingPhotos) view = await api<Onboarding>('/partner/onboarding/terms', { body: { partnerTerms, dataTerms, photoRights: rights, marketingPhotos: marketing } })
      return view
    })
  }

  async function submit() {
    if (!(await saveAll())) return
    const ok = await save(() => api<Onboarding>('/partner/onboarding/submit', { body: {} }))
    if (ok) router.push('/onboarding/status')
  }

  const termsOk = partnerTerms && dataTerms && rights
  const missing = ob!.missing.filter((m) => m !== 'Partner and data terms accepted')

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card p-6 sm:p-9">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Your offer, access and terms</h1>
        <p className="mt-2 text-ink-600">The offer is what ChoiceMi guests get at your venue. It is shown on their date card.</p>

        <fieldset disabled={locked} className="mt-7 space-y-6">
          <Field label="ChoiceMi offer" value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={120} placeholder="10% off the bill for ChoiceMi dates" hint="Each guest pays for themselves. The offer is applied by your staff at the venue." />
          <div className="grid gap-5 sm:grid-cols-2">
            <YesNo label="Step-free entrance" value={stepFree} onChange={setStepFree} />
            <YesNo label="Accessible toilet" value={toilet} onChange={setToilet} />
          </div>
          <div>
            <div className="label">Price level</div>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" aria-pressed={price === n} onClick={() => setPrice(n)} className={cn('rounded-full border px-5 py-2 text-[14px] font-semibold transition', price === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300')}>
                  {'€'.repeat(n)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-ink-100/60 p-5 text-[14px] text-ink-700">
            <h2 className="text-[15px] font-extrabold text-ink-900">Terms</h2>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={partnerTerms} onChange={(e) => setPartnerTerms(e.target.checked)} />
              <span>
                I accept the{' '}
                <a href="https://choicemi.com/partner-terms" target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
                  partner terms
                </a>
                .
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={dataTerms} onChange={(e) => setDataTerms(e.target.checked)} />
              <span>
                I accept the data-handling terms: we see only booking details and two usernames, and booking details leave the portal 30 days after the date.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={rights} onChange={(e) => setRights(e.target.checked)} />
              <span>ChoiceMi may show my four photos in the app to guests with a booking here.</span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>
                ChoiceMi may also use them in marketing. <i className="text-ink-400">Optional.</i>
              </span>
            </label>
          </div>
        </fieldset>

        {saveError && <Alert className="mt-5">{saveError}</Alert>}
        {missing.length > 0 && !locked && (
          <Alert tone="warn" className="mt-5">
            Still to do before you can send it: {missing.join(', ')}.
          </Alert>
        )}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="secondary" size="lg" onClick={() => router.push('/onboarding/photos')}>
            Back
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" disabled={saving || locked || !offer.trim()} onClick={() => void saveAll()}>
              Save
            </Button>
            <Button size="lg" disabled={saving || locked || !termsOk || !offer.trim() || missing.length > 0} onClick={submit}>
              {saving ? 'Sending…' : 'Send for review'}
            </Button>
          </div>
        </div>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Checklist ob={ob!} />
      </aside>
    </div>
  )
}
