'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, messageOf, type Onboarding } from '@/lib/api'
import { useSession } from '@/lib/session'

interface Ctx {
  ob: Onboarding | null
  error: string
  reload: () => Promise<void>
  /** Runs a save that returns the fresh onboarding view, and keeps it. */
  save: (fn: () => Promise<Onboarding>) => Promise<boolean>
  saving: boolean
  saveError: string
  clearError: () => void
}

const C = createContext<Ctx | null>(null)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { me, reloadMe } = useSession()
  const [ob, setOb] = useState<Onboarding | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const ready = Boolean(me)

  const reload = useCallback(async () => {
    try {
      setOb(await api<Onboarding>('/partner/onboarding'))
      setError('')
    } catch (e) {
      setError(messageOf(e))
    }
  }, [])

  useEffect(() => {
    if (ready) void reload()
  }, [ready, reload])

  const save = useCallback(
    async (fn: () => Promise<Onboarding>) => {
      setSaving(true)
      setSaveError('')
      try {
        setOb(await fn())
        void reloadMe()
        return true
      } catch (e) {
        setSaveError(messageOf(e))
        return false
      } finally {
        setSaving(false)
      }
    },
    [reloadMe],
  )

  const value = useMemo(() => ({ ob, error, reload, save, saving, saveError, clearError: () => setSaveError('') }), [ob, error, reload, save, saving, saveError])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useOnboarding(): Ctx {
  const c = useContext(C)
  if (!c) throw new Error('useOnboarding needs an OnboardingProvider')
  return c
}

/** Which of the four steps are finished, from the server's checklist. */
export function stepsDone(ob: Onboarding | null): [boolean, boolean, boolean, boolean] {
  const done = (...keys: string[]) => Boolean(ob) && keys.every((k) => ob!.checklist.find((c) => c.key === k)?.done)
  return [done('name', 'business_id', 'location', 'contact_person', 'contact_email', 'booking_phone'), done('hours', 'slots'), done('photos'), done('terms')]
}
