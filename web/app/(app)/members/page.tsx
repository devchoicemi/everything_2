'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProfileCVView } from '@/components/profile/ProfileCVView'
import { Button } from '@/components/ui/Button'
import { CompatBar } from '@/components/ui/CompatBar'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/useSession'
import { AuthError } from '@/services/auth'
import { membersApi, type FeedMember, type PairCompatibility } from '@/services/members'

/**
 * Real members and their compatibility with me, straight from the server's engine.
 * Before launch only admin and tester accounts can open it (and see each other).
 */
export default function MembersPage() {
  const router = useRouter()
  const { session } = useSession()
  const [members, setMembers] = useState<FeedMember[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<FeedMember | null>(null)
  const [pair, setPair] = useState<PairCompatibility | null>(null)

  useEffect(() => {
    let alive = true
    membersApi
      .feed()
      .then((r) => alive && setMembers(r.members))
      .catch((e) => alive && setError(e instanceof AuthError ? e.message : 'Could not load members.'))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setPair(null)
    if (!open) return
    let alive = true
    membersApi
      .compatibility(open.id)
      .then((r) => alive && setPair(r))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [open])

  const role = session?.user?.role
  const subtitle =
    role === 'admin' || role === 'tester'
      ? 'Testing view: real members, scored by the compatibility engine'
      : 'People who could be a good match, best first'

  if (open) {
    return (
      <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
        <button
          onClick={() => setOpen(null)}
          className="mb-5 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700"
        >
          <ArrowLeft size={17} /> All members
        </button>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ProfileCVView cv={open.cv} layout={open.layout} score={open.score} />
          <aside className="space-y-4">
            <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-warm-400">Compatibility breakdown</div>
              {(pair?.byCategory ?? open.byCategory).map((c) => (
                <CompatBar key={c.category} dim={{ d: c.label, p: c.percent, c: 'var(--t5)' }} />
              ))}
            </div>
            {pair && (
              <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-widest text-warm-400">Both directions</div>
                <Row k="Your ideals, scored on them" v={`${Math.round(pair.you.percent)}%`} />
                <Row k="Their ideals, scored on you" v={`${Math.round(pair.them.percent)}%`} />
                <Row k="Shown to both of you" v={`${Math.round(pair.final)}%`} strong />
              </div>
            )}
            {pair && (
              <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-widest text-warm-400">How your ratings scored them</div>
                {pair.you.breakdown
                  .filter((b) => !b.excluded)
                  .map((b) => (
                    <div key={b.field} className="flex items-center justify-between border-b border-warm-100 py-2 text-[13px] last:border-none">
                      <span className="text-warm-600">
                        {b.label}
                        {b.dealbreaker && <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">dealbreaker</span>}
                      </span>
                      <span className="font-semibold text-warm-900">{Math.round(b.score)}%</span>
                    </div>
                  ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <PageHeader title="Members" subtitle={subtitle} />
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{error}</p>}
      {!error && members === null && <p className="text-[14px] text-warm-500">Loading members…</p>}
      {members?.length === 0 && (
        <div className="rounded-2xl border border-warm-100 bg-white p-6 text-[14px] text-warm-600 shadow-sm">
          No other members are visible to you yet. Members need to have finished their profile and be a match for what you are looking for
          (and you for them).
          <div className="mt-4">
            <Button block={false} variant="secondary" size="sm" onClick={() => router.push('/discover')}>
              Back to Discover
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members?.map((m) => (
          <button
            key={m.id}
            onClick={() => setOpen(m)}
            className="rounded-2xl border border-warm-100 bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-brand-600 bg-white font-serif-i text-[20px] text-brand-700">
                  {m.cv.initial}
                </span>
                <div>
                  <div className="text-[16px] font-extrabold uppercase tracking-wide text-brand-800">{m.username}</div>
                  <div className="text-[12.5px] text-warm-500">{m.cv.facts.map((f) => f.value).slice(0, 3).join(' · ')}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={cn('font-serif-i text-[28px] leading-none text-brand-700')}>{m.score}%</div>
                <div className="text-[11px] text-warm-400">compatible</div>
              </div>
            </div>
            {m.cv.headline && <p className="mt-3 text-[13.5px] italic text-warm-600">{m.cv.headline}</p>}
            <div className="mt-3 space-y-1.5">
              {m.byCategory.slice(0, 4).map((c) => (
                <div key={c.category} className="flex items-center gap-2 text-[11.5px] text-warm-500">
                  <span className="w-[120px] flex-shrink-0 truncate">{c.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-warm-100">
                    <span className="block h-full rounded-full bg-brand-cta" style={{ width: `${c.percent}%` }} />
                  </span>
                  <span className="w-8 text-right font-semibold text-warm-700">{Math.round(c.percent)}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-warm-100 py-2.5 text-[13px] last:border-none">
      <span className="text-warm-500">{k}</span>
      <span className={strong ? 'font-bold text-brand-700' : 'font-semibold text-warm-900'}>{v}</span>
    </div>
  )
}
