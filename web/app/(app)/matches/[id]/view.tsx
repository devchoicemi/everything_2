'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Flag } from 'lucide-react'
import { ProfileCVView } from '@/components/profile/ProfileCVView'
import { Button } from '@/components/ui/Button'
import { CompatBar } from '@/components/ui/CompatBar'
import { cvFromMatch } from '@/lib/profile/cv'
import { normalizeLayout } from '@/lib/profile/layouts'
import { pluralise } from '@/lib/utils'
import { compatService, dateService, matchService } from '@/services/api'
import { LIVE } from '@/lib/live'
import { useStore } from '@/store'
import type { CompatibilityResult } from '@/lib/compat/types'
import type { DateBooking, Match } from '@/types'

export default function MatchDetailView({ params }: { params: { id: string } }) {
  const router = useRouter()
  const toast = useStore((s) => s.toast)
  const stored = useStore((s) => s.matches.find((m) => String(m.id) === params.id))
  const demoLayout = useStore((s) => normalizeLayout(s.profiles.find((p) => String(p.id) === params.id)?.layout))
  // a real match opened directly (a reload, a shared link) is fetched from the server
  const [fetched, setFetched] = useState<Match | null>(null)
  const [loading, setLoading] = useState(LIVE && !stored)
  const match = stored ?? fetched ?? undefined
  const layout = match?.layout ?? demoLayout
  // Someone you have already been on a date with can be asked for a re-date, right from their profile.
  const [pastDate, setPastDate] = useState<DateBooking | null>(null)
  const demoHadDate = useStore((s) => s.bookings.past.some((b) => b.un === match?.un))
  const hadDate = LIVE ? !!pastDate : demoHadDate
  const [compat, setCompat] = useState<CompatibilityResult | null>(null)

  useEffect(() => {
    if (!LIVE || stored) return
    let cancelled = false
    matchService
      .detail(params.id)
      .then((m) => !cancelled && setFetched(m ?? null))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  // the latest finished date with this person, if any
  useEffect(() => {
    // real accounts ask for a redate from their booking instead
    if (LIVE || !match?.memberId) return
    let cancelled = false
    dateService
      .bookings()
      .then((b) => {
        if (cancelled) return
        const done = b.past.filter((x) => x.live?.memberId === match.memberId)
        setPastDate(done[0] ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [match?.memberId])

  useEffect(() => {
    if (!match) return
    let cancelled = false
    compatService
      .getScore('me', String(match.memberId ?? match.id))
      .then((res) => !cancelled && setCompat(res))
      .catch(() => !cancelled && setCompat(null))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id])

  if (loading) {
    return (
      <div className="mx-auto max-w-content px-5 py-16">
        <div className="h-[420px] animate-pulse-soft rounded-3xl bg-warm-100" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 text-center">
        <p className="text-[15px] text-warm-500">This match is no longer available.</p>
        <Button block={false} className="mt-4" onClick={() => router.push('/matches')}>
          Back to matches
        </Button>
      </div>
    )
  }

  // Attendance and respect scores only mean something once dates have happened; until ChoiceMi
  // records them for real, a real member's profile shows only what is true: they are verified.
  const trust: [string, string][] = LIVE
    ? [['Identity', 'Verified']]
    : [
        ['100%', 'Attendance'],
        ['Excellent', 'Respect'],
        ['0', 'Reports'],
        ['Identity', 'Verified'],
      ]

  async function endMatch() {
    if (!match || !window.confirm(`End your match with ${match.un}? You will not see each other again.`)) return
    try {
      await matchService.unmatch(match.id)
      useStore.getState().setMatches(useStore.getState().matches.filter((m) => m.id !== match.id))
      router.push('/matches')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not end the match.', 'danger')
    }
  }

  async function askRedate() {
    if (!match || !pastDate) return
    try {
      const out = await dateService.requestRedate(pastDate.id)
      toast(out.mutual ? `You both want another date. Propose one now.` : `Re-date request sent to ${match.un}`, 'success')
      setPastDate({ ...pastDate, live: pastDate.live && { ...pastDate.live, redateRequested: true, redateMutual: out.mutual } })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the request.', 'danger')
    }
  }

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push('/matches')}
          className="flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700"
        >
          <ArrowLeft size={17} /> All matches
        </button>
        <button
          onClick={() => toast('Reported anonymously')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-warm-400 transition hover:text-danger"
        >
          <Flag size={14} /> Report
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* left */}
        <div className="min-w-0 space-y-6">
          <ProfileCVView
            cv={cvFromMatch(match)}
            layout={layout}
            score={compat ? Math.round(compat.final) : match.score}
            actions={
              hadDate && !pastDate?.live?.redateRequested ? (
                <Button
                  block={false}
                  size="sm"
                  variant="secondary"
                  onClick={LIVE ? askRedate : () => toast(`Re-date request sent to ${match.un}`, 'success')}
                >
                  Request a re-date
                </Button>
              ) : undefined
            }
          />

          <div className={'grid divide-x divide-warm-100 overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-sm ' + (trust.length > 1 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1')}>
            {trust.map(([v, l]) => (
              <div key={l} className="px-4 py-4 text-center">
                <div className="text-[13px] font-bold text-brand-700">{v}</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-warm-400">{l}</div>
              </div>
            ))}
          </div>

          {/* mobile — the propose CTA lives in the sticky-below right rail on
              desktop, which never applies here; pin it above the bottom nav
              instead of leaving it to whatever the page happens to scroll to */}
          <div className="sticky bottom-0 z-20 -mx-5 flex flex-col gap-2 bg-gradient-to-t from-warm-50 from-60% to-transparent px-5 pb-3 pt-8 lg:hidden">
            <Button onClick={() => router.push(LIVE ? `/booking?match=${match.id}` : match.inMotion ? '/dates' : `/dates/propose?matchId=${match.id}`)}>
              {LIVE ? (match.inMotion ? 'See your date →' : 'Plan your date →') : match.inMotion ? 'See your date →' : 'Propose a date →'}
            </Button>
            <button
              onClick={LIVE ? endMatch : () => toast('Match removed')}
              className="py-1 text-center text-[13px] font-medium text-warm-400 transition active:scale-95"
            >
              {LIVE ? 'End this match' : 'Not now'}
            </button>
          </div>
        </div>

        {/* right rail — compat breakdown + match info show on every size; the
            propose CTA card is desktop-only since mobile gets the sticky bar above */}
        <aside>
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-warm-400">
                Compatibility breakdown
              </div>
              {compat ? (
                compat.byCategory.map((c) => <CompatBar key={c.category} dim={{ d: c.label, p: c.percent, c: 'var(--t5)' }} />)
              ) : (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-3 w-full animate-pulse-soft rounded-full bg-warm-100" />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
              <Row k="Intent" v={match.intent} />
              <Row k="Matched" v={match.matched} />
              {match.inMotion ? (
                <Row k="Date" v="In motion" />
              ) : (
                <Row k="Expires" v={`${match.exp} ${pluralise(match.exp, 'day')}`} danger={match.exp <= 2} />
              )}
            </div>

            <div className="hidden rounded-2xl border border-brand-100 bg-brand-50/60 p-5 lg:block">
              <p className="mb-4 text-[13px] leading-relaxed text-brand-800">
                {match.inMotion
                  ? `You and ${match.un} have a date in motion. See it in your dates.`
                  : LIVE
                    ? `Ready to meet? Send ${match.un} three options for a blind date at a partner venue. You pick the day together.`
                    : `Ready to meet? Propose a blind date at a partner venue. ${match.un} has 48 hours to accept.`}
              </p>
              <Button className="mb-2" onClick={() => router.push(LIVE ? `/booking?match=${match.id}` : match.inMotion ? '/dates' : `/dates/propose?matchId=${match.id}`)}>
                {LIVE ? (match.inMotion ? 'See your date →' : 'Plan your date →') : match.inMotion ? 'See your date →' : 'Propose a date →'}
              </Button>
              <Button variant="ghost" onClick={LIVE ? endMatch : () => toast('Match removed')}>
                {LIVE ? 'End this match' : 'Not now'}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-warm-100 py-2.5 last:border-none">
      <span className="text-[13px] text-warm-500">{k}</span>
      <span className={'text-[13px] font-semibold ' + (danger ? 'text-danger' : 'text-warm-900')}>{v}</span>
    </div>
  )
}
