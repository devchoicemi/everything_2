'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, type Me, type SessionState } from '@/lib/api'

interface Ctx {
  /** null while the first answer is on its way */
  session: SessionState | null
  me: Me | null
  refresh: () => Promise<SessionState | null>
  reloadMe: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<Ctx | null>(null)

/** Who is signed in, and (for venue staff) which venue they manage. Loaded once and shared by every page. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  const reloadMe = useCallback(async () => {
    try {
      setMe(await api<Me>('/partner/me'))
    } catch {
      setMe(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const s = await api<SessionState>('/auth/session')
      setSession(s)
      if (s.authenticated && s.user?.role === 'partner' && s.user.emailVerified) await reloadMe()
      else setMe(null)
      return s
    } catch {
      setSession({ authenticated: false })
      setMe(null)
      return null
    }
  }, [reloadMe])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await api('/auth/logout', { body: {} }).catch(() => {})
    setSession({ authenticated: false })
    setMe(null)
  }, [])

  const value = useMemo(() => ({ session, me, refresh, reloadMe, signOut }), [session, me, refresh, reloadMe, signOut])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Ctx {
  const c = useContext(SessionContext)
  if (!c) throw new Error('useSession needs a SessionProvider')
  return c
}
