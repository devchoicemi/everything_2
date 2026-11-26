export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { answerReadCheck } from '@/lib/server/social/readCheck'

export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('readcheck-answer', user.id, 300, 3600)
  const body = await readJson<{ questionId?: unknown; selectedOption?: unknown }>(req)
  if (typeof body.questionId !== 'string' || typeof body.selectedOption !== 'string') {
    throw new ApiError(400, 'invalid_request', 'questionId and selectedOption are required.')
  }
  return json(await answerReadCheck(user, pathAfter(req, 'members'), body.questionId, body.selectedOption))
})
