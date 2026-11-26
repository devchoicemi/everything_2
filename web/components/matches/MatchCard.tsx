'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock, Heart } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn, expiryBand, pluralise } from '@/lib/utils'
import { compatService } from '@/services/api'
import type { Match } from '@/types'

export function MatchCard({ match }: { match: Match; index?: number }) {
  const band = expiryBand(match.exp)
  const [score, setScore] = useState<number | undefined>(match.score)

  useEffect(() => {
    // real matches arrive already scored
    if (match.score !== undefined) return
    let cancelled = false
    compatService
      .getScore('me', String(match.memberId ?? match.id))
      .then((res) => !cancelled && setScore(res.final))
      .catch(() => !cancelled && setScore(undefined))
    return () => {
      cancelled = true
    }
  }, [match.id, match.memberId, match.score])

  return (
    <Link
      href={`/matches/${match.id}`}
      className="cm-reveal lift group flex h-full flex-col overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-sm"
    >
      <div className="h-1.5 bg-brand-cta" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3.5">
          <Avatar letter={match.av} color={match.avc} size={52} />
          <div className="min-w-0 flex-1">
            <div className="font-serif-i text-[18px] text-warm-900">{match.un}</div>
            <div className="mt-0.5 text-[12.5px] text-warm-500">
              {match.age} · {match.city}
            </div>
          </div>
          <div className="text-right">
            <div className={cn('font-serif-i text-[22px] leading-none text-brand-700', score === undefined && 'animate-pulse-soft')}>
              {score === undefined ? '···' : `${score}%`}
            </div>
            <div className="text-[10px] font-medium text-warm-400">match</div>
          </div>
        </div>

        <p className="mt-4 flex-1 rounded-xl bg-brand-50 px-3.5 py-3 text-[13px] leading-snug text-warm-700">
          <Heart size={13} fill="currentColor" className="mr-1.5 inline-block align-[-2px] text-brand-600" />
          {match.hl}
        </p>

        <div className="mt-4 flex items-center justify-between">
          {match.inMotion ? (
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700">
              <Clock size={12} /> Date in motion
            </span>
          ) : (
            <span
              className={cn(
                'flex items-center gap-1.5 text-[11.5px] font-semibold',
                band === 'urgent' && 'text-danger',
                band === 'warn' && 'text-amber-600',
                band === 'ok' && 'text-warm-400',
              )}
            >
              {band === 'urgent' ? <AlertTriangle size={12} /> : <Clock size={12} />}
              {match.exp} {pluralise(match.exp, 'day')} to propose
            </span>
          )}
          <span className="flex items-center gap-1 text-[12px] font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">
            View <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
