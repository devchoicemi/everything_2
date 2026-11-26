'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  CAL_EVENTS,
  DATE_BOOKINGS,
  DEMO_USER,
  MATCHES,
  PROFILES,
} from '@/lib/mock-data'
import { emptyCompatDraft, type CompatDraft, type DraftVariable } from '@/lib/compat/onboardingDraft'
import { LIVE } from '@/lib/live'
import { normalizeLayout } from '@/lib/profile/layouts'
import { composeStory } from '@/lib/profile/quality'
import type {
  CalendarEvent,
  DateBooking,
  Match,
  Profile,
  ProfileLayout,
  SessionUser,
  ToastMessage,
  ToastTone,
} from '@/types'

export interface OnboardingState {
  gender: string | null
  interestedIn: string[]
  city: string
  intent: string | null
  headline: string
  lifestyle: string[]
  profession: string
  dateTypes: string[]
  atmosphere: string[]
  bestTime: string | null
  safety: string | null
  ageFrom: number
  ageTo: number
  distanceStep: number
  dealbreakers: string[]
  /** explicit consent to process sensitive details (who you are interested in, faith) to match you */
  consentSensitive: boolean
}

const emptyOnboarding: OnboardingState = {
  gender: null,
  interestedIn: [],
  city: '',
  intent: null,
  headline: '',
  lifestyle: [],
  profession: '',
  dateTypes: [],
  atmosphere: [],
  bestTime: null,
  safety: null,
  ageFrom: 24,
  ageTo: 32,
  distanceStep: 2,
  dealbreakers: [],
  consentSensitive: false,
}

export type DraftStatus = 'idle' | 'generating' | 'ready' | 'error'

export interface AIDraftState {
  /** the member's own words, composed from `prompts` and `extra`; this is what the AI drafter and the profile use */
  rawText: string
  /** answers to the guided questions, by prompt id */
  prompts: Record<string, string>
  /** anything else the member wanted to add */
  extra: string
  layout: ProfileLayout
  shortBio: string
  detailedProfile: string
  tags: string[]
  status: DraftStatus
  error: string | null
  approved: boolean
}

const emptyAIDraft: AIDraftState = {
  rawText: '',
  prompts: {},
  extra: '',
  layout: 'timeline',
  shortBio: '',
  detailedProfile: '',
  tags: [],
  status: 'idle',
  error: null,
  approved: false,
}

export interface GateQuestionDraft {
  question: string
  correctAnswer: string
  distractors: [string, string, string]
}

function emptyGateQuestion(): GateQuestionDraft {
  return { question: '', correctAnswer: '', distractors: ['', '', ''] }
}

/**
 * A question the member chose from the shared question pool, with the answer that is true for them.
 * The wrong options a reader sees are the pool's other suggested answers for that question.
 */
export interface PoolPick {
  id: string
  question: string
  options: string[]
  answer: string
}

export const MIN_PICKS = 4
export const MAX_PICKS = 5

/** Turns picks into the owner-authored shape the read-check gate stores and serves. */
export function picksToGateQuestions(picks: PoolPick[]): GateQuestionDraft[] {
  return picks.map((p) => {
    const others = p.options.filter((o) => o !== p.answer).slice(0, 3)
    while (others.length < 3) others.push('')
    return { question: p.question, correctAnswer: p.answer, distractors: others as [string, string, string] }
  })
}

/** The part of a member's profile that is saved to their account. */
export interface SavedProfile {
  onboarding?: Partial<OnboardingState>
  compatDraft?: CompatDraft
  aiDraft?: Partial<AIDraftState>
  poolPicks?: PoolPick[]
}

/** Pulls the savable profile out of the store state (nothing transient: no status, errors or toasts). */
export function profileSnapshot(s: Pick<Store, 'onboarding' | 'compatDraft' | 'aiDraft' | 'poolPicks'>): SavedProfile {
  const { status: _status, error: _error, ...ai } = s.aiDraft
  void _status
  void _error
  return { onboarding: s.onboarding, compatDraft: s.compatDraft, aiDraft: ai, poolPicks: s.poolPicks }
}

interface Store {
  /* session */
  user: SessionUser
  authed: boolean
  setAuthed: (v: boolean) => void

  /* onboarding — identity/story/prefs/filters */
  onboarding: OnboardingState
  patchOnboarding: (patch: Partial<OnboardingState>) => void
  toggleOnboardingList: (key: keyof OnboardingState, value: string) => void
  resetOnboarding: () => void

  /* onboarding — compatibility engine inputs (self/ideal/weight/dealbreaker) */
  compatDraft: CompatDraft
  patchCompatVariable: (field: string, patch: Partial<DraftVariable>) => void
  resetCompatDraft: () => void

  /* onboarding — AI-assisted profile drafting */
  aiDraft: AIDraftState
  patchAIDraft: (patch: Partial<AIDraftState>) => void
  /** edit the guided story; keeps rawText in step and resets any AI draft built from older words */
  patchStory: (patch: { prompts?: Record<string, string>; extra?: string }) => void
  resetAIDraft: () => void

