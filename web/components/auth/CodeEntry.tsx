'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormAlert } from '@/components/auth/AuthForm'

/**
 * Asks for the 6-digit code from an email. One input (so phone keyboards can fill it from the
 * message with one tap), digits only, submits itself when all six are in.
 */
export function CodeEntry({
  onSubmit,
  onResend,
  submitLabel = 'Continue →',
  busyLabel = 'Checking…',
}: {
  onSubmit: (code: string) => Promise<void>
  /** sends a new code; leave out to hide the button */
  onResend?: () => Promise<void>
  submitLabel?: string
  busyLabel?: string
}) {
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

  async function resend() {
    if (!onResend || wait > 0) return
    setError('')
    try {
      await onResend()
      setNote('A new code is on its way.')
      setWait(30)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a new code.')
    }
  }

  return (
    <div>
      <label htmlFor="code" className="field-label">
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
      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      {note && (
        <div className="mt-4">
          <FormAlert tone="info">{note}</FormAlert>
        </div>
      )}
      <Button className="mt-5" disabled={busy || code.length !== 6} onClick={() => submit()}>
        {busy ? busyLabel : submitLabel}
      </Button>
      {onResend && (
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0}
          className="mt-4 block w-full text-center text-[13.5px] font-semibold text-brand-700 disabled:text-warm-400"
        >
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
      )}
    </div>
  )
}
