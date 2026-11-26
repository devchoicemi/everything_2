'use client'

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(...a))

export function Logo({ tone = 'light', height = 34, label = true }: { tone?: 'light' | 'dark'; height?: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src={tone === 'dark' ? '/brand/logo-on-dark.webp' : '/brand/logo-on-light.webp'} alt="ChoiceMi" style={{ height }} />
      {label && (
        <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em]', tone === 'dark' ? 'border-white/25 text-white/80' : 'border-ink-200 text-ink-600')}>
          for restaurants
        </span>
      )}
    </span>
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ink' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', block && 'w-full', className)} {...props} />
}

export function ButtonLink({ href, variant = 'primary', size = 'md', className, children }: { href: string; variant?: ButtonProps['variant']; size?: ButtonProps['size']; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)}>
      {children}
    </Link>
  )
}

export const Field = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }>(function Field(
  { label, error, hint, type, className, ...props },
  ref,
) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={isPassword && show ? 'text' : type}
          aria-invalid={Boolean(error)}
          className={cn('input', isPassword && 'pr-12', error && '!border-danger', className)}
          autoCapitalize={type === 'email' || isPassword ? 'none' : undefined}
          autoCorrect={type === 'email' || isPassword ? 'off' : undefined}
          spellCheck={type === 'email' || isPassword ? false : undefined}
          {...props}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:text-brand-700">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? <p className="mt-1.5 text-[12.5px] font-medium text-danger">{error}</p> : hint ? <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p> : null}
    </div>
  )
})

export function TextArea({ label, error, hint, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea id={id} className={cn('input min-h-[110px] resize-y', error && '!border-danger', className)} {...props} />
      {error ? <p className="mt-1.5 text-[12.5px] font-medium text-danger">{error}</p> : hint ? <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p> : null}
    </div>
  )
}

export function Alert({ tone = 'error', children, className }: { tone?: 'error' | 'info' | 'success' | 'warn'; children: React.ReactNode; className?: string }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug',
        tone === 'error' && 'bg-danger-50 text-danger',
        tone === 'info' && 'bg-brand-50 text-brand-800',
        tone === 'success' && 'bg-ok-50 text-ok-600',
        tone === 'warn' && 'bg-saffron-50 text-saffron-600',
        className,
      )}
    >
      <Icon size={17} className="mt-px flex-shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'brand' | 'danger'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
        tone === 'neutral' && 'bg-ink-100 text-ink-600',
        tone === 'ok' && 'bg-ok-50 text-ok-600',
        tone === 'warn' && 'bg-saffron-100 text-saffron-600',
        tone === 'brand' && 'bg-brand-100 text-brand-800',
        tone === 'danger' && 'bg-danger-50 text-danger',
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <p className="py-10 text-center text-[14px] text-ink-500">{label}</p>
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink-900">{title}</h1>
        {sub && <p className="mt-1 text-[14.5px] text-ink-500">{sub}</p>}
      </div>
      {actions}
    </div>
  )
}

/** A switch-like toggle chip, used for days and times. */
export function Toggle({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn('rounded-full border px-4 py-2 text-[13.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300')}
    >
      {children}
    </button>
  )
}

/** The 6-digit code from an email. One input, digits only, sends itself when complete. */
export function CodeEntry({ onSubmit, onResend, submitLabel = 'Continue', busyLabel = 'Checking…' }: { onSubmit: (code: string) => Promise<void>; onResend?: () => Promise<void>; submitLabel?: string; busyLabel?: string }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [wait, setWait] = useState(30)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function submit(value = code) {
    if (busy || value.length !== 6) return
    setBusy(true)
    setError('')
    setNote('')
    try {
      await onSubmit(value)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setCode('')
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <div>
      <label htmlFor="code" className="label">
        6-digit code
      </label>
      <input
        id="code"
        ref={input}
        className="input text-center font-mono text-[26px] tracking-[0.5em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        placeholder="······"
        value={code}
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6)
          setCode(v)
          if (v.length === 6) void submit(v)
        }}
      />
      {error && <Alert className="mt-4">{error}</Alert>}
      {note && (
        <Alert tone="info" className="mt-4">
          {note}
        </Alert>
      )}
      <Button className="mt-5" block disabled={busy || code.length !== 6} onClick={() => submit()}>
        {busy ? busyLabel : submitLabel}
      </Button>
      {onResend && (
        <button
          type="button"
          disabled={wait > 0}
          onClick={async () => {
            setError('')
            try {
              await onResend()
              setNote('A new code is on its way.')
              setWait(30)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not send a new code.')
            }
          }}
          className="mt-4 block w-full text-center text-[13.5px] font-semibold text-brand-700 disabled:text-ink-400"
        >
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
      )}
    </div>
  )
}
