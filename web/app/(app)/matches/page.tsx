'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Chip } from '@/components/ui/Chip'
import { MatchCard } from '@/components/matches/MatchCard'
import { compatService, matchService } from '@/services/api'
import { LIVE } from '@/lib/live'
import { useStore } from '@/store'

type Filter = 'all' | 'new' | 'expiring' | 'high'

const isNew = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < 24 * 3_600_000

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All matches' },
  { id: 'new', label: 'New today' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'high', label: 'High compatibility' },
]

export default function MatchesPage() {
  const matches = useStore((s) => s.matches)
  const setMatches = useStore((s) => s.setMatches)
  const [filter, setFilter] = useState<Filter>('all')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(LIVE)
  const [loadError, setLoadError] = useState<string | null>(null)

  // real accounts load their own matches
  useEffect(() => {
    if (!LIVE) return
    let cancelled = false
    matchService
      .list()
      .then((list) => !cancelled && setMatches(list))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Could not load your matches.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      matches.map((m) =>
        m.score !== undefined
          ? Promise.resolve([String(m.id), m.score] as const)
          : compatService
              .getScore('me', String(m.id))
              .then((res) => [String(m.id), res.final] as const)
              .catch(() => [String(m.id), undefined] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return
      const next: Record<string, number> = {}
      for (const [id, score] of pairs) if (score !== undefined) next[id] = score
      setScores(next)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  const filtered = useMemo(() => {
    if (filter === 'new') return LIVE ? matches.filter((m) => isNew(m.matchedAt)) : matches.slice(0, 2)
    if (filter === 'expiring') return matches.filter((m) => !m.inMotion && m.exp <= 3)
    if (filter === 'high') return matches.filter((m) => (scores[String(m.id)] ?? 0) >= 80)
    return matches
  }, [matches, filter, scores])
  const newCount = LIVE ? matches.filter((m) => isNew(m.matchedAt)).length : 3

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <PageHeader
        photo="dinner"
        photoPosition="40% 40%"
        title="Matches"
        subtitle={`${matches.length} mutual matches · propose a date before they expire`}
        actions={
          newCount > 0 ? (
            <span className="rounded-full bg-coral-50 px-3 py-1.5 text-[12px] font-bold text-coral-600">
              {newCount} new
            </span>
          ) : undefined
        }
      />

      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {loading || loadError ? (
        loadError ? (
          <div className="rounded-3xl border border-warm-100 bg-white px-8 py-16 text-center text-[15px] text-warm-600">{loadError}</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[210px] animate-pulse-soft rounded-2xl bg-warm-100" />
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-warm-100 bg-white px-8 py-20 text-center">
          <Search size={40} className="mb-3 text-warm-300" />
          <p className="text-[15px] text-warm-500">
            {LIVE && matches.length === 0
              ? 'No matches yet. When you and someone else both like each other after reading, they appear here.'
              : 'No matches in this filter yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  )
}
