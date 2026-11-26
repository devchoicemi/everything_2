'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api, messageOf } from '@/lib/api'
import { Alert, Badge, cn } from '@/components/ui'

/** Loads a GET endpoint and reloads when the path changes. `path` null means "not yet". */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(path))
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!path) return
    const mine = ++seq.current
    setLoading(true)
    try {
      const d = await api<T>(path)
      if (mine === seq.current) {
        setData(d)
        setError('')
      }
    } catch (e) {
      if (mine === seq.current) setError(messageOf(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, loading, reload: load, setData }
}

export const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
export const dateOnly = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export function ago(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 90) return 'just now'
  const m = Math.round(s / 60)
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: 'warn' | 'danger' | 'ok' }) {
  const inner = (
    <div className={cn('card h-full p-5 transition', href && 'hover:border-brand-300 hover:shadow-lift')}>
      <div className="text-[12.5px] font-semibold text-ink-500">{label}</div>
      <div className={cn('mt-1.5 text-[32px] font-extrabold leading-none tracking-tight', tone === 'danger' && Number(value) > 0 && 'text-danger', tone === 'warn' && Number(value) > 0 && 'text-saffron-600', tone === 'ok' && 'text-ok-600')}>{value}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export function Section({ title, sub, actions, children, className }: { title?: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card p-5 sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[16.5px] font-extrabold tracking-tight text-ink-900">{title}</h2>}
            {sub && <p className="mt-0.5 text-[13px] text-ink-500">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children
  const none = Array.isArray(rows) ? rows.length === 0 : !rows
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-ink-200 text-[11.5px] font-bold uppercase tracking-wider text-ink-500">
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{none ? null : children}</tbody>
      </table>
      {none && <p className="px-3 py-8 text-center text-[13.5px] text-ink-400">{empty ?? 'Nothing here.'}</p>}
    </div>
  )
}

export const Tr = ({ href, children, tone }: { href?: string; children: React.ReactNode; tone?: 'warn' | 'danger' }) => (
  <tr className={cn('border-b border-ink-100 align-top transition last:border-0', href && 'cursor-pointer hover:bg-brand-50/60', tone === 'danger' && 'bg-danger-50/50', tone === 'warn' && 'bg-saffron-50/70')}>{children}</tr>
)
export const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={cn('px-3 py-3', className)}>{children}</td>

/** A cell whose whole row opens a page. */
export const RowLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="block font-semibold text-ink-900 hover:text-brand-700">
    {children}
  </Link>
)

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} aria-pressed={value === t.id} className={cn('rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition', value === t.id ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300')}>
          {t.label}
          {t.count !== undefined && <span className={cn('ml-1.5 text-[12px]', value === t.id ? 'text-white/70' : 'text-ink-400')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

const TONES: Record<string, 'neutral' | 'ok' | 'warn' | 'brand' | 'danger'> = {
  open: 'brand',
  waiting_customer: 'warn',
  resolved: 'ok',
  closed: 'neutral',
  proposed: 'neutral',
  picked: 'neutral',
  requested: 'warn',
  confirmed: 'brand',
  partially_checked_in: 'brand',
  in_progress: 'ok',
  ended: 'ok',
  declined: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
  no_show: 'danger',
  submitted: 'warn',
  sent_back: 'danger',
  approved: 'ok',
  draft: 'neutral',
  active: 'ok',
  suspended: 'danger',
  paused: 'warn',
  pending: 'warn',
  urgent: 'danger',
  high: 'warn',
  normal: 'neutral',
  low: 'neutral',
  rejected: 'danger',
  revoked: 'danger',
}

export const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function Pill({ value, text }: { value: string; text?: string }) {
  return <Badge tone={TONES[value] ?? 'neutral'}>{text ?? label(value)}</Badge>
}

export function LoadState({ loading, error, children }: { loading: boolean; error: string; children: React.ReactNode }) {
  if (error) return <Alert>{error}</Alert>
  if (loading) return <p className="py-10 text-center text-[14px] text-ink-500">Loading…</p>
  return <>{children}</>
}

/** Runs an action, shows what went wrong, and reloads when it works. */
export function useAction(after?: () => void | Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true)
      setError('')
      try {
        await fn()
        await after?.()
        return true
      } catch (e) {
        setError(messageOf(e))
        return false
      } finally {
        setBusy(false)
      }
    },
    [after],
  )
  return { busy, error, run, setError }
}
