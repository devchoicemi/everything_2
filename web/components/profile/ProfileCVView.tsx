'use client'

import type { ReactNode, RefObject } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { CompatBar } from '@/components/ui/CompatBar'
import { ConnectReasonIcon } from '@/lib/connectReasonIcons'
import { cn } from '@/lib/utils'
import { normalizeLayout } from '@/lib/profile/layouts'
import type { ProfileCV, CVFact } from '@/lib/profile/cv'
import type { CategoryResult } from '@/lib/compat/types'
import type { ProfileLayout } from '@/types'

/**
 * A profile laid out like a CV, in one of four designs. Text only: there is never a photo,
 * just an initial. The sections are the same in every design; only the arrangement changes.
 */
export interface ProfileCVViewProps {
  cv: ProfileCV
  layout: ProfileLayout | string
  /** live overall compatibility % (other members only) */
  score?: number
  /** pass an array (even empty) to show the compatibility section; undefined hides it */
  categories?: CategoryResult[]
  showCompat?: boolean
  /** attached at the end of the content so the "I have read this" tracking works */
  sentinel?: RefObject<HTMLDivElement | null>
  footer?: ReactNode
  /** extra buttons in the header, e.g. "Request a re-date" */
  actions?: ReactNode
  /** smaller type and padding, for previews */
  compact?: boolean
}

interface Block {
  key: string
  title: string
  node: ReactNode
  /** which column a two-column design puts it in */
  side?: boolean
}

function buildBlocks(cv: ProfileCV, props: ProfileCVViewProps, tone: Tone): Block[] {
  const blocks: Block[] = []
  const prose = (text: string) => <p className={cn('max-w-prose whitespace-pre-line leading-relaxed', tone.prose)}>{text}</p>

  if (cv.summary) blocks.push({ key: 'summary', title: 'Profile', node: prose(cv.summary) })
  if (cv.about && cv.about.trim() !== cv.summary.trim())
    blocks.push({ key: 'about', title: cv.summary ? 'My story' : 'About me', node: prose(cv.about) })
  for (const [i, part] of cv.story.entries()) blocks.push({ key: `story-${i}`, title: part.title, node: prose(part.text) })
  if (cv.facts.length) blocks.push({ key: 'facts', title: 'At a glance', node: <Facts items={cv.facts} tone={tone} />, side: true })
  if (cv.lifestyle.length) blocks.push({ key: 'lifestyle', title: 'Lifestyle', node: <Chips items={cv.lifestyle} tone={tone} />, side: true })
  if (cv.interests.length) blocks.push({ key: 'interests', title: 'Interests', node: <Chips items={cv.interests} tone={tone} />, side: true })
  if (cv.values.length) blocks.push({ key: 'values', title: 'Values & life', node: <Facts items={cv.values} tone={tone} /> })
  if (cv.lookingFor.length)
    blocks.push({ key: 'looking', title: 'What matters to me in a partner', node: <Facts items={cv.lookingFor} tone={tone} /> })
  if (cv.datePrefs.length) blocks.push({ key: 'dates', title: 'First-date style', node: <Facts items={cv.datePrefs} tone={tone} />, side: true })
  if (props.showCompat)
    blocks.push({
      key: 'compat',
      title: 'Compatibility',
      node: <CompatBlock categories={props.categories} />,
    })
  if (cv.connect.length) blocks.push({ key: 'connect', title: 'Why you might connect', node: <ConnectList cv={cv} /> })
  if (cv.answers.length) blocks.push({ key: 'answers', title: 'Their answers', node: <Answers cv={cv} tone={tone} /> })
  return blocks
}

export function ProfileCVView(props: ProfileCVViewProps) {
  const layout = normalizeLayout(props.layout)
  const tone = TONES[layout]
  const blocks = buildBlocks(props.cv, props, tone)
  const common = { ...props, blocks, tone }
  switch (layout) {
    case 'sidebar':
      return <SidebarLayout {...common} />
    case 'colorblock':
      return <ColorBlockLayout {...common} />
    case 'bloom':
      return <BloomLayout {...common} />
    default:
      return <TimelineLayout {...common} />
  }
}

type LayoutProps = ProfileCVViewProps & { blocks: Block[]; tone: Tone }

