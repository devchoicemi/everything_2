import { createHash } from 'node:crypto'
import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import type { PublicUser } from '../auth/service'
import { loadVisibleMember } from '../compat/discover'
import { seedIfEmpty } from '../questionPool'
import type { AnswerResult, AttemptStatus, PublicQuestion, StartResult } from '@/lib/verification/types'

/**
 * The read-check, on accounts and Postgres.
 *
 * The questions come from what the member being read chose on their own profile (their pool picks:
 * the question and the answer they gave). The question wording and the answer choices always come from
 * the shared question pool, so a member can only be asked something the pool really offers, and the
 * right answer is never sent to the reader.
 *
 * Policy (docs/VERIFICATION_GATE_POLICY.md): per (reader, member), 3 wrong answers block that pair for
 * 24 hours; the same question is served until it is answered, so refreshing never rerolls it; a wrong
 * answer moves to a question not yet asked in this round. Every change runs in one transaction on the
 * row (`for update`), so two answers arriving together cannot slip past the attempt cap.
 */
export const MAX_ATTEMPTS = 3
export const BLOCK_HOURS = 24

interface Pick {
  id: string
  question: string
  options: string[]
  correct: string
}

interface Attempt {
  status: AttemptStatus
  attempts_used: number
  asked_ids: string[]
  current_question_id: string | null
  blocked_until: Date | null
}

/** The questions a reader can be asked about this member, with the right answers. Server-side only. */
export async function bankFor(q: Queryable, targetId: string): Promise<Pick[]> {
  await seedIfEmpty() // the pool is filled the first time anything reads it
  const prof = (await q.query<{ data: { poolPicks?: { id?: string; answer?: string }[] } }>('select data from member_profiles where user_id = $1', [targetId])).rows[0]
  const picks = Array.isArray(prof?.data?.poolPicks) ? prof.data.poolPicks : []
  const ids = picks.map((p) => p?.id).filter((x): x is string => typeof x === 'string')
  if (ids.length === 0) return []
  const pool = (await q.query<{ id: string; question: string; options: string[] }>('select id, question, options from question_pool where id = any($1::text[])', [ids])).rows
  const out: Pick[] = []
  for (const p of picks) {
    const row = pool.find((r) => r.id === p?.id)
    if (!row || typeof p.answer !== 'string' || !row.options.includes(p.answer)) continue
    if (out.some((o) => o.id === row.id)) continue
    out.push({ id: row.id, question: row.question, options: row.options, correct: p.answer })
  }
  return out
}

/** Stable order per reader and question, so the choices do not move around on refresh. */
function shuffled(reader: string, qid: string, options: string[]): string[] {
  const key = (o: string) => createHash('sha256').update(`${reader}:${qid}:${o}`).digest('hex')
  return [...options].sort((a, b) => key(a).localeCompare(key(b)))
}

const publicQuestion = (reader: string, p: Pick): PublicQuestion => ({ questionId: p.id, question: p.question, options: shuffled(reader, p.id, p.options) })

function pickNext(bank: Pick[], asked: string[]): Pick {
  const fresh = bank.filter((b) => !asked.includes(b.id))
  const from = fresh.length ? fresh : bank
  return from[Math.floor(Math.random() * from.length)]
}

const remaining = (used: number) => Math.max(0, MAX_ATTEMPTS - used)
const ms = (d: Date | null) => (d ? new Date(d).getTime() : null)

async function lockAttempt(q: Queryable, reader: string, target: string): Promise<Attempt | undefined> {
  return (
    await q.query<Attempt>(
      'select status, attempts_used, asked_ids, current_question_id, blocked_until from gate_attempts where reader_id = $1 and target_id = $2 for update',
      [reader, target],
    )
  ).rows[0]
}

async function visible(viewer: PublicUser, targetId: string) {
  await loadVisibleMember(viewer, targetId)
  const db = await getDb()
  const bank = await bankFor(db, targetId)
  return { db, bank }
}

export async function readCheckStatus(viewer: PublicUser, targetId: string): Promise<{ status: AttemptStatus | 'none'; attemptsRemaining: number; blockedUntil: number | null }> {
  await loadVisibleMember(viewer, targetId)
  const db = await getDb()
  const a = (await db.query<Attempt>('select status, attempts_used, blocked_until from gate_attempts where reader_id = $1 and target_id = $2', [viewer.id, targetId])).rows[0]
  if (!a) return { status: 'none', attemptsRemaining: MAX_ATTEMPTS, blockedUntil: null }
  if (a.status === 'blocked' && a.blocked_until && new Date(a.blocked_until).getTime() <= Date.now()) {
    return { status: 'none', attemptsRemaining: MAX_ATTEMPTS, blockedUntil: null }
  }
  return { status: a.status, attemptsRemaining: remaining(a.attempts_used), blockedUntil: ms(a.blocked_until) }
}

