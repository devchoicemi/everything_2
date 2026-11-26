'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Tracks vertical scroll progress (0–1) of an element. */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      setProgress(max <= 0 ? 1 : Math.min(1, Math.max(0, el.scrollTop / max)))
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return { ref, progress }
}

/** window.matchMedia hook, SSR-safe. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 768px)')
}

/** Debounce a value. */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Simple locking body-scroll for full-screen overlays. */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}

/** Returns a stable callback that fires once the component has mounted. */
export function useMountedCallback(cb: () => void) {
  const stable = useCallback(cb, [cb])
  useEffect(() => {
    stable()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
