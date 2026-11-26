/* ============================================================================
   ChoiceMi API layer.

   Two kinds of calls live here:
   - Pre-existing demo scaffolding (auth SSO stub, feed/venues/bookings lists,
     post-date feedback) stays mock-first behind NEXT_PUBLIC_MOCK_MODE, with a
     `real()` path ready for an external backend — unchanged by this pass.
   - Compatibility scoring, the profile-reading verification gate, date
     proposals, and AI profile drafting are NOT mocked: they always call this
     app's own Next.js API routes under /app/api — a genuine, running
     backend, not a stub. See the corresponding lib/* modules for the logic.
   ========================================================================== */

import {
  CAL_EVENTS,
  DATE_BOOKINGS,
  MATCHES,
  MUTUAL_PROFILE_IDS,
  PROFILES,
  VENUES,
} from '@/lib/mock-data'
import { apiCall } from '@/services/auth'
import { LIVE } from '@/lib/live'
import { membersApi } from '@/services/members'
import { matchToMatch, memberToProfile, venueToVenue } from '@/services/social'
import type { CompatibilityResult, CompatVariableInput, UserCompatProfile } from '@/lib/compat/types'
import type { GateQuestionInput } from '@/lib/verification/validate'
import type { AnswerResult, AttemptStatus, StartResult } from '@/lib/verification/types'
import type { ProfileDraft } from '@/lib/ai/profileDraft'
import type { DateBooking, Match, Profile, Venue } from '@/types'

const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE !== 'false'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms))

async function real<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/** Same-origin call to this app's own /api/* routes — the real pilot backend. */
async function local<T>(path: string, init?: RequestInit): Promise<T> {
  const options: RequestInit = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...init,
  }
  let res: Response
  if (process.env.NEXT_PUBLIC_STANDALONE === '1') {
    // Offline Android build: there is no server, so the same route handlers run in-app.
    const { standaloneFetch } = await import('@/lib/standalone/router')
    res = await standaloneFetch(path, options)
  } else {
    res = await fetch(`/api${path}`, options)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error ?? `${res.status} ${res.statusText}`) as Error & {
      status?: number
      details?: unknown
    }
    err.status = res.status
    err.details = body.details
    throw err
  }
  return res.json() as Promise<T>
}

/* --------------------------------- discover -------------------------------- */

export const discoverService = {
  async feed(): Promise<Profile[]> {
    if (LIVE) return (await membersApi.feed()).members.map(memberToProfile)
    if (MOCK) {
      await wait()
      return PROFILES
    }
    return real('/discover/feed')
  },

  async profile(id: number | string): Promise<Profile | undefined> {
    if (LIVE) return (await discoverService.feed()).find((p) => p.id === id)
    if (MOCK) {
      await wait()
      return PROFILES.find((p) => p.id === id)
    }
    return real(`/discover/profile/${id}`)
  },

  /** A like only counts once the read-check is passed; the server checks that again. */
  async like(profileId: number | string): Promise<{ mutual: boolean; matchId?: string | null; score?: number }> {
    if (LIVE) return membersApi.like(String(profileId))
    if (MOCK) {
      await wait()
      return { mutual: MUTUAL_PROFILE_IDS.includes(Number(profileId)) }
    }
    return real('/discover/like', { method: 'POST', body: JSON.stringify({ profileId }) })
  },

  async pass(profileId: number | string): Promise<{ ok: boolean }> {
    if (LIVE) return membersApi.pass(String(profileId))
    if (MOCK) {
      await wait(120)
      return { ok: true }
    }
    return real('/discover/pass', { method: 'POST', body: JSON.stringify({ profileId }) })
  },
}

/* ----------------------------- compatibility -------------------------------- */

export const compatService = {
  /** Always hits the real self-vs-ideal engine — GET /api/compatibility/{a}/{b}. */
  async getScore(userAId: string, userBId: string): Promise<CompatibilityResult> {
    if (LIVE) {
      // the server scores me against them: how my ratings fit them, and (as a percentage only) how theirs fit me
      const r = await membersApi.compatibility(userBId)
      return {
        final: r.final,
        byCategory: r.byCategory,
        aToB: { percent: r.you.percent, breakdown: r.you.breakdown },
        bToA: { percent: r.them.percent, breakdown: [] },
      }
    }
    return local(`/compatibility/${encodeURIComponent(userAId)}/${encodeURIComponent(userBId)}`)
  },
}

