'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Check, Leaf, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProfileCard } from '@/components/profile/ProfileCard'
import { FullProfileView } from '@/components/profile/FullProfileView'
import { QuizModal } from '@/components/quiz/QuizModal'
import { MatchCelebration } from '@/components/matches/MatchCelebration'
import { MissedConnection } from '@/components/matches/MissedConnection'
import { Button } from '@/components/ui/Button'
import { BrandPhoto } from '@/components/ui/BrandPhoto'
import { CompatBar } from '@/components/ui/CompatBar'
import { compatService, discoverService } from '@/services/api'
import { ConnectReasonIcon } from '@/lib/connectReasonIcons'
import { LIVE } from '@/lib/live'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import type { CompatibilityResult } from '@/lib/compat/types'
import type { Match, Profile } from '@/types'

/** Profile → Match: the two shapes overlap deliberately (see types/index.ts) — this is the one seam. */
function profileToMatch(profile: Profile, matchId?: string | null): Match {
  return {
    id: matchId ?? profile.id,
    memberId: typeof profile.id === 'string' ? profile.id : undefined,
    cv: profile.cv,
    score: profile.score,
    layout: profile.layout,
    un: profile.un,
    age: profile.age,
    city: profile.city,
    av: profile.av,
    avc: profile.avc,
    hl: profile.headline,
    matched: 'Just now',
    exp: 7,
    intent: profile.intent,
    why: profile.hl,
    ans: profile.ans,
  }
}