/* ---------------------------------- tones ---------------------------------- */

interface Tone {
  prose: string
  label: string
  value: string
  chip: string
}

const TONES: Record<ProfileLayout, Tone> = {
  timeline: {
    prose: 'text-[14.5px] text-warm-700',
    label: 'text-warm-400',
    value: 'text-warm-900',
    chip: 'border-brand-100 bg-brand-50 text-brand-800',
  },
  sidebar: {
    prose: 'text-[14.5px] text-warm-700',
    label: 'text-warm-400',
    value: 'text-warm-900',
    chip: 'border-brand-100 bg-brand-50 text-brand-800',
  },
  colorblock: {
    prose: 'text-[14px] text-warm-700',
    label: 'text-warm-500',
    value: 'text-warm-900',
    chip: 'border-transparent bg-brand-100 text-brand-900',
  },
  bloom: {
    prose: 'font-serif !font-normal text-[15.5px] leading-[1.8] text-warm-800',
    label: 'text-rose-400',
    value: 'text-warm-900',
    chip: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

/* --------------------------------- pieces ---------------------------------- */

function Facts({ items, tone, onDark }: { items: CVFact[]; tone: Tone; onDark?: boolean }) {
  return (
    <dl className="space-y-1.5">
      {items.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-4 text-[13.5px]">
          <dt className={onDark ? 'text-white/60' : tone.label}>{f.label}</dt>
          <dd className={cn('text-right font-semibold', onDark ? 'text-white' : tone.value)}>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Chips({ items, tone, onDark }: { items: string[]; tone: Tone; onDark?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={cn(
            'rounded-full border px-3 py-1 text-[12.5px] font-medium',
            onDark ? 'border-white/20 bg-white/15 text-white' : tone.chip,
          )}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function CompatBlock({ categories }: { categories?: CategoryResult[] }) {
  if (categories === undefined) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-3 w-full animate-pulse-soft rounded-full bg-warm-100" />
        ))}
      </div>
    )
  }
  return (
    <div className="sm:grid sm:grid-cols-2 sm:gap-x-8">
      {categories.map((c) => (
        <CompatBar key={c.category} dim={{ d: c.label, p: c.percent }} />
      ))}
    </div>
  )
}

function ConnectList({ cv }: { cv: ProfileCV }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {cv.connect.map((h) => (
        <div key={h.t} className="flex items-start gap-3 rounded-xl bg-warm-50/80 p-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-xs">
            <ConnectReasonIcon kind={h.i} size={16} />
          </span>
          <span className="text-[13.5px] leading-snug text-warm-700">{h.t}</span>
        </div>
      ))}
    </div>
  )
}

function Answers({ cv, tone }: { cv: ProfileCV; tone: Tone }) {
  return (
    <div className="grid gap-x-8 sm:grid-cols-2">
      {cv.answers.map((a) => (
        <div key={a.q} className="border-b border-warm-100 py-3 last:border-none">
          <div className={cn('mb-0.5 text-[12px]', tone.label)}>{a.q}</div>
          <div className={cn('text-[14px] font-semibold', tone.value)}>{a.a}</div>
        </div>
      ))}
    </div>
  )
}

function ScoreMark({ score, onDark }: { score?: number; onDark?: boolean }) {
  if (score === undefined && !onDark) return null
  return (
    <div className="text-right">
      <div className={cn('font-serif-i text-[30px] leading-none', onDark ? 'text-white' : 'text-brand-700', score === undefined && 'animate-pulse-soft')}>
        {score === undefined ? '···' : `${score}%`}
      </div>
      <div className={cn('text-[11px]', onDark ? 'text-white/60' : 'text-warm-400')}>match</div>
    </div>
  )
}

function Sentinel({ sentinel }: { sentinel?: RefObject<HTMLDivElement | null> }) {
  return sentinel ? <div ref={sentinel} className="h-1" /> : null
}

/* ------------------------------- 1. timeline ------------------------------- */

function TimelineLayout({ cv, blocks, tone, score, sentinel, footer, actions, compact }: LayoutProps) {
  return (
    <article className="overflow-hidden rounded-3xl border border-warm-100 bg-white shadow-sm">
      <header className={cn('border-b border-warm-100 bg-[linear-gradient(155deg,var(--t0),transparent_70%)]', compact ? 'px-5 py-5' : 'px-6 py-7 sm:px-9')}>
        <div className="flex items-start gap-4">
          <span className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full border-[3px] border-brand-600 bg-white font-serif-i text-[30px] text-brand-700">
            {cv.initial}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[26px] font-extrabold uppercase tracking-wide text-brand-800 sm:text-[30px]">{cv.username}</h2>
            {cv.headline && <p className="mt-1 text-[14px] italic text-warm-600">{cv.headline}</p>}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {cv.verified && (
                <Badge tone="verified">
                  <ShieldCheck size={12} /> ID verified
                </Badge>
              )}
            </div>
          </div>
          <ScoreMark score={score} />
        </div>
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </header>

      <div className={cn(compact ? 'px-5 py-5' : 'px-6 py-7 sm:px-9')}>
        <ol className="relative ml-2.5 border-l-2 border-brand-200">
          {blocks.map((b) => (
            <li key={b.key} className="relative pb-7 pl-7 last:pb-0">
              <span className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-[3px] border-brand-600 bg-white" />
              <h3 className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand-700">{b.title}</h3>
              {b.node}
            </li>
          ))}
        </ol>
        <Sentinel sentinel={sentinel} />
      </div>
      {footer}
    </article>
  )
}

/* ------------------------------- 2. sidebar -------------------------------- */

function SidebarLayout({ cv, blocks, tone, score, sentinel, footer, actions, compact }: LayoutProps) {
  const side = blocks.filter((b) => b.side && b.key !== 'interests')
  const main = blocks.filter((b) => !side.includes(b))
  return (
    <article className="overflow-hidden rounded-3xl border border-warm-100 bg-white shadow-sm">
      <div className="grid md:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="bg-brand-sheen p-6 text-white md:p-7">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white/30 bg-white/10 font-serif-i text-[28px]">
            {cv.initial}
          </span>
          <h2 className="mt-4 text-[24px] font-extrabold tracking-wide">{cv.username}</h2>
          {cv.headline && <p className="mt-1 text-[13px] italic text-white/75">{cv.headline}</p>}
          {cv.verified && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold">
              <ShieldCheck size={12} /> ID verified
            </span>
          )}
          {score !== undefined && (
            <div className="mt-5">
              <ScoreMark score={score} onDark />
            </div>
          )}
          <div className="mt-6 space-y-5">
            {side.map((b) => (
              <div key={b.key}>
                <h3 className="mb-2 border-b border-white/20 pb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{b.title}</h3>
                {b.key === 'facts' && <Facts items={cv.facts} tone={tone} onDark />}
                {b.key === 'lifestyle' && <Chips items={cv.lifestyle} tone={tone} onDark />}
                {b.key === 'dates' && <Facts items={cv.datePrefs} tone={tone} onDark />}
              </div>
            ))}
          </div>
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
        </aside>

        <div className={cn(compact ? 'p-5' : 'p-6 sm:p-8')}>
          <div className="space-y-7">
            {main.map((b) => (
              <section key={b.key}>
                <h3 className="mb-2.5 border-b border-warm-200 pb-1.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-warm-800">{b.title}</h3>
                {b.node}
              </section>
            ))}
          </div>
          <Sentinel sentinel={sentinel} />
        </div>
      </div>
      {footer}
    </article>
  )
}

