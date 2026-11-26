'use client'

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/ui/Button'
import { FormAlert } from '@/components/auth/AuthForm'
import { AuthError, auth } from '@/services/auth'
import { addPasskey, passkeysSupported } from '@/services/passkeys'
import { useStore } from '@/store'

/**
 * The optional "add a passkey" suggestion, shown after signing in to members who have none.
 * A passkey is an extra layer, never required: "Not now" hides it for a week (the server remembers,
 * so it holds across devices). Test accounts and unsupported browsers are never asked.
 */
export function PasskeyPrompt() {
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!passkeysSupported()) return
    let cancelled = false
    auth
      .session()
      .then((s) => !cancelled && setOpen(Boolean(s.authenticated && s.security?.suggestPasskey)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function notNow() {
    setOpen(false)
    await auth.snoozePasskeyPrompt().catch(() => {})
  }

  async function add() {
    setBusy(true)
    setError('')
    try {
      await addPasskey()
      setOpen(false)
      toast('Passkey added. You can now sign in with it.', 'success')
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={notNow} showClose={false}>
      <div className="p-7 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <KeyRound size={26} />
        </div>
        <h2 className="font-serif text-[24px] text-warm-900">Add a passkey?</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-warm-600">
          An extra layer of security for your account. Use your fingerprint, face or screen lock to sign in, with no password and no emailed code. It is
          optional, and you can add or remove it any time from your profile.
        </p>
        {error && (
          <div className="mt-4 text-left">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
        <Button className="mt-6" onClick={add} disabled={busy}>
          {busy ? 'Waiting for your device…' : 'Add a passkey'}
        </Button>
        <button type="button" onClick={notNow} disabled={busy} className="mt-3 w-full py-2 text-[14px] font-semibold text-warm-500 transition hover:text-warm-800">
          Not now
        </button>
      </div>
    </Modal>
  )
}
