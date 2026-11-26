'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthError, auth, type PasskeyInfo } from '@/services/auth'
import { addPasskey, passkeysSupported } from '@/services/passkeys'
import { useStore } from '@/store'

/**
 * Sign-in security for the signed-in member: the emailed code is on for everyone with a real email,
 * and passkeys can be added or removed here. Test accounts (made-up emails) never see this.
 */
export function SecurityCard() {
  const toast = useStore((s) => s.toast)
  const [hidden, setHidden] = useState(true)
  const [loginCode, setLoginCode] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [busy, setBusy] = useState(false)
  const supported = passkeysSupported()

  const load = useCallback(async () => {
    try {
      const s = await auth.session()
      if (!s.authenticated || s.security?.exempt || process.env.NEXT_PUBLIC_STANDALONE === '1') return
      setLoginCode(Boolean(s.security?.loginCode))
      setPasskeys((await auth.passkeys()).passkeys)
      setHidden(false)
    } catch {
      // not signed in, or offline: nothing to show
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (hidden) return null

  async function add() {
    setBusy(true)
    try {
      await addPasskey()
      toast('Passkey added', 'success')
      await load()
    } catch (e) {
      toast(e instanceof AuthError ? e.message : 'Could not add a passkey.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: PasskeyInfo) {
    if (!window.confirm(`Remove the passkey "${p.name}"? You can still sign in with your password${loginCode ? ' and an emailed code' : ''}.`)) return
    try {
      await auth.removePasskey(p.id)
      toast('Passkey removed')
      await load()
    } catch (e) {
      toast(e instanceof AuthError ? e.message : 'Could not remove it.', 'danger')
    }
  }

  return (
    <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={16} className="text-brand-700" />
        <span className="sec-lbl !mb-0">Sign-in security</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-warm-500">
        {loginCode
          ? 'When you sign in with your password we email you a 6-digit code to finish. A passkey skips both.'
          : 'Sign in with your password, or add a passkey to use your fingerprint, face or screen lock.'}
      </p>

      {passkeys.length > 0 && (
        <ul className="mt-3 divide-y divide-warm-100 rounded-xl border border-warm-100">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <KeyRound size={16} className="flex-shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-warm-900">{p.name}</div>
                <div className="text-[11.5px] text-warm-400">
                  Added {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {p.lastUsedAt ? ` · used ${new Date(p.lastUsedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ' · not used yet'}
                </div>
              </div>
              <button type="button" onClick={() => remove(p)} aria-label={`Remove ${p.name}`} className="rounded-md p-1.5 text-warm-400 transition hover:text-danger">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {supported ? (
        <Button className="mt-4" variant="secondary" size="sm" onClick={add} disabled={busy}>
          <KeyRound size={15} /> {busy ? 'Waiting for your device…' : passkeys.length ? 'Add another passkey' : 'Add a passkey'}
        </Button>
      ) : (
        <p className="mt-3 text-[12px] text-warm-400">This browser cannot make passkeys. Use your phone or a recent browser to add one.</p>
      )}
    </div>
  )
}