  /* onboarding — read-check questions picked from the question pool */
  poolPicks: PoolPick[]
  gateQuestions: GateQuestionDraft[]
  setPoolPick: (pick: PoolPick) => void
  removePoolPick: (id: string) => void
  resetGateQuestions: () => void

  /* account — copy the member's saved profile in on sign-in, wipe it from this device on sign-out */
  profileOwner: string | null
  setProfileOwner: (id: string | null) => void
  /** the member's own anonymous username, from their account */
  setUsername: (username: string) => void
  hydrateProfile: (data: SavedProfile) => void
  clearLocalProfile: () => void

  /* discover */
  profiles: Profile[]
  cursor: number
  /** replace the deck with a freshly loaded one and start from the top */
  setProfiles: (profiles: Profile[]) => void
  advanceCursor: () => void
  currentProfile: () => Profile | undefined

  /* matches */
  matches: Match[]
  setMatches: (matches: Match[]) => void
  addMatch: (match: Match) => void

  /* dates */
  bookings: Record<'upcoming' | 'pending' | 'past', DateBooking[]>
  calendarEvents: Record<string, CalendarEvent>
  setBookings: (bookings: Record<'upcoming' | 'pending' | 'past', DateBooking[]>, events: Record<string, CalendarEvent>) => void
  addCalendarEvent: (key: string, ev: CalendarEvent) => void
  moveBookingToPending: (booking: DateBooking) => void

  /* ui — toasts */
  toasts: ToastMessage[]
  toast: (text: string, tone?: ToastTone) => void
  dismissToast: (id: number) => void

  /* ui — settings */
  notificationsOn: boolean
  toggleNotifications: () => void
}

let toastSeq = 0