export const profileVariablesService = {
  async get(): Promise<UserCompatProfile> {
    return local('/profile/variables')
  },
  /**
   * Saves my compatibility answers to my account on the server (validated there: weights, dealbreaker
   * caps, every option rated). The offline app has no account, so it keeps its own in-app copy.
   */
  async save(variables: CompatVariableInput[]): Promise<{ ok: true }> {
    if (process.env.NEXT_PUBLIC_STANDALONE === '1') {
      return local('/profile/variables', { method: 'POST', body: JSON.stringify({ variables }) })
    }
    await apiCall('/me/compatibility', { method: 'PUT', body: { variables } })
    return { ok: true }
  },
}

/* ------------------------------ verification gate ---------------------------- */

export const verificationService = {
  async start(targetId: string): Promise<StartResult> {
    if (LIVE) return membersApi.readCheckStart(targetId)
    return local(`/verification/${encodeURIComponent(targetId)}/start`, { method: 'POST' })
  },
  async answer(targetId: string, questionId: string, selectedOption: string): Promise<AnswerResult> {
    if (LIVE) return membersApi.readCheckAnswer(targetId, questionId, selectedOption)
    return local(`/verification/${encodeURIComponent(targetId)}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOption }),
    })
  },
  async status(targetId: string): Promise<{ status: AttemptStatus | 'none' }> {
    if (LIVE) return membersApi.readCheckStatus(targetId)
    return local(`/verification/${encodeURIComponent(targetId)}/status`)
  },
}

export const gateQuestionsService = {
  async get(): Promise<{ questions: { id: string; question: string; options: string[] }[] }> {
    return local('/profile/gate-questions')
  },
  async save(questions: GateQuestionInput[]): Promise<{ ok: true }> {
    // real accounts: the questions are part of the saved profile (the picks), so there is nothing else to store
    if (LIVE) return { ok: true }
    return local('/profile/gate-questions', { method: 'POST', body: JSON.stringify({ questions }) })
  },
}

/* ------------------------------------- AI ------------------------------------ */

export const aiService = {
  async generateDraft(rawText: string, existingTags: string[] = []): Promise<ProfileDraft> {
    return local('/ai/profile-draft', { method: 'POST', body: JSON.stringify({ rawText, existingTags }) })
  },
}

/* --------------------------------- matches --------------------------------- */

export const matchService = {
  async list(): Promise<Match[]> {
    if (LIVE) return (await membersApi.matches()).matches.map(matchToMatch)
    if (MOCK) {
      await wait()
      return MATCHES
    }
    return real('/matches')
  },

  async detail(id: number | string): Promise<Match | undefined> {
    if (LIVE) return matchToMatch((await membersApi.match(String(id))).match)
    if (MOCK) {
      await wait()
      return MATCHES.find((m) => m.id === id)
    }
    return real(`/matches/${id}`)
  },

  async unmatch(id: number | string): Promise<void> {
    if (LIVE) await membersApi.unmatch(String(id))
  },
}

/* ---------------------------------- dates ---------------------------------- */

export const dateService = {
  async venues(): Promise<Venue[]> {
    if (LIVE) return (await membersApi.venues()).venues.map(venueToVenue)
    if (MOCK) {
      await wait()
      return VENUES
    }
    return real('/venues')
  },

  /** Which start times are still free at a venue on a day (live accounts only). */
  async slots(venueId: string, dateKey: string) {
    return (await membersApi.slots(venueId, dateKey)).slots
  },

  async bookings(): Promise<typeof DATE_BOOKINGS> {
    if (MOCK) {
      await wait()
      return DATE_BOOKINGS
    }
    return real('/dates')
  },

  async calendarEvents(): Promise<typeof CAL_EVENTS> {
    if (MOCK) {
      await wait()
      return CAL_EVENTS
    }
    return real('/dates/calendar')
  },

  /**
   * No `note`/message field exists on this payload by design (requirement: no typing during the
   * connection process). The server independently re-validates the booking hour window, the
   * venue's free tables and that the two of you are matched.
   */
  async propose(payload: {
    targetId: string
    dateKey: string
    time: string
    venue: string
    venueId?: string
  }): Promise<{ ok: boolean; proposal: unknown }> {
    return local('/dates/propose', { method: 'POST', body: JSON.stringify(payload) })
  },

  async accept(id: number | string) {
  },
  async decline(id: number | string) {
  },
  async cancel(id: number | string) {
  },
  async requestRedate(id: number | string): Promise<{ mutual: boolean }> {
    await wait(200)
    return { mutual: false }
  },

  async submitFeedback(payload: {
    dateId: number | string
    stars: number
    answers: Record<string, string>
  }): Promise<{ ok: boolean }> {
    if (MOCK) {
      await wait(300)
      return { ok: true }
    }
    return real('/dates/feedback', { method: 'POST', body: JSON.stringify(payload) })
  },
}