/* ------------------------------ 3. colour block ----------------------------- */

function ColorBlockLayout({ cv, blocks, tone, score, sentinel, footer, actions, compact }: LayoutProps) {
  const left = blocks.filter((b) => !b.side)
  const right = blocks.filter((b) => b.side)
  const Bar = ({ title, dark }: { title: string; dark?: boolean }) => (
    <div className={cn('px-5 py-2 text-[13px] font-bold uppercase tracking-[0.12em] text-white', dark ? 'bg-warm-800' : 'bg-brand-600')}>{title}</div>
  )
  return (
    <article className="overflow-hidden rounded-3xl border border-warm-100 bg-white shadow-sm">
      <div className="grid sm:grid-cols-[1.35fr_1fr]">
        <div className={cn('bg-warm-900 text-white', compact ? 'p-5' : 'p-6 sm:p-8')}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">{cv.initial} · member</div>
          <h2 className="mt-2 text-[30px] font-extrabold uppercase leading-tight tracking-wide">{cv.username}</h2>
          {cv.verified && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">
              <ShieldCheck size={12} /> ID verified
            </span>
          )}
        </div>
        <div className={cn('flex flex-col justify-between bg-brand-600 text-white', compact ? 'p-5' : 'p-6 sm:p-8')}>
          <p className="text-[14px] font-medium leading-snug">{cv.headline || 'A member of ChoiceMi'}</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">{actions}</div>
            {score !== undefined && <ScoreMark score={score} onDark />}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-[1.35fr_1fr]">
        <div>
          {left.map((b) => (
            <section key={b.key}>
              <Bar title={b.title} />
              <div className={cn(compact ? 'px-5 py-4' : 'px-6 py-5 sm:px-8')}>{b.node}</div>
            </section>
          ))}
        </div>
        <div className="bg-warm-50/70">
          {right.map((b) => (
            <section key={b.key}>
              <Bar title={b.title} dark />
              <div className={cn(compact ? 'px-5 py-4' : 'px-6 py-5')}>{b.node}</div>
            </section>
          ))}
        </div>
      </div>
      <div className="px-6 sm:px-8">
        <Sentinel sentinel={sentinel} />
      </div>
      {footer}
    </article>
  )
}

