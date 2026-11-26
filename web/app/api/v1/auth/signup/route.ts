export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { describeSession, signUp } from '@/lib/server/auth/service'

export const POST = route(async (req) => {
  const { user, cookie } = await signUp(req, await readJson(req))
  return json(describeSession(user), { status: 201, cookies: [cookie] })
})
