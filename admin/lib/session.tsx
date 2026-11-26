'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, type Me, type Permission, type SessionState } from '@/lib/api'

interface Ctx {
  /** null while the first answer is on its way */
  session: SessionState | null
  /** the signed-in staff member, or null if this account is not on the team */
  me: Me | null
  refresh: () => Promise<SessionState | null>
  signOut: () => Promise<void>
  can: (p: Permission) => boolean
}

const SessionContext = createContext<Ctx | null>(null)

/** Who is signed in, and what their role allows. Loaded once and shared by every page. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await api<SessionState>('/auth/session')
      setSession(s)
      if (s.authenticated && s.user?.role === 'admin') {
        try {
          setMe(await api<Me>('/admin/me'))
        } catch {
          setMe(null)
        }
      } else setMe(null)
      return s
    } catch {
      setSession({ authenticated: false })
      setMe(null)
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await api('/auth/logout', { body: {} }).catch(() => {})
    setSession({ authenticated: false })
    setMe(null)
  }, [])

  const can = useCallback((p: Permission) => Boolean(me?.permissions.includes(p)), [me])
  const value = useMemo(() => ({ session, me, refresh, signOut, can }), [session, me, refresh, signOut, can])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Ctx {
  const c = useContext(SessionContext)
  if (!c) throw new Error('useSession needs a SessionProvider')
  return c
}
