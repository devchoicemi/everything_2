'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadQuestionPool } from '@/services/profile'
import { MAX_PICKS, MIN_PICKS, useStore } from '@/store'
import type { PoolQuestion, PoolTheme } from '@/lib/questionPool'

/**
 * The read-check, built from the shared question pool instead of free typing.
 * The member chooses 4 to 5 questions and, for each, the suggested answer that is true for them.
 * A reader later sees those answers mixed with the pool's other suggestions and must spot the right one.
 * Nothing here is typed, so nothing can be misspelled, off-topic or unsafe.
 */
export function PoolQuestionPicker() {
  const picks = useStore((s) => s.poolPicks)
  const setPick = useStore((s) => s.setPoolPick)
  const removePick = useStore((s) => s.removePoolPick)
  const [pool, setPool] = useState<{ themes: PoolTheme[]; questions: PoolQuestion[] } | null>(null)
  const [theme, setTheme] = useState<string>('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadQuestionPool().then((p) => {
      if (!alive) return
      setPool(p)
      setTheme((t) => t || p.themes[0]?.id || '')
    })
    return () => {
      alive = false
    }
  }, [])

  const pickById = useMemo(() => new Map(picks.map((p) => [p.id, p])), [picks])
  const full = picks.length >= MAX_PICKS

  if (!pool) return <p className="py-8 text-center text-[13.5px] text-warm-400">Loading questions…</p>

  const visible = pool.questions.filter((q) => q.theme === theme)

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[var(--bdr-lt)] bg-[var(--card)] px-3.5 py-2.5">
        <div>
          <div className="font-serif-i text-[22px] font-bold not-italic text-brand-600">
            {picks.length}/{MAX_PICKS}
          </div>
          <div className="mt-px text-[12px] text-warm-500">
            questions chosen · pick {MIN_PICKS} to {MAX_PICKS}
          </div>
        </div>
        <p className="max-w-[200px] text-right text-[11px] leading-snug text-warm-400">
          Choose the answer that is true for you. Readers must spot it among the other options.
        </p>
      </div>

      <div className="no-scrollbar mb-3.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {pool.themes.map((t) => {
          const count = picks.filter((p) => pool.questions.find((q) => q.id === p.id)?.theme === t.id).length
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTheme(t.id)
                setOpenId(null)
              }}
              className={cn(
                'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] font-semibold transition-all active:scale-90',
                theme === t.id ? 'border-transparent bg-brand-cta text-white' : 'border-[var(--bdr)] bg-[var(--card)] text-warm-500',
              )}
            >
              {t.label}
              {count > 0 && (
                <span className={cn('rounded-full px-1.5 text-[10.5px]', theme === t.id ? 'bg-white/25' : 'bg-brand-100 text-brand-700')}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <div>
        {visible.map((q) => {
          const picked = pickById.get(q.id)
          const open = openId === q.id
          const blocked = full && !picked
          return (
            <div key={q.id} className={cn('q-card', picked && 'done', blocked && 'opacity-50')}>
              <button
                type="button"
                disabled={blocked}
                className="q-card-hd w-full text-left transition active:scale-[0.99]"
                onClick={() => setOpenId(open ? null : q.id)}
                aria-expanded={open}
              >
                <span className="q-num">{picked ? <Check size={12} strokeWidth={3} /> : ''}</span>
                <span className="flex-1">
                  <span className="q-text block font-medium">{q.question}</span>
                  {picked ? (
                    <span className="mt-1 inline-block rounded-full bg-brand-100 px-2.5 py-1 text-[11.5px] font-semibold leading-snug text-brand-800">Your answer: {picked.answer}</span>
                  ) : (
                    <span className="text-[11px] text-warm-400">{blocked ? `You have chosen ${MAX_PICKS}` : 'Tap to choose your answer'}</span>
                  )}
                </span>
                <ChevronDown size={16} className={cn('mt-1 flex-shrink-0 text-warm-400 transition-transform', open && 'rotate-180')} />
              </button>

              {open && (
                <div className="border-t border-[var(--bdr-lt)] px-3.5 pb-3.5 pt-3">
                  <div className="field-label">Which is true for you?</div>
                  {q.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => {
                        setPick({ id: q.id, question: q.question, options: q.options, answer: o })
                        setOpenId(null)
                      }}
                      className={cn('ob-opt mb-2 w-full text-left', picked?.answer === o && 'on')}
                    >
                      <span className="ob-radio">
                        <span className="ob-radio-dot" />
                      </span>
                      <span className="ob-opt-title">{o}</span>
                    </button>
                  ))}
                  {picked && (
                    <button
                      type="button"
                      onClick={() => {
                        removePick(q.id)
                        setOpenId(null)
                      }}
                      className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-warm-400 hover:text-danger"
                    >
                      <X size={13} /> Remove this question
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
