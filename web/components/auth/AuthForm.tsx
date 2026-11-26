'use client'

import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export const AuthField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
>(function AuthField({ label, error, hint, className, type, ...props }, ref) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={isPassword && show ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn('input', isPassword && 'pr-12', error && '!border-red-400', className)}
          // Phone keyboards otherwise capitalise the first letter, "correct" words, or add a trailing space.
          autoCapitalize={type === 'email' || isPassword ? 'none' : undefined}
          autoCorrect={type === 'email' || isPassword ? 'off' : undefined}
          spellCheck={type === 'email' || isPassword ? false : undefined}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-warm-400 hover:text-brand-700"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-[12.5px] font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-warm-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
)

export function AuthCheck({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-snug text-warm-600">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-[#8140f0]"
        />
        <span>{children}</span>
      </label>
      {error && <p className="mt-1.5 pl-[30px] text-[12.5px] font-medium text-red-600">{error}</p>}
    </div>
  )
}

export function FormAlert({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'info' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-2xl border px-4 py-3 text-[13.5px] leading-snug',
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-brand-100 bg-brand-50/70 text-brand-800',
      )}
    >
      {children}
    </div>
  )
}

/** Safe `?next=` destination: same-site paths only. */
export function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null
}
