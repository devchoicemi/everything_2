'use client'

import { useState } from 'react'
import { Check, Lightbulb, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MAX_WORDS_PER_ANSWER,
  MIN_PROMPTS_ANSWERED,
  MIN_WORDS_PER_ANSWER,
  STORY_PROMPTS,
  assessStory,
  checkText,
  countWords,
} from '@/lib/profile/quality'
import { useStore } from '@/store'

/**
 * "Tell us about yourself", as guided questions instead of one blank box. Each answer is checked
 * as it is written, so filler ("123445566", repeated words, keyboard mashing) is caught straight away
 * with a plain explanation, and the examples show what a good answer looks like.
 */
export function StoryGuide() {
  const prompts = useStore((s) => s.aiDraft.prompts)
  const extra = useStore((s) => s.aiDraft.extra)
  const patchStory = useStore((s) => s.patchStory)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showExtra, setShowExtra] = useState(Boolean(extra.trim()))

  const assessment = assessStory({ prompts, extra })

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[var(--bdr-lt)] bg-[var(--card)] px-3.5 py-2.5">
        <div>
          <div className="font-serif-i text-[22px] font-bold not-italic text-brand-600">
            {Math.min(assessment.answered, MIN_PROMPTS_ANSWERED)}/{MIN_PROMPTS_ANSWERED}
          </div>
          <div className="mt-px text-[12px] text-warm-500">good answers · need {MIN_PROMPTS_ANSWERED}</div>
        </div>
        <p className="max-w-[210px] text-right text-[11px] leading-snug text-warm-400">
          Write real sentences, like you would to someone you have just met. Numbers, repeated words and random letters do not count.
        </p>
      </div>

      {STORY_PROMPTS.map((p) => {
        const text = prompts[p.id] ?? ''
        const c = text.trim() ? checkText(text) : null
        const showProblem = c && !c.ok && c.problem !== 'too_short' ? true : Boolean(touched[p.id] && c && !c.ok)
        const words = countWords(text)
        return (
          <div key={p.id} className={cn('q-card', c?.ok && 'done')}>
            <div className="px-3.5 pb-3.5 pt-3">
              <label htmlFor={`story-${p.id}`} className="flex items-start gap-2">
                <span className="q-num mt-0.5">{c?.ok ? <Check size={12} strokeWidth={3} /> : ''}</span>
                <span className="flex-1">
                  <span className="q-text block font-medium">{p.label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-warm-400">
                    {p.help}
                  </span>
                </span>
              </label>

              <textarea
                id={`story-${p.id}`}
                className={cn('input mt-2.5', showProblem && '!border-red-400')}
                rows={3}
                value={text}
                onChange={(e) => patchStory({ prompts: { ...prompts, [p.id]: e.target.value } })}
                onBlur={() => setTouched((t) => ({ ...t, [p.id]: true }))}
                placeholder={p.example}
                aria-invalid={showProblem}
              />

              <div className="mt-1.5 flex items-start justify-between gap-3 text-[11.5px]">
                {showProblem && c?.message ? (
                  <span className="flex items-start gap-1 text-red-600">
                    <TriangleAlert size={13} className="mt-px flex-shrink-0" /> {c.message}
                  </span>
                ) : c?.ok ? (
                  <span className="text-brand-700">Nice. That tells a match something real.</span>
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-left text-warm-400 hover:text-brand-700"
                    onClick={() => patchStory({ prompts: { ...prompts, [p.id]: p.example } })}
                  >
                    <Lightbulb size={13} /> Use this example to start, then make it yours
                  </button>
                )}
                <span className={cn('flex-shrink-0 tabular-nums', words > MAX_WORDS_PER_ANSWER ? 'text-red-600' : 'text-warm-300')}>
                  {words} / {MAX_WORDS_PER_ANSWER} words{words < MIN_WORDS_PER_ANSWER && words > 0 ? ` · ${MIN_WORDS_PER_ANSWER} min` : ''}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {showExtra ? (
        <div className="mt-1">
          <label className="field-label" htmlFor="story-extra">
            Anything else you would like to add <span className="text-[11px] font-normal normal-case text-warm-300">optional</span>
          </label>
          <textarea
            id="story-extra"
            className="input"
            rows={4}
            value={extra}
            onChange={(e) => patchStory({ extra: e.target.value })}
            placeholder="Languages you speak, your background, what you are working towards…"
          />
          {assessment.extra && !assessment.extra.ok && assessment.extra.message && (
            <p className="mt-1 text-[11.5px] text-red-600">{assessment.extra.message}</p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setShowExtra(true)} className="mt-1 text-[12.5px] font-semibold text-brand-700 hover:underline">
          + Add anything else (optional)
        </button>
      )}
    </div>
  )
}
