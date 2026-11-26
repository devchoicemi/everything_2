/**
 * Real accounts are used everywhere except the offline Android build, which has no server and keeps
 * its own demo members, matches and dates in the app.
 */
export const LIVE = process.env.NEXT_PUBLIC_STANDALONE !== '1'
