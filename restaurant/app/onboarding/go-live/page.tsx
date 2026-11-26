'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Check } from 'lucide-react'
import { Alert, Badge, Button, ButtonLink, cn } from '@/components/ui'
import { api, messageOf, type Onboarding } from '@/lib/api'
import { useOnboarding } from '@/lib/onboarding'

interface TestState {
  booking: null | {
    id: string
    ref: string
    status: string
    testGuests: { username: string; checkedIn: boolean; qr: string | null; bookingCode: string | null }[]
  }
}

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''))
  }, [value])
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="Test QR code" className="h-[150px] w-[150px] rounded-lg bg-white p-1" /> : <div className="h-[150px] w-[150px] rounded-lg bg-ink-100" />
}

const Step = ({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) => (
  <li className="flex gap-4 border-b border-ink-100 py-6 last:border-0">
    <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold', done ? 'bg-ok-50 text-ok-600' : 'bg-brand-100 text-brand-800')}>{done ? <Check size={18} strokeWidth={3} /> : n}</span>
    <div className="min-w-0 flex-1">
      <h2 className="text-[17px] font-extrabold">{title}</h2>
      {children}
    </div>
  </li>
)

/** After approval: the check-in device, a staff briefing, a test booking, and then Go live. */
export default function GoLivePage() {
  const { ob, save, saving, saveError, reload } = useOnboarding()
  const v = ob!.venue
  const [test, setTest] = useState<TestState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [camera, setCamera] = useState<'unknown' | 'allowed' | 'blocked'>('unknown')

  const loadTest = useCallback(async () => {
    try {
      setTest(await api<TestState>('/partner/onboarding/test'))
    } catch {
      /* not approved yet */
    }
  }, [])

  useEffect(() => {
    if (v.reviewStatus !== 'approved') return
    void loadTest()
    const t = setInterval(() => {
      void loadTest()
      void reload()
    }, 5000)
    return () => clearInterval(t)
  }, [v.reviewStatus, loadTest, reload])

  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((p) => setCamera(p.state === 'granted' ? 'allowed' : p.state === 'denied' ? 'blocked' : 'unknown'))
      .catch(() => {})
  }, [])

  if (v.reviewStatus !== 'approved') {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-[26px] font-extrabold">Not yet</h1>
        <p className="mt-2 text-ink-600">These steps open after ChoiceMi approves your application.</p>
        <ButtonLink href="/onboarding/status" className="mt-6" variant="secondary">
          See where it stands
        </ButtonLink>
      </div>
    )
  }

  const b = test?.booking ?? null
  const scanned = b?.testGuests.filter((g) => g.checkedIn).length ?? 0
  const progress = [
    { label: 'Request received by email and SMS', done: Boolean(b) },
    { label: 'Confirmed in the portal', done: Boolean(b) && b!.status !== 'requested' },
    { label: 'First test QR scanned', done: scanned >= 1 || ['in_progress', 'ended'].includes(b?.status ?? '') },
    { label: 'Second test QR scanned', done: scanned >= 2 || ['in_progress', 'ended'].includes(b?.status ?? '') },
    { label: 'Checkout confirmed', done: v.testDone },
  ]
  const ready = v.deviceReady && v.staffBriefed && v.testDone

  async function call(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
      await loadTest()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <span className="eyebrow">Almost there</span>
      <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">Get ready for your first date</h1>
      <p className="mt-2 text-ink-600">You go live after a test booking has run end to end on your own check-in device.</p>

      {v.status === 'active' && (
        <Alert tone="success" className="mt-5">
          You are live. Guests can now book your venue. <Link href="/dashboard" className="font-bold underline">Open the portal</Link>
        </Alert>
      )}

      <div className="card mt-6 px-6 sm:px-8">
        <ol>
          <Step n={1} done title="Review passed">
            <p className="text-[14px] text-ink-500">Business ID, map pin and photos approved.</p>
          </Step>
          <Step n={2} done={v.termsAccepted} title="Terms accepted">
            <p className="text-[14px] text-ink-500">Partner terms and data-handling terms.</p>
          </Step>
          <Step n={3} done={v.deviceReady} title="Set up a check-in device">
            <p className="text-[14px] text-ink-500">A phone or tablet at the host stand, signed in to this portal, with camera permission allowed so it can scan QR codes.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ButtonLink href="/checkin" variant="ink" size="sm">
                Open check-in on this device
              </ButtonLink>
              {camera === 'allowed' ? <Badge tone="ok">Camera allowed</Badge> : camera === 'blocked' ? <Badge tone="danger">Camera blocked: allow it in your browser</Badge> : <Badge tone="warn">Camera not allowed yet</Badge>}
            </div>
            <label className="mt-4 flex items-start gap-3 text-[14px]">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={v.deviceReady} disabled={busy || v.deviceReady} onChange={() => call(() => api('/partner/onboarding/readiness', { body: { deviceReady: true } }))} />
              <span>The check-in device is set up and can scan</span>
            </label>
          </Step>
          <Step n={4} done={v.staffBriefed} title="Brief your staff">
            <p className="text-[14px] text-ink-500">Everyone who works the host stand should know:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-ink-700">
              <li>How to scan a QR code</li>
              <li>
                The fallback: username <b>and</b> the 4-digit code, never a username alone
              </li>
              <li>How to confirm checkout</li>
              <li>That a guest may ask them for help</li>
            </ul>
            <label className="mt-4 flex items-start gap-3 text-[14px]">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={v.staffBriefed} disabled={busy || v.staffBriefed} onChange={() => call(() => api('/partner/onboarding/readiness', { body: { staffBriefed: true } }))} />
              <span>Our staff have been briefed</span>
            </label>
          </Step>
          <Step n={5} done={v.testDone} title="Run a test booking">
            <p className="text-[14px] text-ink-500">We send a test request. You confirm it in Requests, scan two test QR codes at Check-in, and confirm checkout. Nothing is shown to real guests.</p>
            {!b && (
              <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => call(() => api('/partner/onboarding/test/start', { body: {} }))}>
                Send me a test request
              </Button>
            )}
            {b && (
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="rounded-xl bg-ink-100/60 p-4">
                  <div className="text-[13px] font-bold">Test booking {b.ref}</div>
                  <ul className="mt-2 space-y-1.5 text-[13.5px]">
                    {progress.map((p) => (
                      <li key={p.label} className={cn('flex items-center gap-2', p.done ? 'text-ink-800' : 'text-ink-400')}>
                        {p.done ? <Check size={15} className="text-ok-600" strokeWidth={3} /> : <span className="h-3.5 w-3.5 rounded-full border border-ink-300" />} {p.label}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.status === 'requested' && (
                      <ButtonLink href="/requests" size="sm">
                        Open the request
                      </ButtonLink>
                    )}
                    {(b.status === 'confirmed' || b.status === 'partially_checked_in') && (
                      <ButtonLink href="/checkin" size="sm">
                        Scan the codes
                      </ButtonLink>
                    )}
                    {b.status === 'in_progress' && (
                      <Button size="sm" disabled={busy} onClick={() => call(() => api(`/partner/bookings/${b.id}/end`, { body: {} }))}>
                        Confirm checkout
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {b && b.testGuests.some((g) => g.qr) && (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {b.testGuests.map((g) => (
                  <div key={g.username} className="rounded-xl border border-ink-200 p-4 text-center">
                    <div className="text-[13px] font-bold">{g.username}</div>
                    {g.qr && !g.checkedIn ? (
                      <div className="mt-2 flex justify-center">
                        <Qr value={g.qr} />
                      </div>
                    ) : (
                      <div className="mt-3 text-[14px] font-bold text-ok-600">Scanned ✓</div>
                    )}
                    <div className="mt-2 text-[12px] text-ink-500">
                      Fallback: username + code <b className="font-mono">{g.bookingCode}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Step>
        </ol>
      </div>

      {(error || saveError) && <Alert className="mt-4">{error || saveError}</Alert>}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" disabled={!ready || busy || saving || v.status === 'active'} onClick={() => save(() => api<Onboarding>('/partner/onboarding/go-live', { body: {} }))}>
          {v.status === 'active' ? 'You are live' : 'Go live'}
        </Button>
        {!ready && <span className="text-[13.5px] text-ink-500">Finish steps 3 to 5 first.</span>}
      </div>
    </div>
  )
}
