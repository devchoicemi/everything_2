export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAdmin } from '@/lib/server/auth/admin'
import { addPoolQuestion, listPool, setPoolQuestionActive } from '@/lib/server/questionPool'

/** Admin. Bearer ADMIN_TOKEN. GET lists active pool questions. */
export const GET = route(async (req) => {
  await requireAdmin(req)
  return json({ questions: await listPool() })
})

/** Body: { theme, question, options: [3 or 4 suggested answers] } adds a question to the pool. */
export const POST = route(async (req) => {
  await requireAdmin(req)
  return json({ question: await addPoolQuestion(await readJson(req)) }, { status: 201 })
})

/** Body: { id, active } retires or restores a question (members who already picked it keep it). */
export const PATCH = route(async (req) => {
  await requireAdmin(req)
  await setPoolQuestionActive(await readJson(req))
  return json({ ok: true })
})
