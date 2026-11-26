'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import jsQR from 'jsqr'
import { CheckCircle2, ChevronLeft, XCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { ApiError, api, messageOf, type CheckInResult, type VenueBooking } from '@/lib/api'
import { todayHelsinki } from '@/lib/format'
import { useSession } from '@/lib/session'

type Outcome = { kind: 'first' | 'started'; res: CheckInResult } | { kind: 'error'; message: string }

/**
 * The check-in screen for the phone or tablet at the host stand. It scans a guest's QR code with the camera; if a
 * scan fails, staff type the guest's username and the 4-digit booking code together. A username alone never works.
 */
export default function CheckInPage() {
  const { me } = useSession()
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const busy = useRef(false)
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [cameraError, setCameraError] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [next, setNext] = useState<VenueBooking | null>(null)
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [working, setWorking] = useState(false)

  const loadNext = useCallback(async () => {
    try {
      const today = todayHelsinki()
      const r = await api<{ bookings: VenueBooking[] }>(`/partner/bookings?from=${today}&to=${today}`)
      const upcoming = r.bookings.filter((b) => ['confirmed', 'partially_checked_in'].includes(b.status)).sort((a, b) => a.startAt.localeCompare(b.startAt))
      setNext(upcoming[0] ?? null)
    } catch {
      /* the scan screen works without it */
    }
  }, [])
  useEffect(() => {
    void loadNext()
  }, [loadNext])

  const handle = useCallback(
    async (fn: () => Promise<CheckInResult>) => {
      setWorking(true)
      try {
        const res = await fn()
        setOutcome({ kind: res.started ? 'started' : 'first', res })
        void loadNext()
      } catch (e) {
        setOutcome({ kind: 'error', message: e instanceof ApiError ? e.message : messageOf(e) })
      } finally {
        setWorking(false)
        busy.current = false
      }
    },
    [loadNext],
  )

  // camera + decoding
  useEffect(() => {
    if (mode !== 'scan' || outcome) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const detector = typeof window !== 'undefined' && 'BarcodeDetector' in window ? new (window as unknown as { BarcodeDetector: new (o: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] }) : null

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const v = video.current!
        v.srcObject = stream
        await v.play()
        setCameraError('')
        const tick = async () => {
          if (stopped) return
          if (!busy.current && v.readyState >= 2) {
            let text = ''
            if (detector) {
              try {
                text = (await detector.detect(v))[0]?.rawValue ?? ''
              } catch {
                /* fall through to the canvas decoder */
              }
            }
            if (!text) {
              const c = canvas.current!
              const w = Math.min(640, v.videoWidth)
              const h = Math.round((w / v.videoWidth) * v.videoHeight)
              c.width = w
              c.height = h
              const ctx = c.getContext('2d', { willReadFrequently: true })!
              ctx.drawImage(v, 0, 0, w, h)
              text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? ''
            }
            if (text && text.startsWith('cm1.')) {
              busy.current = true
              void handle(() => api<CheckInResult>('/partner/checkin/scan', { body: { token: text } }))
            }
          }
          raf = requestAnimationFrame(() => void tick())
        }
        void tick()
      } catch (e) {
        setCameraError((e as Error).name === 'NotAllowedError' ? 'Camera access is blocked. Allow the camera for this site in your browser, or use username and code.' : 'We could not open the camera on this device. Use username and code instead.')
      }
    }
    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [mode, outcome, handle])

  // a result stays on screen for a few seconds, then the scanner is ready again
  useEffect(() => {
    if (!outcome || outcome.kind === 'error') return
    const t = setTimeout(() => setOutcome(null), 5000)
    return () => clearTimeout(t)
  }, [outcome])

  const frame = 'mx-auto flex min-h-screen max-w-md flex-col bg-ink-950 px-5 pb-8 pt-6 text-white'

  if (outcome && outcome.kind !== 'error') {
    const r = outcome.res
    const started = outcome.kind === 'started'
    return (
      <div className={frame}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CheckCircle2 size={72} className="text-ok-100" />
          <div className="mt-6 text-[13px] font-bold uppercase tracking-[0.14em] text-brand-300">{started ? 'The date has started' : 'First guest checked in'}</div>
          <h1 className="mt-2 text-[30px] font-extrabold leading-tight">{started ? `${r.booking.guests.map((g) => g.username).join(' & ')}` : `${r.username} is checked in`}</h1>
          <p className="mt-3 text-[15px] text-white/70">{started ? 'Both guests are here and have been told. Welcome them to the table.' : `Waiting for ${r.booking.guests.find((g) => !g.checkedInAt)?.username ?? 'the second guest'}.`}</p>
          <p className="mt-6 text-[13px] text-white/40">
            {r.booking.ref} · {r.booking.time}
          </p>
        </div>
        <Button block size="lg" variant="secondary" onClick={() => setOutcome(null)}>
          Scan the next guest
        </Button>
      </div>
    )
  }

  if (outcome?.kind === 'error') {
    return (
      <div className={frame}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <XCircle size={72} className="text-danger" />
          <h1 className="mt-6 text-[26px] font-extrabold">That code was not accepted</h1>
          <p className="mt-3 text-[15px] text-white/70">{outcome.message}</p>
        </div>
        <Button block size="lg" onClick={() => { setOutcome(null); setMode('scan') }}>
          Try again
        </Button>
        <Button block size="lg" variant="secondary" className="mt-3" onClick={() => { setOutcome(null); setMode('manual') }}>
          Enter username and code instead
        </Button>
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div className={frame}>
        <button onClick={() => setMode('scan')} className="mb-6 flex items-center gap-1 text-[14px] font-semibold text-white/70">
          <ChevronLeft size={18} /> Back to scanning
        </button>
        <h1 className="text-[28px] font-extrabold leading-tight">Username and code</h1>
        <p className="mt-2 text-[14.5px] text-white/60">Ask the guest for their ChoiceMi username <b className="text-white">and</b> the 4-digit booking code on their date card. Both must match.</p>
        <label className="mt-8 text-[12.5px] font-bold uppercase tracking-wider text-white/50" htmlFor="u">
          Username
        </label>
        <input id="u" className="input mt-1.5 !border-white/15 !bg-white/10 !text-white" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Birch_Storm" />
        <label className="mt-5 text-[12.5px] font-bold uppercase tracking-wider text-white/50" htmlFor="c">
          4-digit booking code
        </label>
        <input id="c" className="input mt-1.5 !border-white/15 !bg-white/10 text-center font-mono text-[28px] tracking-[0.5em] !text-white" inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="····" />
        <Button className="mt-8" block size="lg" disabled={working || !username.trim() || code.length !== 4} onClick={() => handle(() => api<CheckInResult>('/partner/checkin/manual', { body: { username, code } })).then(() => { setUsername(''); setCode('') })}>
          {working ? 'Checking…' : 'Check in'}
        </Button>
      </div>
    )
  }

  return (
    <div className={frame}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-brand-300">{me?.venue.name}</div>
          <h1 className="text-[26px] font-extrabold leading-tight">Check in guests</h1>
        </div>
        <Link href="/dashboard" className="pt-1 text-[13.5px] font-bold text-brand-300">
          Today
        </Link>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-3xl bg-white/[0.06]">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <canvas ref={canvas} className="hidden" />
        {!cameraError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-60 w-60">
              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => (
                <span key={c} className={`absolute h-12 w-12 border-white ${c}`} />
              ))}
              <span className="absolute inset-x-3 top-1/2 h-0.5 bg-pink-500/80" />
            </div>
          </div>
        )}
        <p className="absolute inset-x-0 bottom-5 px-6 text-center text-[15px] font-semibold">{cameraError || (working ? 'Checking…' : 'Point the camera at the guest’s QR code')}</p>
      </div>
      {next && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold text-white/50">Next date</div>
            <div className="truncate text-[15px] font-bold">
              {next.time} · {next.guests.map((g) => g.username).join(' & ')}
            </div>
          </div>
          <div className="text-right text-[12px] font-bold text-brand-300">
            QR valid
            <br />
            {new Date(new Date(next.startAt).getTime() - 30 * 60_000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} to {new Date(new Date(next.startAt).getTime() + 30 * 60_000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
      <Button className="mt-4" block size="lg" variant="secondary" onClick={() => setMode('manual')}>
        Enter username and code instead
      </Button>
    </div>
  )
}