const NO_BOOKINGS: Record<'upcoming' | 'pending' | 'past', DateBooking[]> = { upcoming: [], pending: [], past: [] }

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
  user: DEMO_USER,
  authed: false,
  setAuthed: (v) => set({ authed: v }),

  onboarding: emptyOnboarding,
  patchOnboarding: (patch) => set((s) => ({ onboarding: { ...s.onboarding, ...patch } })),
  toggleOnboardingList: (key, value) =>
    set((s) => {
      const list = s.onboarding[key]
      if (!Array.isArray(list)) return {}
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value]
      return { onboarding: { ...s.onboarding, [key]: next } }
    }),
  resetOnboarding: () => set({ onboarding: emptyOnboarding }),

  compatDraft: emptyCompatDraft(),
  patchCompatVariable: (field, patch) =>
    set((s) => ({ compatDraft: { ...s.compatDraft, [field]: { ...s.compatDraft[field], ...patch } } })),
  resetCompatDraft: () => set({ compatDraft: emptyCompatDraft() }),

  aiDraft: emptyAIDraft,
  patchAIDraft: (patch) => set((s) => ({ aiDraft: { ...s.aiDraft, ...patch } })),
  patchStory: (patch) =>
    set((s) => {
      const prompts = patch.prompts ?? s.aiDraft.prompts
      const extra = patch.extra ?? s.aiDraft.extra
      return { aiDraft: { ...s.aiDraft, prompts, extra, rawText: composeStory({ prompts, extra }), status: 'idle', approved: false } }
    }),
  resetAIDraft: () => set({ aiDraft: emptyAIDraft }),

  poolPicks: [],
  gateQuestions: [],
  setPoolPick: (pick) =>
    set((s) => {
      const exists = s.poolPicks.some((p) => p.id === pick.id)
      if (!exists && s.poolPicks.length >= MAX_PICKS) return {}
      const poolPicks = exists ? s.poolPicks.map((p) => (p.id === pick.id ? pick : p)) : [...s.poolPicks, pick]
      return { poolPicks, gateQuestions: picksToGateQuestions(poolPicks) }
    }),
  removePoolPick: (id) =>
    set((s) => {
      const poolPicks = s.poolPicks.filter((p) => p.id !== id)
      return { poolPicks, gateQuestions: picksToGateQuestions(poolPicks) }
    }),
  resetGateQuestions: () => set({ poolPicks: [], gateQuestions: [] }),

  profileOwner: null,
  setProfileOwner: (id) => set({ profileOwner: id }),
  setUsername: (username) => set((s) => (s.user.username === username ? {} : { user: { ...s.user, username } })),

  hydrateProfile: (data) =>
    set(() => {
      const poolPicks = Array.isArray(data.poolPicks) ? data.poolPicks : []
      return {
        onboarding: { ...emptyOnboarding, ...(data.onboarding ?? {}) },
        compatDraft: { ...emptyCompatDraft(), ...(data.compatDraft ?? {}) },
        aiDraft: { ...emptyAIDraft, ...(data.aiDraft ?? {}), status: 'idle' as DraftStatus, error: null },
        poolPicks,
        gateQuestions: picksToGateQuestions(poolPicks),
      }
    }),
  clearLocalProfile: () =>
    set({
      onboarding: emptyOnboarding,
      compatDraft: emptyCompatDraft(),
      aiDraft: emptyAIDraft,
      poolPicks: [],
      gateQuestions: [],
      matches: LIVE ? [] : MATCHES,
      profiles: LIVE ? [] : PROFILES,
      bookings: LIVE ? NO_BOOKINGS : DATE_BOOKINGS,
      calendarEvents: LIVE ? {} : CAL_EVENTS,
      cursor: 0,
    }),

  // Real accounts start empty and load their own members, matches and dates; only the offline app
  // starts from the demo data.
  profiles: LIVE ? [] : PROFILES,
  cursor: 0,
  setProfiles: (profiles) => set({ profiles, cursor: 0 }),
  advanceCursor: () => set((s) => ({ cursor: s.cursor + 1 })),
  currentProfile: () => {
    const { profiles, cursor } = get()
    return profiles[cursor]
  },

  matches: LIVE ? [] : MATCHES,
  setMatches: (matches) => set({ matches }),
  // Prepend a freshly-earned mutual match — guarded against duplicates since
  // a profile can only ever become a match once (Discover removes it from
  // the deck the moment it's liked or passed).
  addMatch: (match) =>
    set((s) => (s.matches.some((m) => m.id === match.id) ? s : { matches: [match, ...s.matches] })),

  bookings: LIVE ? NO_BOOKINGS : DATE_BOOKINGS,
  calendarEvents: LIVE ? {} : CAL_EVENTS,
  setBookings: (bookings, calendarEvents) => set({ bookings, calendarEvents }),
  addCalendarEvent: (key, ev) =>
    set((s) => ({ calendarEvents: { ...s.calendarEvents, [key]: ev } })),
  moveBookingToPending: (booking) =>
    set((s) => ({
      bookings: {
        ...s.bookings,
        pending: [booking, ...s.bookings.pending.filter((b) => b.id !== booking.id)],
      },
    })),

  toasts: [],
  toast: (text, tone = 'default') => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 2800)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  notificationsOn: true,
  toggleNotifications: () => set((s) => ({ notificationsOn: !s.notificationsOn })),
    }),
    {
      name: 'choicemi-draft',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // v2: height is in centimetres with new bands; profile layouts are the four CV designs;
      // read-check questions come from the question pool; "verified only" options are gone
      // (everyone is verified). Older saved drafts are repaired, not discarded.
      // v3: real accounts keep their matches on the server, so demo matches saved by older versions go.
      migrate: (persisted: unknown) => {
        const repaired = migrateDraft(persisted)
        if (LIVE) delete repaired.matches
        return repaired
      },
      // Only persist the user's own draft input and earned state — never
      // toasts, the discover cursor, or seeded mock data (profiles/bookings),
      // which should always start fresh from lib/mock-data.ts. `matches` IS
      // persisted despite starting from seed data: once a real mutual match
      // is earned via Discover (addMatch), losing it on refresh would be the
      // same silent-data-loss bug as the onboarding draft.
      partialize: (s) => ({
        onboarding: s.onboarding,
        compatDraft: s.compatDraft,
        aiDraft: s.aiDraft,
        poolPicks: s.poolPicks,
        gateQuestions: s.gateQuestions,
        profileOwner: s.profileOwner,
        notificationsOn: s.notificationsOn,
        // matches are only kept on this device by the offline app; real matches live on the server
        ...(LIVE ? {} : { matches: s.matches }),
      }),
    },
  ),
)

/** Repairs a draft saved by an older version of the app. */
export function migrateDraft(persisted: unknown): Record<string, unknown> {
  const p = (persisted ?? {}) as Record<string, any>
  const compat = p.compatDraft as CompatDraft | undefined
  if (compat?.height) {
    const h = compat.height
    const oldKeys = Object.keys(h.ideal ?? {}).some((k) => !k.startsWith('h_'))
    const inches = typeof h.self === 'number' && h.self < 100
    if (oldKeys || inches) compat.height = { ...h, self: null, ideal: {} }
  }
  if (p.aiDraft) {
    p.aiDraft.layout = normalizeLayout(p.aiDraft.layout)
    if (!p.aiDraft.prompts || typeof p.aiDraft.prompts !== 'object') {
      p.aiDraft.prompts = {}
      p.aiDraft.extra = typeof p.aiDraft.extra === 'string' ? p.aiDraft.extra : (p.aiDraft.rawText ?? '')
    }
  }
  if (p.onboarding) {
    if (p.onboarding.safety === 'Verified users only') p.onboarding.safety = null
    if (Array.isArray(p.onboarding.dealbreakers)) {
      p.onboarding.dealbreakers = p.onboarding.dealbreakers.filter((d: string) => d !== 'Verified only')
    }
    if (typeof p.onboarding.consentSensitive !== 'boolean') p.onboarding.consentSensitive = false
  }
  p.poolPicks = Array.isArray(p.poolPicks) ? p.poolPicks : []
  p.gateQuestions = picksToGateQuestions(p.poolPicks)
  return p
}
