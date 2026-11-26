import { getDb } from '../db'
import { appLaunched } from '../auth/config'
import { ApiError } from '../auth/http'
import type { PublicUser } from '../auth/service'
import { compatibilityScore } from '@/lib/compat/engine'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import type { CategoryResult, UserCompatProfile, VariableBreakdown } from '@/lib/compat/types'
import { cvFromMember, type ProfileCV } from '@/lib/profile/cv'
import type { ConnectReason, ProfileAnswer } from '@/types'
import { normalizeLayout } from '@/lib/profile/layouts'
import { isCompleteSet, loadCompatProfiles, loadCompleteProfile } from './members'

const isTestingRole = (role: string) => role === 'admin' || role === 'tester'

/**
 * Before launch, only admin and tester accounts can see anyone, and only each other, so real early
 * members are never exposed while the product is still being tried out.
 */
export function assertCanBrowse(viewer: PublicUser) {
  if (!appLaunched() && !isTestingRole(viewer.role)) {
    throw new ApiError(403, 'not_open_yet', 'Members cannot see each other until ChoiceMi launches.')
  }
  if (!viewer.onboarded) throw new ApiError(409, 'profile_incomplete', 'Finish setting up your profile first.')
}

type Gender = 'man' | 'woman' | 'nb'

/** Does someone interested in `interestedIn` (Men / Women / Everyone) want a person of `gender`? */
export function wantsGender(interestedIn: unknown, gender: unknown): boolean {
  const list = Array.isArray(interestedIn) ? (interestedIn as string[]) : []
  if (list.includes('Everyone')) return true
  if (gender === 'man') return list.includes('Men')
  if (gender === 'woman') return list.includes('Women')
  return false
}

export interface StoredData {
  onboarding?: Record<string, any>
  compatDraft?: Record<string, any>
  aiDraft?: Record<string, any>
  poolPicks?: { id?: string; question?: string; answer?: string }[]
}

export function cardFor(username: string, data: StoredData): { cv: ProfileCV; layout: string } {
  const ob = data.onboarding ?? {}
  const ai = data.aiDraft ?? {}
  const cv = cvFromMember({
    username,
    onboarding: {
      city: String(ob.city ?? ''),
      intent: typeof ob.intent === 'string' ? ob.intent : null,
      headline: String(ob.headline ?? ''),
      profession: String(ob.profession ?? ''),
      lifestyle: Array.isArray(ob.lifestyle) ? ob.lifestyle : [],
      dateTypes: Array.isArray(ob.dateTypes) ? ob.dateTypes : [],
      atmosphere: Array.isArray(ob.atmosphere) ? ob.atmosphere : [],
      bestTime: typeof ob.bestTime === 'string' ? ob.bestTime : null,
      safety: typeof ob.safety === 'string' ? ob.safety : null,
    },
    compat: (data.compatDraft ?? {}) as never,
    ai: {
      rawText: String(ai.rawText ?? ''),
      shortBio: String(ai.shortBio ?? ''),
      detailedProfile: String(ai.detailedProfile ?? ''),
      tags: Array.isArray(ai.tags) ? ai.tags : [],
      approved: ai.approved === true,
      prompts: ai.prompts && typeof ai.prompts === 'object' ? ai.prompts : {},
      extra: typeof ai.extra === 'string' ? ai.extra : '',
    },
  })
  // What a member says they want in a partner is theirs to share, not for every viewer to read.
  const answers: ProfileAnswer[] = (Array.isArray(data.poolPicks) ? data.poolPicks : [])
    .filter((p) => typeof p?.question === 'string' && typeof p?.answer === 'string')
    .map((p) => ({ q: p.question as string, a: p.answer as string }))
  return { cv: { ...cv, lookingFor: [], answers }, layout: normalizeLayout(ai.layout) }
}

const REASON_ICON: Record<string, ConnectReason['i']> = {
  physical_lifestyle: 'active',
  values_family: 'family',
  ambition_growth: 'serious',
  interests_connection: 'talk',
}

/** "Why you might connect": the member's strongest compatibility areas, in plain words. */
export function reasonsFrom(byCategory: CategoryResult[]): ConnectReason[] {
  const ranked = [...byCategory].sort((a, b) => b.percent - a.percent)
  const strong = ranked.filter((c) => c.percent >= 70).slice(0, 3)
  const use = strong.length ? strong : ranked.slice(0, 1)
  return use.map((c) => ({
    i: REASON_ICON[c.category] ?? 'chat',
    t: c.percent >= 70 ? `Strong fit on ${c.label} (${Math.round(c.percent)}%)` : `Some common ground on ${c.label}`,
  }))
}

/** A member's own age, from the compatibility answer they gave for it. */
export function ageFrom(profile: UserCompatProfile | undefined): number {
  const v = profile?.variables.find((x) => x.field === 'age')?.self
  return typeof v === 'number' ? v : 0
}

export const ORIENTATION_OK = (viewerOb: Record<string, any>, otherOb: Record<string, any>) =>
  wantsGender(viewerOb.interestedIn, otherOb.gender) && wantsGender(otherOb.interestedIn, viewerOb.gender)

export interface VisibleMember {
  id: string
  username: string
  role: string
  data: StoredData
  compat: UserCompatProfile
}

/**
 * A member this viewer is allowed to see and react to: active, identity verified, finished setup,
 * both people's orientation fits, and (before launch) only admin/tester accounts. Anything else is a
 * plain "no such member", so nobody can probe who exists.
 */
