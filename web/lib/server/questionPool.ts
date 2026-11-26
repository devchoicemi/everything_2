import { getDb } from './db'
import { POOL_OPTIONS_MAX, POOL_OPTIONS_MIN, POOL_THEMES, STATIC_POOL, type PoolQuestion } from '@/lib/questionPool'
import { ApiError } from './auth/http'
import { randomToken } from './auth/crypto'

/** Inserts the starting pool the first time the table is read. */
export async function seedIfEmpty(): Promise<void> {
  const db = await getDb()
  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from question_pool')
  if (rows[0].n > 0) return
  let order = 0
  for (const q of STATIC_POOL) {
    await db.query(
      `insert into question_pool (id, theme, question, options, sort_order) values ($1, $2, $3, $4::jsonb, $5)
       on conflict (id) do nothing`,
      [q.id, q.theme, q.question, JSON.stringify(q.options), order++],
    )
  }
}

export async function listPool(): Promise<PoolQuestion[]> {
  await seedIfEmpty()
  const db = await getDb()
  const { rows } = await db.query<{ id: string; theme: string; question: string; options: string[] }>(
    'select id, theme, question, options from question_pool where active order by sort_order, created_at',
  )
  return rows.map((r) => ({ id: r.id, theme: r.theme, question: r.question, options: r.options }))
}

export async function addPoolQuestion(body: Record<string, unknown>): Promise<PoolQuestion> {
  const theme = typeof body.theme === 'string' ? body.theme : ''
  if (!POOL_THEMES.some((t) => t.id === theme)) throw new ApiError(400, 'invalid_theme', `theme must be one of: ${POOL_THEMES.map((t) => t.id).join(', ')}`)
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (question.length < 8 || question.length > 160) throw new ApiError(400, 'invalid_question', 'The question must be 8 to 160 characters.')
  const raw = Array.isArray(body.options) ? body.options : []
  const options = Array.from(new Set(raw.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)))
  if (options.length < POOL_OPTIONS_MIN || options.length > POOL_OPTIONS_MAX || options.some((o) => o.length > 100)) {
    throw new ApiError(400, 'invalid_options', `Give ${POOL_OPTIONS_MIN} to ${POOL_OPTIONS_MAX} different answers, each up to 100 characters.`)
  }
  await seedIfEmpty()
  const db = await getDb()
  const id = `c-${randomToken(6)}`
  await db.query(
    `insert into question_pool (id, theme, question, options, sort_order)
     values ($1, $2, $3, $4::jsonb, (select coalesce(max(sort_order), 0) + 1 from question_pool))`,
    [id, theme, question, JSON.stringify(options)],
  )
  return { id, theme, question, options }
}

export async function setPoolQuestionActive(body: Record<string, unknown>): Promise<void> {
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id || typeof body.active !== 'boolean') throw new ApiError(400, 'invalid_request', 'Send { id, active }.')
  const db = await getDb()
  const { rows } = await db.query('update question_pool set active = $2 where id = $1 returning id', [id, body.active])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such question.')
}
