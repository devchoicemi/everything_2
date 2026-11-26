'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, type SessionState } from '@/services/auth'
import { LIVE } from '@/lib/live'
import { profileApi } from '@/services/profile'
import { membersApi } from '@/services/members'
import { matchToMatch } from '@/services/social'
import { useStore } from '@/store'

let hydratedFor: string | null = null

/**
 * Brings the signed-in member's saved profile onto this device, once per sign-in. If the draft on
 * this device belongs to someone else it is wiped first, so a shared computer never shows
 * another member's answers.
 */
async function hydrateProfile(userId: string): Promise<void> {
  if (hydratedFor === userId) return
  hydratedFor = userId
  const store = useStore.getState()
  if (store.profileOwner && store.profileOwner !== userId) store.clearLocalProfile()
  useStore.getState().setProfileOwner(userId)
  try {
    const remote = await profileApi.get()
    if (Object.keys(remote.data ?? {}).length > 0) useStore.getState().hydrateProfile(remote.data)
  } catch {
    // Offline or not saved yet: carry on with what is on this device.
    hydratedFor = null
  }
}

/** The counts on the navigation need my matches; fetch them quietly once I am signed in and set up. */
async function loadSocial(): Promise<void> {
  if (!LIVE) return
  try {
    const m = await membersApi.matches()
    useStore.getState().setMatches(m.matches.map(matchToMatch))
  } catch {
    // Not open to this account yet (before launch) or offline: the screens load their own when opened.
  }
}

/** Loads the current session from the server once, and keeps the store's `authed` flag in step. */
export function useSession() {
  const setAuthed = useStore((s) => s.setAuthed)
  const [session, setSession] = useState<SessionState | null>(null)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const s = await auth.session()
      if (s.authenticated && s.user) {
        await hydrateProfile(s.user.id)
        useStore.getState().setUsername(s.user.username)
        if (s.user.onboarded) void loadSocial()
      }
      setSession(s)
      setAuthed(s.authenticated)
      setError(false)
      return s
    } catch {
      setError(true)
      return null
    }
  }, [setAuthed])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { session, loading: !session && !error, error, refresh }
}

/** Ends the server session, wipes this member's profile from the device, and returns to sign-in. */
export function useSignOut() {
  const router = useRouter()
  const setAuthed = useStore((s) => s.setAuthed)
  const toast = useStore((s) => s.toast)
  return useCallback(async () => {
    try {
      if (process.env.NEXT_PUBLIC_STANDALONE !== '1') await auth.logOut()
    } catch {
      // Already signed out, or offline: either way the local state is cleared below.
    }
    hydratedFor = null
    useStore.getState().clearLocalProfile()
    useStore.getState().setProfileOwner(null)
    setAuthed(false)
    toast('Signed out')
    router.replace(process.env.NEXT_PUBLIC_STANDALONE === '1' ? '/welcome' : '/login')
  }, [router, setAuthed, toast])
}