/* ---------------------------------- 4. bloom ---------------------------------- */

function Blossom({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 70" className={className} aria-hidden="true">
      <g fill="none" stroke="#f9a8c4" strokeWidth="1.4" strokeLinecap="round">
        <path d="M6 58 C28 52 40 40 56 36" />
        <path d="M114 58 C92 52 80 40 64 36" />
        <path d="M22 54 c-4-8 0-14 6-16 M32 48 c-3-7 1-12 7-13 M98 54 c4-8 0-14-6-16 M88 48 c3-7-1-12-7-13" />
      </g>
      <g transform="translate(60 28)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} rx="6" ry="11" cy="-9" fill="#fda4af" opacity="0.85" transform={`rotate(${r})`} />
        ))}
        <circle r="5" fill="#fb7185" />
        <circle r="2" fill="#fff1f2" />
      </g>
    </svg>
  )
}

function BloomLayout({ cv, blocks, tone, score, sentinel, footer, actions, compact }: LayoutProps) {
  const side = blocks.filter((b) => b.side)
  const main = blocks.filter((b) => !b.side)
  const Head = ({ children }: { children: ReactNode }) => (
    <h3 className="mb-2.5 border-b border-rose-200 pb-1 font-serif text-[15px] font-bold italic tracking-wide text-rose-600">{children}</h3>
  )
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-rose-200 bg-[#fff8fa] shadow-sm">
      <header className={cn('relative text-center', compact ? 'px-5 pb-4 pt-5' : 'px-6 pb-6 pt-8 sm:px-10')}>
        <Blossom className="mx-auto h-16 w-28" />
        <h2 className="font-serif-i mt-1 text-[30px] text-rose-700 sm:text-[34px]">{cv.username}</h2>
        {cv.headline && <p className="font-serif mx-auto mt-1 max-w-[40ch] text-[15px] italic text-warm-600">{cv.headline}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {cv.verified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600">
              <ShieldCheck size={12} /> ID verified
            </span>
          )}
          {score !== undefined && <span className="rounded-full bg-rose-500 px-3 py-1 text-[12px] font-bold text-white">{score}% match</span>}
        </div>
        {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
      </header>

      <div className={cn('border-t border-rose-100', compact ? 'p-5' : 'p-6 sm:p-9')}>
        <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            {main.map((b) => (
              <section key={b.key}>
                <Head>{b.title}</Head>
                {b.node}
              </section>
            ))}
          </div>
          <div className="space-y-6 rounded-2xl bg-white/70 p-5 sm:self-start">
            {side.map((b) => (
              <section key={b.key}>
                <Head>{b.title}</Head>
                {b.node}
              </section>
            ))}
          </div>
        </div>
        <Sentinel sentinel={sentinel} />
      </div>
      {footer}
    </article>
  )
}