export async function loadVisibleMember(viewer: PublicUser, targetId: string): Promise<VisibleMember> {
  assertCanBrowse(viewer)
  const notFound = new ApiError(404, 'not_found', 'No such member.')
  if (!/^[0-9a-f-]{36}$/i.test(targetId) || targetId === viewer.id) throw notFound
  const db = await getDb()
  const { rows } = await db.query<{ id: string; username: string; role: string; data: StoredData }>(
    `select u.id, u.username, u.role, mp.data from users u join member_profiles mp on mp.user_id = u.id
      where u.id = $1 and u.status = 'active' and u.identity_verified_at is not null and mp.onboarded_at is not null`,
    [targetId],
  )
  const t = rows[0]
  if (!t || (!appLaunched() && !isTestingRole(t.role))) throw notFound
  const mine = (await db.query<{ data: StoredData }>('select data from member_profiles where user_id = $1', [viewer.id])).rows[0]?.data ?? {}
  if (!ORIENTATION_OK(mine.onboarding ?? {}, t.data.onboarding ?? {})) throw notFound
  const compat = await loadCompleteProfile(db, targetId)
  if (!compat) throw notFound
  return { id: t.id, username: t.username, role: t.role, data: t.data, compat }
}

export interface PairResult {
  final: number
  byCategory: CategoryResult[]
  /** how the viewer's own ratings scored this member, variable by variable */
  you: { percent: number; breakdown: VariableBreakdown[] }
  /** how this member's ratings scored the viewer: the percentage only, never their individual ratings */
  them: { percent: number }
}

export function pairResult(me: UserCompatProfile, other: UserCompatProfile): PairResult {
  const r = compatibilityScore(me, other)
  return { final: r.final, byCategory: r.byCategory, you: { percent: r.aToB.percent, breakdown: r.aToB.breakdown }, them: { percent: r.bToA.percent } }
}

export async function compatibilityWith(viewer: PublicUser, targetId: string): Promise<PairResult & { member: { id: string; username: string } }> {
  assertCanBrowse(viewer)
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new ApiError(404, 'not_found', 'No such member.')
  if (targetId === viewer.id) throw new ApiError(400, 'invalid_request', 'That is you.')
  const db = await getDb()
  const mine = await loadCompleteProfile(db, viewer.id)
  if (!mine) throw new ApiError(409, 'profile_incomplete', 'Finish your compatibility answers first.')

  const { rows } = await db.query<{ id: string; username: string; role: string }>(
    `select u.id, u.username, u.role from users u join member_profiles mp on mp.user_id = u.id
      where u.id = $1 and u.status = 'active' and u.identity_verified_at is not null and mp.onboarded_at is not null`,
    [targetId],
  )
  const target = rows[0]
  if (!target || (!appLaunched() && !isTestingRole(target.role))) throw new ApiError(404, 'not_found', 'No such member.')
  const theirs = await loadCompleteProfile(db, targetId)
  if (!theirs) throw new ApiError(404, 'not_found', 'No such member.')
  return { ...pairResult(mine, theirs), member: { id: target.id, username: target.username } }
}

export interface FeedMember {
  id: string
  username: string
  age: number
  city: string
  intent: string | null
  headline: string
  reasons: ConnectReason[]
  score: number
  byCategory: CategoryResult[]
  cv: ProfileCV
  layout: string
}

/** Members this viewer could meet, best compatibility first. Orientation must work both ways. */
export async function feedFor(viewer: PublicUser, limit = 30): Promise<FeedMember[]> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const mine = await loadCompleteProfile(db, viewer.id)
  if (!mine) throw new ApiError(409, 'profile_incomplete', 'Finish your compatibility answers first.')
  const myData = ((await db.query<{ data: StoredData }>('select data from member_profiles where user_id = $1', [viewer.id])).rows[0]?.data ?? {}) as StoredData
  const me = myData.onboarding ?? {}

  const { rows } = await db.query<{ id: string; username: string; data: StoredData }>(
    `select u.id, u.username, mp.data from users u join member_profiles mp on mp.user_id = u.id
      where u.id <> $1 and u.status = 'active' and u.identity_verified_at is not null and mp.onboarded_at is not null
        and ($2::boolean or u.role in ('admin', 'tester'))
        and not exists (select 1 from reactions r where r.from_user = $1 and r.to_user = u.id)
        and not exists (select 1 from matches m where m.user_a = least($1::uuid, u.id) and m.user_b = greatest($1::uuid, u.id))`,
    [viewer.id, appLaunched()],
  )
  const profiles = await loadCompatProfiles(db, rows.map((r) => r.id))

  const out: FeedMember[] = []
  for (const r of rows) {
    const theirs = profiles.get(r.id)
    if (!theirs || !isCompleteSet(theirs.variables)) continue
    const ob = r.data.onboarding ?? {}
    if (!ORIENTATION_OK(me, ob)) continue
    const pair = pairResult(mine, theirs)
    const card = cardFor(r.username, r.data)
    out.push({
      id: r.id,
      username: r.username,
      age: ageFrom(theirs),
      city: String(ob.city ?? ''),
      intent: typeof ob.intent === 'string' ? ob.intent : null,
      headline: String(ob.headline ?? ''),
      reasons: reasonsFrom(pair.byCategory),
      score: Math.round(pair.final),
      byCategory: pair.byCategory,
      cv: card.cv,
      layout: card.layout,
    })
  }
  out.sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
  return out.slice(0, limit)
}

export const catalogSize = VARIABLE_CATALOG.length