export default function DiscoverPage() {
  const router = useRouter()
  const profiles = useStore((s) => s.profiles)
  const cursor = useStore((s) => s.cursor)
  const advance = useStore((s) => s.advanceCursor)
  const setProfiles = useStore((s) => s.setProfiles)
  const toast = useStore((s) => s.toast)
  const addMatch = useStore((s) => s.addMatch)
  const user = useStore((s) => s.user)

  const [view, setView] = useState<'stack' | 'full'>('stack')
  const [exiting, setExiting] = useState<'like' | 'pass' | null>(null)
  const [readEnough, setReadEnough] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [celebrateWith, setCelebrateWith] = useState<Profile | null>(null)
  const [missedWith, setMissedWith] = useState<Profile | null>(null)
  const [compat, setCompat] = useState<CompatibilityResult | null>(null)
  const [celebrateScore, setCelebrateScore] = useState<number | undefined>(undefined)
  // real accounts load their own deck; the offline app already holds its demo one
  const [loading, setLoading] = useState(LIVE)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!LIVE) return
    let cancelled = false
    discoverService
      .feed()
      .then((deck) => !cancelled && setProfiles(deck))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Could not load members.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = profiles[cursor]
  const next = profiles[cursor + 1]
  const nextNext = profiles[cursor + 2]
  const remaining = profiles.length - cursor
  const dailyTotal = profiles.length

  useEffect(() => {
    setCompat(null)
    if (!current) return
    let cancelled = false
    compatService
      .getScore('me', String(current.id))
      .then((res) => !cancelled && setCompat(res))
      .catch(() => !cancelled && setCompat(null))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  function reset() {
    setView('stack')
    setReadEnough(false)
    setExiting(null)
  }

  function pass() {
    if (!current) return
    discoverService.pass(current.id).catch((e) => toast(e instanceof Error ? e.message : 'Could not save that.', 'danger'))
    setExiting('pass')
    setView('stack')
    setTimeout(() => {
      advance()
      reset()
    }, 380)
  }

  async function like() {
    if (!current) return
    const liked = current
    const likedScore = compat?.final
    setExiting('like')
    setView('stack')
    let outcome: { mutual: boolean; matchId?: string | null; score?: number }
    try {
      outcome = await discoverService.like(liked.id)
    } catch (e) {
      setExiting(null)
      toast(e instanceof Error ? e.message : 'Could not send your like.', 'danger')
      return
    }
    const { mutual } = outcome
    setTimeout(() => {
      advance()
      reset()
      if (mutual) {
        addMatch(profileToMatch(liked, outcome.matchId))
        setCelebrateScore(likedScore ?? outcome.score)
        setCelebrateWith(liked)
      } else {
        setMissedWith(liked)
      }
    }, 380)
  }

  if (loading || loadError) {
    return (
      <div className="mx-auto max-w-content px-5 py-10 lg:px-10">
        <PageHeader title="Discover" subtitle={loadError ? 'Something went wrong' : 'Finding people who fit you…'} />
        {loadError ? (
          <div className="rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center">
            <p className="text-[15px] text-warm-600">{loadError}</p>
            <Button block={false} className="mt-5" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="h-[420px] animate-pulse-soft rounded-3xl bg-warm-100" />
        )}
      </div>
    )
  }

  const overlays = (
    <>
      <MatchCelebration
        profile={celebrateWith}
        score={celebrateScore}
        open={!!celebrateWith}
        onView={() => {
          setCelebrateWith(null)
          router.push('/matches')
        }}
        onKeepDiscovering={() => setCelebrateWith(null)}
      />

      <MissedConnection profile={missedWith} open={!!missedWith} onClose={() => setMissedWith(null)} />
    </>
  )

  if (!current) {
    return (
      <>
        <div className="mx-auto max-w-content px-5 py-10 lg:px-10">
          <PageHeader title="Discover" subtitle={`Helsinki · ${user.city}`} />
          <div className="relative isolate flex flex-col items-center justify-center overflow-hidden rounded-3xl px-8 py-24 text-center text-white shadow-lg">
            <BrandPhoto name="toast" position="45% 30%" className="absolute inset-0 -z-20 h-full w-full" />
            <div
              className="absolute inset-0 -z-10"
              style={{
                background:
                  'linear-gradient(160deg, rgba(27,10,61,0.90) 0%, rgba(87,20,184,0.80) 55%, rgba(236,72,153,0.66) 100%)',
              }}
            />
            <Leaf size={44} className="mb-4 animate-pulse-soft text-pink-200" />
            <div className="font-serif text-[28px]">{LIVE ? 'No one new right now' : 'You\u2019ve seen everyone today'}</div>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-white/80">
              {LIVE
                ? 'You have seen everyone who fits for now. New members appear as they join. Meanwhile, check your matches.'
                : 'New profiles arrive tomorrow morning. Meanwhile, check your matches.'}
            </p>
            <Button block={false} className="mt-6" onClick={() => router.push('/matches')}>
              Go to matches →
            </Button>
          </div>
        </div>
        {overlays}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      {view === 'stack' ? (
        <PageHeader
          title="Discover"
          subtitle={`${remaining} of ${dailyTotal} profiles left today · ${user.city}`}
          actions={
            <button
              onClick={() => router.push('/profile')}
              aria-label="Filters"
              className="flex h-10 items-center gap-2 rounded-full border border-warm-200 bg-white px-4 text-[13px] font-semibold text-warm-700 transition active:scale-90 hover:border-brand-300 hover:text-brand-800 sm:px-4 max-sm:w-10 max-sm:justify-center max-sm:px-0"
            >
              <SlidersHorizontal size={15} />
              <span className="max-sm:hidden">Filters</span>
            </button>
          }
        />
      ) : (
        <button
          onClick={reset}
          className="mb-5 flex items-center gap-2 text-[14px] font-semibold text-warm-600 transition hover:text-brand-700"
        >
          <ArrowLeft size={17} />
          Back to discover
        </button>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div key={`${current.id}-${view}`} className="cm-page min-w-0">
          {view === 'stack' ? (
            <>
              <ProfileCard
                profile={current}
                score={compat?.final}
                behind={next}
                behind2={nextNext}
                exiting={exiting}
                onOpen={() => setView('full')}
                onPass={pass}
              />
              {/* desktop — text pill row */}
              <div className="mt-5 hidden gap-3 lg:flex">
                <Button variant="ghost" className="flex-[0.7]" onClick={pass}>
                  <X size={17} /> Pass
                </Button>
                <Button className="flex-[1.4]" onClick={() => setView('full')}>
                  Read profile →
                </Button>
              </div>
              {/* mobile — Tinder-style circular action bar, pinned above the bottom nav
                  regardless of how far the card's own content has scrolled */}
              <CardActionBar
                onPass={pass}
                onPrimary={() => setView('full')}
                primaryIcon={<BookOpen size={26} strokeWidth={2.25} />}
                primaryLabel="Read profile"
              />
            </>
          ) : (
            <>
              <FullProfileView
                profile={current}
                score={compat?.final}
                categories={compat?.byCategory}
                onReadEnough={setReadEnough}
              />
              <div className="mt-5 hidden gap-3 lg:flex">
                <Button variant="ghost" className="flex-[0.7]" onClick={pass}>
                  Pass
                </Button>
                <Button className="flex-[1.4]" disabled={!readEnough} onClick={() => setQuizOpen(true)}>
                  I&apos;ve read this →
                </Button>
              </div>
              <CardActionBar
                onPass={pass}
                onPrimary={() => setQuizOpen(true)}
                primaryDisabled={!readEnough}
                primaryIcon={<Check size={28} strokeWidth={3} />}
                primaryLabel={readEnough ? "I've read this" : 'Keep reading…'}
              />
            </>
          )}
        </div>

        {/* right rail — desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div key={current.id} className="cm-reveal space-y-4">
              <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-warm-400">
                  <Sparkles size={13} className="text-brand-600" />
                  Why you might connect
                </div>
                <ul className="space-y-2.5">
                  {current.hl.map((h) => (
                    <li key={h.t} className="flex items-start gap-2.5 text-[13px] leading-snug text-warm-700">
                      <ConnectReasonIcon kind={h.i} size={13} className="mt-0.5 flex-shrink-0 text-brand-600" />
                      {h.t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
                <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-warm-400">
                  Compatibility {compat ? `· ${compat.final}%` : ''}
                </div>
                {compat ? (
                  compat.byCategory.map((c) => <CompatBar key={c.category} dim={{ d: c.label, p: c.percent }} />)
                ) : (
                  <div className="space-y-3">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-3 w-full animate-pulse-soft rounded-full bg-warm-100" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {view === 'full' && (
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
                <p className="mb-3 text-[12.5px] leading-relaxed text-brand-800">
                  {readEnough
                    ? 'Nice, you read it. Pass the read-check to send your like.'
                    : 'Scroll to the end of the profile to unlock the read-check.'}
                </p>
                <div className="flex gap-2.5">
                  <Button variant="ghost" size="sm" className="flex-[0.7]" onClick={pass}>
                    Pass
                  </Button>
                  <Button size="sm" className="flex-[1.4]" disabled={!readEnough} onClick={() => setQuizOpen(true)}>
                    Read-check →
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-warm-100 bg-white px-5 py-4">
              <span className="text-[12.5px] font-medium text-warm-500">Today&apos;s picks</span>
              <span className="flex gap-1">
                {Array.from({ length: dailyTotal }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      i === cursor ? 'w-4 bg-brand-400' : 'w-2',
                      i < cursor ? 'bg-brand-500' : i === cursor ? '' : 'bg-warm-200',
                    )}
                  />
                ))}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <QuizModal
        targetId={String(current.id)}
        targetName={current.un}
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        onPass={() => {
          reset()
          void like()
        }}
      />

      {overlays}
    </div>
  )
}

/**
 * Tinder-style circular action bar — mobile only. Sticky within the page's
 * own scroll container so it stays pinned just above the bottom nav no
 * matter how far the card/profile content above it has scrolled; the
 * desktop text-pill row (rendered separately) never scrolls out of reach in
 * the first place, so it doesn't need this treatment.
 */
function CardActionBar({
  onPass,
  onPrimary,
  primaryIcon,
  primaryLabel,
  primaryDisabled,
}: {
  onPass: () => void
  onPrimary: () => void
  primaryIcon: React.ReactNode
  primaryLabel: string
  primaryDisabled?: boolean
}) {
  return (
    <div className="sticky bottom-0 z-20 mt-5 -mx-5 flex items-center justify-center gap-8 bg-gradient-to-t from-warm-50 from-60% to-transparent px-5 pb-4 pt-6 lg:hidden">
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onPass}
          aria-label="Pass"
          className="flex items-center justify-center rounded-full border-2 border-warm-200 bg-white text-warm-400 shadow-lg transition active:scale-90 hover:border-danger hover:text-danger"
          style={{ height: 60, width: 60 }}
        >
          <X size={26} strokeWidth={2.5} />
        </button>
        <span className="text-[11px] font-semibold text-warm-400">Pass</span>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          aria-label={primaryLabel}
          className={cn(
            'flex items-center justify-center rounded-full text-white shadow-glow transition active:scale-90',
            primaryDisabled ? 'bg-warm-300 shadow-none' : 'bg-brand-cta hover:brightness-110',
          )}
          style={{ height: 68, width: 68 }}
        >
          {primaryIcon}
        </button>
        <span className={cn('text-[11px] font-semibold', primaryDisabled ? 'text-warm-300' : 'text-brand-700')}>
          {primaryLabel}
        </span>
      </div>
    </div>
  )
}
