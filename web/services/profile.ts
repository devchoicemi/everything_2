import { apiCall } from '@/services/auth'
import { POOL_THEMES, STATIC_POOL, type PoolQuestion, type PoolTheme } from '@/lib/questionPool'
import type { SavedProfile } from '@/store'

const STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === '1'

export interface RemoteProfile {
  onboarded: boolean
  data: SavedProfile
}

/** The member's profile as saved on their account (so it follows them across sign-outs and devices). */
export const profileApi = {
  async get(): Promise<RemoteProfile> {
    if (STANDALONE) return { onboarded: true, data: {} }
    return apiCall<RemoteProfile>('/me/profile')
  },

  async save(data: SavedProfile, complete = false): Promise<RemoteProfile> {
    if (STANDALONE) return { onboarded: complete, data }
    return apiCall<RemoteProfile>('/me/profile', { method: 'PUT', body: { data, complete } })
  },
}

/** The read-check question pool. Falls back to the built-in starting pool if the server cannot be reached. */
export async function loadQuestionPool(): Promise<{ themes: PoolTheme[]; questions: PoolQuestion[] }> {
  if (!STANDALONE) {
    try {
      return await apiCall<{ themes: PoolTheme[]; questions: PoolQuestion[] }>('/questions/pool')
    } catch {
      // fall through to the built-in pool
    }
  }
  return { themes: POOL_THEMES, questions: STATIC_POOL }
}
