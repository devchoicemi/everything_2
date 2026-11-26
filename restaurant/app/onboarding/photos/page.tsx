'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Alert, Badge, Button, cn } from '@/components/ui'
import { api, messageOf } from '@/lib/api'
import { useOnboarding } from '@/lib/onboarding'

const BRIEF = [
  { slot: 1, title: 'Outside view', where: 'Across the street or about 10 m away.', visible: 'The whole frontage and any nearby landmark.', why: 'Guests recognise the building on arrival.' },
  { slot: 2, title: 'Entrance', where: '2 to 3 m in front of the door.', visible: 'The door and the venue name, readable.', why: 'Confirms they are at the right door.' },
  { slot: 3, title: 'Interior, looking in', where: 'Just inside the door, facing the room.', visible: 'The seating area and host stand or counter.', why: 'Shows where to go after walking in.' },
  { slot: 4, title: 'Interior, looking back', where: 'The far side of the room, facing the entrance.', visible: 'The entrance door and the tables near it.', why: 'Shows where a date may be waiting, and the way out.' },
]

/** Step 3: the four photos that walk a nervous guest from the street to the table. */
export default function PhotosStep() {
  const router = useRouter()
  const { ob, reload } = useOnboarding()
  const v = ob!.venue
  const locked = v.reviewStatus === 'submitted'
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [rights, setRights] = useState(v.photoRights)
  const [marketing, setMarketing] = useState(v.marketingPhotos)
  const inputs = useRef<Record<number, HTMLInputElement | null>>({})

  const have = ob!.photos.length

  async function upload(slot: number, file: File | undefined) {
    if (!file) return
    setErrors((e) => ({ ...e, [slot]: '' }))
    setBusy(slot)
    const form = new FormData()
    form.append('photo', file)
    for (const k of ['noPeople', 'noFilters', 'recent']) form.append(k, 'true')
    try {
      await api(`/partner/onboarding/photos/${slot}`, { form })
      await reload()
    } catch (e) {
      setErrors((x) => ({ ...x, [slot]: messageOf(e) }))
    } finally {
      setBusy(null)
    }
  }

  async function remove(slot: number) {
    setBusy(slot)
    await api(`/partner/onboarding/photos/${slot}`, { method: 'DELETE' }).catch(() => {})
    await reload()
    setBusy(null)
  }

  async function next() {
    try {
      // the permission is part of the terms step on the server, kept here so it is asked next to the photos
      if (!v.termsAccepted) {
        sessionStorage.setItem('cm-photo-rights', JSON.stringify({ rights, marketing }))
      }
      router.push('/onboarding/offer')
    } catch {
      router.push('/onboarding/offer')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Four photos that walk a guest to the table</h1>
        <p className="mt-2 text-ink-600">A nervous guest should recognise your building, your door and the room before they arrive. Two photos are taken outside, two inside.</p>

        <label className="mt-5 flex items-start gap-3 rounded-xl bg-white p-4 text-[14px] ring-1 ring-ink-200">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={locked} />
          <span>
            I confirm my photos show no recognisable guests or staff, have no filters, added text or logos, and were taken in the last 12 months. <span className="text-ink-400">(Needed to upload.)</span>
          </span>
        </label>

        <div className="mt-5 space-y-4">
          {BRIEF.map((b) => {
            const p = ob!.photos.find((x) => x.slot === b.slot)
            const err = errors[b.slot]
            return (
              <div key={b.slot} className={cn('card grid gap-5 p-5 sm:grid-cols-[300px_1fr]', (p?.status === 'rejected' || err) && '!border-danger/40')}>
                <div className="relative">
                  {p ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={b.title} className="aspect-[3/2] w-full rounded-xl bg-ink-100 object-cover" />
                  ) : (
                    <button
                      type="button"
                      disabled={!confirmed || locked || busy !== null}
                      onClick={() => inputs.current[b.slot]?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (confirmed && !locked) void upload(b.slot, e.dataTransfer.files[0])
                      }}
                      className="flex aspect-[3/2] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-ink-100/60 text-center transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus className="text-brand-700" />
                      <span className="mt-2 text-[14px] font-bold">{busy === b.slot ? 'Uploading…' : `Drop the ${b.title.toLowerCase()} photo here`}</span>
                      <span className="mt-1 text-[12px] text-ink-500">{confirmed ? 'or choose a file · JPG, PNG or HEIC' : 'tick the confirmation above first'}</span>
                    </button>
                  )}
                  {p && (
                    <span className="absolute left-3 top-3">
                      {p.status === 'accepted' ? <Badge tone="ok">✓ Accepted</Badge> : p.status === 'rejected' ? <Badge tone="danger">✕ Not accepted</Badge> : <Badge tone="warn">Waiting for review</Badge>}
                    </span>
                  )}
                  <input ref={(el) => { inputs.current[b.slot] = el }} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { void upload(b.slot, e.target.files?.[0]); e.target.value = '' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[18px] font-extrabold">
                      {b.slot} · {b.title}
                    </h2>
                    {p && !locked && (
                      <span className="flex gap-3 text-[13px] font-bold">
                        <button className="text-brand-700" onClick={() => inputs.current[b.slot]?.click()} disabled={!confirmed || busy !== null}>
                          Replace
                        </button>
                        <button className="text-ink-400 hover:text-danger" aria-label="Remove" onClick={() => remove(b.slot)}>
                          <X size={16} />
                        </button>
                      </span>
                    )}
                    {!p && <Badge tone="warn">Needed</Badge>}
                  </div>
                  {err && <Alert className="mt-3">{err}</Alert>}
                  {p?.status === 'rejected' && p.rejectReason && <Alert className="mt-3">{p.rejectReason}</Alert>}
                  <Brief k="Where to stand" v={b.where} />
                  <Brief k="Must be visible" v={b.visible} />
                  <Brief k="Why" v={b.why} />
                  {p && (
                    <p className="mt-3 text-[12px] text-ink-400">
                      {p.width} × {p.height} px
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" size="lg" onClick={() => router.push('/onboarding/hours')}>
            Back
          </Button>
          <Button size="lg" onClick={next} disabled={have < 4}>
            Continue to offer and terms
          </Button>
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <h2 className="text-[15px] font-extrabold">Photo rules</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[13.5px] text-ink-600">
            <li>Landscape, at least 1600 px on the long edge</li>
            <li>JPG, PNG or HEIC, up to 10 MB each (JPG shows for the most guests)</li>
            <li>Normal service lighting, no filters, no added text or logos</li>
            <li>No recognisable guests or staff. Shoot an empty room or keep faces out of frame</li>
            <li>Taken in the last 12 months. Re-shoot after a renovation or a sign change</li>
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="text-[15px] font-extrabold">Permission</h2>
          <label className="mt-3 flex items-start gap-3 text-[13.5px] text-ink-700">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={rights} onChange={(e) => setRights(e.target.checked)} disabled={locked} />
            <span>
              ChoiceMi may show these photos in the app to guests with a booking here. <i className="text-ink-400">Required, saved with your terms.</i>
            </span>
          </label>
          <label className="mt-3 flex items-start gap-3 text-[13.5px] text-ink-700">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} disabled={locked} />
            <span>
              ChoiceMi may also use them in marketing. <i className="text-ink-400">Optional, a separate yes.</i>
            </span>
          </label>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-[13.5px] text-ink-700">
          <b>Faces are personal data.</b> If a guest or staff member is recognisable, we send the photo back to you.
        </div>
      </aside>
    </div>
  )
}

const Brief = ({ k, v }: { k: string; v: string }) => (
  <div className="mt-3">
    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">{k}</div>
    <div className="text-[14.5px] text-ink-800">{v}</div>
  </div>
)
