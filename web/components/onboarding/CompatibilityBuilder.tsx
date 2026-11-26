'use client'

import { useState } from 'react'
import { Check, ChevronDown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FIT_CATEGORIES, VARIABLE_CATALOG } from '@/lib/compat/config'
import {
  dealbreakerCountInCategory,
  draftProgress,
  isVariableComplete,
} from '@/lib/compat/onboardingDraft'
import { useStore } from '@/store'
import { FIT_HIGH, FIT_LOW, IMPORTANCE_HIGH, IMPORTANCE_LOW, fitWord, importanceWord } from '@/lib/compat/scale'
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM, bucketLabel } from '@/lib/compat/format'
import type { VariableConfig } from '@/lib/compat/types'

const MAX_DEALBREAKERS_PER_CATEGORY = 2

export function CompatibilityBuilder() {
  const [activeCategory, setActiveCategory] = useState(FIT_CATEGORIES[0].id)
  const [openField, setOpenField] = useState<string | null>(VARIABLE_CATALOG[0].field)
  const draft = useStore((s) => s.compatDraft)
  const patchVariable = useStore((s) => s.patchCompatVariable)

  const progress = draftProgress(draft)
  const variablesInCategory = VARIABLE_CATALOG.filter((v) => v.category === activeCategory)

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[var(--bdr-lt)] bg-[var(--card)] px-3.5 py-2.5">
        <div>
          <div className="font-serif-i text-[22px] not-italic font-bold text-brand-600">
            {progress.complete}/{progress.total}
          </div>
          <div className="mt-px text-[12px] text-warm-500">variables complete</div>
        </div>
        <p className="max-w-[190px] text-right text-[11px] leading-snug text-warm-400">
          Rate every option. This is what your match score is built from.
        </p>
      </div>

      <div className="mb-3.5 rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-brand-900">
        <div className="mb-1 font-semibold">How the sliders work</div>
        <div>
          <strong>How much would you want it?</strong> <span className="font-semibold">0% = {FIT_LOW}</span> (you would rather not),{' '}
          <span className="font-semibold">100% = {FIT_HIGH}</span> (exactly what you are hoping for).
        </div>
        <div className="mt-1">
          <strong>How much does it matter?</strong> From <span className="font-semibold">{IMPORTANCE_LOW}</span> to{' '}
          <span className="font-semibold">{IMPORTANCE_HIGH}</span>.
        </div>
      </div>

      <div className="no-scrollbar mb-3.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {FIT_CATEGORIES.map((c) => {
          const catComplete = VARIABLE_CATALOG.filter((v) => v.category === c.id).every((v) =>
            isVariableComplete(v, draft[v.field]),
          )
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] font-semibold transition-all active:scale-90',
                activeCategory === c.id
                  ? 'border-transparent bg-brand-cta text-white'
                  : 'border-[var(--bdr)] bg-[var(--card)] text-warm-500',
              )}
            >
              {catComplete && <Check size={12} strokeWidth={3} />}
              {c.label}
            </button>
          )
        })}
      </div>

      <div>
        {variablesInCategory.map((config) => {
          const variable = draft[config.field]
          const complete = isVariableComplete(config, variable)
          const open = openField === config.field
          const dbCount = dealbreakerCountInCategory(draft, config.category)
          const dbDisabled = !variable.dealbreaker && dbCount >= MAX_DEALBREAKERS_PER_CATEGORY

          return (
            <div key={config.field} className={cn('q-card', complete && 'done')}>
              <button
                type="button"
                className="q-card-hd w-full text-left transition active:scale-[0.99]"
                onClick={() => setOpenField(open ? null : config.field)}
              >
                <span className="q-num">{complete ? <Check size={12} strokeWidth={3} /> : ''}</span>
                <span className="flex-1">
                  <span className="q-text block font-medium">{config.label}</span>
                  {!complete && <span className="text-[11px] text-warm-400">Not rated yet</span>}
                  {complete && variable.dealbreaker && (
                    <span className="q-picked !mt-1">Dealbreaker</span>
                  )}
                </span>
                <ChevronDown size={16} className={cn('mt-1 flex-shrink-0 text-warm-400 transition-transform', open && 'rotate-180')} />
              </button>

              {open && (
                <div className="border-t border-[var(--bdr-lt)] px-3.5 pb-4 pt-3">
                  <SelfPicker config={config} self={variable.self} onChange={(self) => patchVariable(config.field, { self })} />
                  <IdealRater config={config} ideal={variable.ideal} onChange={(ideal) => patchVariable(config.field, { ideal })} />

                  <div className="mt-5">
                    <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-warm-500">How much does this matter to you?</div>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="font-medium text-warm-700">{config.label}</span>
                      <span className="font-bold text-brand-700">
                        {variable.weight}% · {importanceWord(variable.weight)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={variable.weight}
                      onChange={(e) => patchVariable(config.field, { weight: Number(e.target.value) })}
                      className="w-full accent-brand-700"
                      aria-label={`How much ${config.label} matters to you`}
                      aria-valuetext={`${variable.weight}%, ${importanceWord(variable.weight)}`}
                    />
                    <div className="flex justify-between text-[10.5px] text-warm-400">
                      <span>{IMPORTANCE_LOW}</span>
                      <span>{IMPORTANCE_HIGH}</span>
                    </div>
                  </div>

                  <label
                    className={cn(
                      'mt-4 flex items-center justify-between rounded-xl border border-[var(--bdr-lt)] bg-[var(--w05)] px-3.5 py-3',
                      dbDisabled && 'opacity-50',
                    )}
                  >
                    <span className="flex items-center gap-2 text-[13px] font-medium text-warm-700">
                      {dbDisabled && <Lock size={13} className="text-warm-400" />}
                      Mark as a dealbreaker
                      <span className="text-[11px] font-normal text-warm-400">(counts double, up to 2 per group)</span>
                    </span>
                    <button
                      type="button"
                      disabled={dbDisabled}
                      onClick={() => !dbDisabled && patchVariable(config.field, { dealbreaker: !variable.dealbreaker })}
                      className={cn('toggle', variable.dealbreaker && 'on')}
                      aria-pressed={variable.dealbreaker}
                    >
                      <span className="tthumb" />
                    </button>
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SelfPicker({
  config,
  self,
  onChange,
}: {
  config: VariableConfig
  self: unknown
  onChange: (v: string | number | string[]) => void
}) {
  if (config.shape === 'SMALL_SET') {
    const options = config.options as { key: string; label: string }[]
    return (
      <div className="mb-4">
        <div className="field-label">You</div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={cn('chip sm', self === o.key && 'on')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (config.shape === 'BUCKETED_CONTINUOUS') {
    const isHeight = config.field === 'height'
    const value = typeof self === 'number' ? self : ''
    return (
      <div className="mb-4">
        <div className="field-label">{isHeight ? 'Your height (cm)' : 'Your age'}</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            className="input max-w-[140px]"
            value={value}
            min={isHeight ? HEIGHT_MIN_CM : 18}
            max={isHeight ? HEIGHT_MAX_CM : 90}
            onChange={(e) => {
              if (e.target.value === '') return
              onChange(Number(e.target.value))
            }}
            placeholder={isHeight ? 'e.g. 172' : 'e.g. 28'}
          />
          {isHeight && <span className="text-[13px] font-semibold text-warm-500">cm</span>}
        </div>
        {typeof self === 'number' && bucketLabel(config, self) && (
          <div className="mt-1 text-[11px] text-warm-400">You are in the {bucketLabel(config, self)} group.</div>
        )}
      </div>
    )
  }

  // MULTI_SELECT
  const universe = config.tagUniverse ?? []
  const selfSet = Array.isArray(self) ? (self as string[]) : []
  return (
    <div className="mb-4">
      <div className="field-label">You: pick what applies</div>
      <div className="flex flex-wrap gap-1.5">
        {universe.map((tag) => {
          const on = selfSet.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(on ? selfSet.filter((t) => t !== tag) : [...selfSet, tag])}
              className={cn('chip sm', on && 'on')}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function IdealRater({
  config,
  ideal,
  onChange,
}: {
  config: VariableConfig
  ideal: unknown
  onChange: (v: Record<string, number> | string[]) => void
}) {
  if (config.shape === 'MULTI_SELECT') {
    const universe = config.tagUniverse ?? []
    const idealSet = Array.isArray(ideal) ? (ideal as string[]) : []
    return (
      <div>
        <div className="field-label">Ideal partner: pick what you'd want</div>
        <div className="flex flex-wrap gap-1.5">
          {universe.map((tag) => {
            const on = idealSet.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onChange(on ? idealSet.filter((t) => t !== tag) : [...idealSet, tag])}
                className={cn('chip sm brand', on && 'on')}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const options = config.options as { key: string; label: string }[]
  const ratings = (ideal as Record<string, number>) ?? {}

  return (
    <div>
      <div className="field-label">How much would you want a partner who is…</div>
      <p className="-mt-1 mb-3 text-[11.5px] leading-snug text-warm-500">
        Slide to rate each option. 0% means {FIT_LOW.toLowerCase()}, 100% means {FIT_HIGH.toLowerCase()}.
      </p>
      <div className="space-y-3">
        {options.map((o) => {
          const rated = typeof ratings[o.key] === 'number'
          const value = rated ? ratings[o.key] : 50
          return (
            <div key={o.key}>
              <div className="mb-1 flex items-center justify-between text-[12.5px]">
                <span className={cn('font-medium', rated ? 'text-warm-800' : 'text-warm-400')}>{o.label}</span>
                <span className={cn('font-bold', rated ? 'text-brand-700' : 'text-warm-300')}>
                  {rated ? `${value}% · ${fitWord(value)}` : 'Not rated'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => onChange({ ...ratings, [o.key]: Number(e.target.value) })}
                className={cn('w-full', rated ? 'accent-brand-700' : 'accent-warm-200 opacity-60')}
                aria-label={`How much you would want a partner who is ${o.label}`}
                aria-valuetext={`${value}%, ${fitWord(value)}`}
              />
              <div className="flex justify-between text-[10.5px] text-warm-400">
                <span>{FIT_LOW}</span>
                <span>{FIT_HIGH}</span>
              </div>
              {!rated && <p className="mt-0.5 text-[10.5px] text-warm-400">Drag to rate; it starts unrated</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
