/**
 * The anonymous demo endpoints under /api (read-check, date proposals, gate questions, scoring by id)
 * exist for the offline Android app, which runs them inside the app with no accounts. On the real
 * server, members use the account-based /api/v1 endpoints instead, so these answer 404 and never touch
 * the file store.
 */
export const OFFLINE_APP = process.env.NEXT_PUBLIC_STANDALONE === '1'

export function offlineOnly(): Response | null {
  if (OFFLINE_APP) return null
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
}