export async function startReadCheck(viewer: PublicUser, targetId: string): Promise<StartResult> {
  const { db, bank } = await visible(viewer, targetId)
  if (bank.length === 0) throw new ApiError(409, 'no_read_check', 'This member has not set up their read-check questions yet.')

  return db.tx(async (q) => {
    const a = await lockAttempt(q, viewer.id, targetId)
    const now = Date.now()
    if (a?.status === 'passed') return { status: 'passed', attemptsUsed: a.attempts_used, attemptsRemaining: remaining(a.attempts_used), question: null, blockedUntil: null }
    if (a?.status === 'blocked' && a.blocked_until && new Date(a.blocked_until).getTime() > now) {
      return { status: 'blocked', attemptsUsed: a.attempts_used, attemptsRemaining: 0, question: null, blockedUntil: ms(a.blocked_until) }
    }
    if (a?.status === 'active' && a.current_question_id) {
      const cur = bank.find((b) => b.id === a.current_question_id)
      if (cur) return { status: 'active', attemptsUsed: a.attempts_used, attemptsRemaining: remaining(a.attempts_used), question: publicQuestion(viewer.id, cur), blockedUntil: null }
    }
    // a fresh round: first time, after the cool-down, or the member changed their questions
    const next = pickNext(bank, [])
    await q.query(
      `insert into gate_attempts (reader_id, target_id, status, attempts_used, asked_ids, current_question_id, blocked_until, passed_at, updated_at)
       values ($1, $2, 'active', 0, $3::jsonb, $4, null, null, now())
       on conflict (reader_id, target_id) do update
         set status = 'active', attempts_used = 0, asked_ids = excluded.asked_ids, current_question_id = excluded.current_question_id,
             blocked_until = null, passed_at = null, updated_at = now()`,
      [viewer.id, targetId, JSON.stringify([next.id]), next.id],
    )
    return { status: 'active', attemptsUsed: 0, attemptsRemaining: MAX_ATTEMPTS, question: publicQuestion(viewer.id, next), blockedUntil: null }
  })
}

export async function answerReadCheck(viewer: PublicUser, targetId: string, questionId: string, selectedOption: string): Promise<AnswerResult> {
  const { db, bank } = await visible(viewer, targetId)

  return db.tx(async (q): Promise<AnswerResult> => {
    const a = await lockAttempt(q, viewer.id, targetId)
    const idle = (feedback: string): AnswerResult => ({
      correct: false,
      status: a?.status ?? 'active',
      attemptsUsed: a?.attempts_used ?? 0,
      attemptsRemaining: a ? remaining(a.attempts_used) : MAX_ATTEMPTS,
      nextQuestion: null,
      blockedUntil: ms(a?.blocked_until ?? null),
      feedback,
    })
    if (!a || a.status !== 'active') {
      return idle(a?.status === 'blocked' ? 'This read-check is temporarily locked.' : a?.status === 'passed' ? 'You already passed this read-check.' : 'Start a read-check before answering.')
    }
    const current = bank.find((b) => b.id === a.current_question_id)
    if (!current) return idle('Start a read-check before answering.')
    if (a.current_question_id !== questionId) {
      return { ...idle('That question is no longer active: answer the current one shown.'), status: 'active', nextQuestion: publicQuestion(viewer.id, current) }
    }

    if (current.correct === selectedOption) {
      await q.query(`update gate_attempts set status = 'passed', passed_at = now(), current_question_id = null, updated_at = now() where reader_id = $1 and target_id = $2`, [viewer.id, targetId])
      return { correct: true, status: 'passed', attemptsUsed: a.attempts_used, attemptsRemaining: remaining(a.attempts_used), nextQuestion: null, blockedUntil: null, feedback: 'Correct: well done for reading carefully.' }
    }

    const used = a.attempts_used + 1
    if (used >= MAX_ATTEMPTS) {
      const { rows } = await q.query<{ blocked_until: Date }>(
        `update gate_attempts set status = 'blocked', attempts_used = $3, current_question_id = null,
           blocked_until = now() + ($4 || ' hours')::interval, updated_at = now()
         where reader_id = $1 and target_id = $2 returning blocked_until`,
        [viewer.id, targetId, used, String(BLOCK_HOURS)],
      )
      return { correct: false, status: 'blocked', attemptsUsed: used, attemptsRemaining: 0, nextQuestion: null, blockedUntil: ms(rows[0].blocked_until), feedback: 'Three attempts used. Take a break and come back in 24 hours.' }
    }

    const asked = Array.isArray(a.asked_ids) ? a.asked_ids : []
    const next = pickNext(bank, asked)
    await q.query(
      `update gate_attempts set attempts_used = $3, asked_ids = $4::jsonb, current_question_id = $5, updated_at = now() where reader_id = $1 and target_id = $2`,
      [viewer.id, targetId, used, JSON.stringify([...asked, next.id]), next.id],
    )
    const left = remaining(used)
    return {
      correct: false,
      status: 'active',
      attemptsUsed: used,
      attemptsRemaining: left,
      nextQuestion: publicQuestion(viewer.id, next),
      blockedUntil: null,
      feedback: `Not quite: the answer is in the profile. ${left} attempt${left === 1 ? '' : 's'} left.`,
    }
  })
}

/** Has this reader passed the read-check for this member? Used by likes and date proposals. */
export async function hasPassed(q: Queryable, readerId: string, targetId: string): Promise<boolean> {
  const r = await q.query('select 1 from gate_attempts where reader_id = $1 and target_id = $2 and status = $3', [readerId, targetId, 'passed'])
  return r.rows.length > 0
}
