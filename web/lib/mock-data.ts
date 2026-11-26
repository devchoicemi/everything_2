import { BOOKING_SLOTS, formatSlotLabel } from '@/lib/booking'
import type {
  CalendarEvent,
  DateBooking,
  Match,
  Profile,
  SessionUser,
  Venue,
} from '@/types'

export const DEMO_USER: SessionUser = {
  username: 'Birch_Storm',
  age: 28,
  city: 'Helsinki',
  intent: 'Serious relationship',
  verified: true,
  trustTier: 1,
  profileScore: 72,
}

/**
 * Compatibility percentages are NOT stored here any more — they come live
 * from the real self-vs-ideal engine (`GET /api/compatibility/[a]/[b]`),
 * seeded per profile in lib/compat/seed.ts. Likewise there is no `quiz`
 * field on a profile: the read-verification gate's questions/answers live
 * server-side only (lib/verification/bank.ts) so the correct answer is never
 * shipped to the client.
 */
export const PROFILES: Profile[] = [
  {
    id: 1,
    un: 'Maple_Dusk',
    age: 28,
    city: 'Helsinki',
    av: 'M',
    avc: '#534AB7',
    intent: 'Serious relationship',
    headline:
      '"Finds comfort in early mornings and the kind of conversations that make you forget what time it is."',
    about:
      'I value depth over volume in most things — friendships, work, and especially in people. I am a slow traveller who prefers one place done properly over five places rushed. I cook for people I care about, I read more than I watch.',
    ls: ['Introvert', 'Non-smoker', 'Morning person', 'No children', 'Vegetarian'],
    ds: 'Early-afternoon coffee · Quiet café · No nightlife',
    tags: ['Reading', 'Cafés & coffee', 'Museums', 'Cinema'],
    hl: [
      { i: 'chat', t: 'Shared value: depth and genuine conversation over small talk' },
      { i: 'coffee', t: 'Both prefer quiet, calm venues for a first meeting' },
      { i: 'leaf', t: 'Similar lifestyle pace — neither wants to rush anything' },
    ],
    ans: [
      { q: 'Are you more introvert or extrovert?', a: 'Introvert — I recharge alone' },
      { q: 'How do you calm down after a stressful day?', a: 'Time alone — quiet, music, or a walk' },
      { q: 'Perfect vacation?', a: 'Cultural exploration — cities, museums, history' },
      { q: 'How do you handle conflict?', a: 'Take space first, then come back to it' },
      { q: 'How important is faith?', a: 'Spiritually curious but not attached to a religion' },
      { q: 'Independence needed in a relationship?', a: 'A fair amount — balance matters' },
    ],
  },
  {
    id: 2,
    un: 'Cedar_Mist',
    age: 31,
    city: 'Helsinki',
    av: 'C',
    avc: '#C026D3',
    intent: 'Long-term dating',
    layout: 'bloom',
    headline:
      '"Fuelled by good espresso, honest people, and long walks that turn into long conversations."',
    about:
      'Finnish-born, world-curious. I work in architecture and spend most weekends at the climbing gym or obsessively trying new coffee spots. I am direct, I laugh easily, and I genuinely enjoy the getting-to-know-you stage.',
    ls: ['Ambivert', 'Occasional drinker', 'Active / sporty', 'No children', 'Non-smoker'],
    ds: 'Coffee or outdoor walk · Casual · Afternoon',
    tags: ['Climbing', 'Cafés & coffee', 'Travel', 'Cycling'],
    hl: [
      { i: 'active', t: 'Both enjoy staying active — walking, outdoors, movement' },
      { i: 'talk', t: 'Direct communication styles — no guessing games' },
      { i: 'pin', t: 'Both Helsinki-based — easy to coordinate' },
    ],
    ans: [
      { q: 'Morning person or night owl?', a: 'Somewhere in the middle' },
      { q: 'How do you handle conflict?', a: 'Talk it through calmly as soon as possible' },
      { q: 'Perfect vacation?', a: 'A mix — discover by day, rest by evening' },
      { q: 'Do you love travelling?', a: 'Travel is one of my greatest passions' },
      { q: 'How health-conscious are you?', a: "Fairly — I try but I'm not strict" },
    ],
  },
  {
    id: 3,
    un: 'River_Ash',
    age: 26,
    city: 'Espoo',
    av: 'R',
    avc: '#A86212',
    intent: 'Serious relationship',
    layout: 'sidebar',
    headline: '"Quiet at first, vivid once comfortable. Worth the patience."',
    about:
      'I am a reader, a slow runner, and someone who takes a while to open up fully — but worth the wait. I believe a great relationship is built on genuine curiosity about each other, not performance.',
    ls: ['Introvert', 'Non-smoker', 'Non-drinker', 'Has children', 'Early riser'],
    ds: 'Outdoor walk or quiet café · Early afternoon',
    tags: ['Reading', 'Running', 'Volunteering'],
    hl: [
      { i: 'book', t: 'Both are readers who value depth in conversation' },
      { i: 'walk', t: 'Preference for low-key, outdoor or quiet first dates' },
      { i: 'curious', t: 'Shared value: patience and genuine curiosity about people' },
    ],
    ans: [
      { q: 'Do you forgive easily?', a: 'I forgive, but it takes time and effort' },
      { q: 'How important is faith?', a: 'Very important — it shapes how I live' },
      { q: 'Introvert or extrovert?', a: 'Introvert — I recharge alone' },
      { q: 'How do you show affection?', a: 'Actions — I do things to show I care' },
      { q: 'Romantic evening?', a: 'A quiet dinner, good conversation, no distractions' },
    ],
  },
  {
    id: 4,
    un: 'Storm_Pine',
    age: 33,
    city: 'Helsinki',
    av: 'S',
    avc: '#4A42A8',
    intent: 'Marriage-minded',
    headline: '"Looking for the last first date I ever need."',
    about:
      'I am a civil engineer who spends too much time thinking about bridges and not enough crossing them. I am warm, a little intense about things I care about, and genuinely looking for something real.',
    ls: ['Ambivert', 'Non-smoker', 'Social drinker', 'No children', 'Wants children'],
    ds: 'Restaurant or cultural venue · Evening · Relaxed',
    tags: ['Cinema', 'Cafés & coffee', 'Travel', 'Board games'],
    hl: [
      { i: 'serious', t: 'Same relationship intent — both looking for something serious' },
      { i: 'family', t: 'Shared view on family: both want children in the future' },
      { i: 'chat', t: 'Values honesty and directness in communication' },
    ],
    ans: [
      { q: 'Emotional vulnerability?', a: 'I open up fairly easily once I feel safe' },
      { q: 'Do you believe in soulmates?', a: 'Maybe — certain people are meant to meet' },
      { q: 'Financial compatibility?', a: 'Very important — different money values create real problems' },
      { q: 'How many children?', a: 'One or two — a small family' },
      { q: 'How do you show affection?', a: 'Words — I express how I feel directly' },
    ],
  },
]

/** Profiles that like you back — a "yes" here triggers the match celebration. */
// 1 and 2 are also pre-seeded matches (kept for the existing demo). 4 is
// deliberately NOT a pre-seeded match id, so liking Storm_Pine is the
// reachable path to see a genuinely new match land in the Matches list end
// to end. 3 is excluded on purpose — PROFILES and MATCHES are separate seed
// lists that happen to share an id range, and id 3 already names a different
// person in each (River_Ash the Discover profile vs. Birch_Vale the seeded
// match) — using it here would silently collide in addMatch's dedup check.
export const MUTUAL_PROFILE_IDS = [1, 2, 4]

export const MATCHES: Match[] = [
  {
    id: 1,
    un: 'Maple_Dusk',
    age: 28,
    city: 'Helsinki',
    av: 'M',
    avc: '#534AB7',
    hl: 'Both prefer quiet, unhurried dates and genuine conversation',
    matched: '2 days ago',
    exp: 5,
    intent: 'Serious relationship',
    why: [
      { i: 'chat', t: 'Shared value: depth and genuine conversation' },
      { i: 'coffee', t: 'Both prefer quiet venues for a first meeting' },
    ],
    ans: [
      { q: 'Introvert or extrovert?', a: 'Introvert — I recharge alone' },
      { q: 'Calm down after stress?', a: 'Time alone — quiet, music, or a walk' },
      { q: 'Perfect vacation?', a: 'Cultural exploration — cities, museums, history' },
      { q: 'Handle conflict?', a: 'Take space first, then come back to it' },
    ],
  },
  {
    id: 2,
    un: 'Cedar_Mist',
    age: 31,
    city: 'Helsinki',
    av: 'C',
    avc: '#C026D3',
    hl: 'Shared love of movement, coffee, and casual first dates',
    matched: '3 days ago',
    exp: 4,
    intent: 'Long-term dating',
    why: [
      { i: 'active', t: 'Both enjoy staying active — walking, outdoors, movement' },
      { i: 'talk', t: 'Direct communication styles — no guessing games' },
    ],
    ans: [
      { q: 'Morning person or night owl?', a: 'Somewhere in the middle' },
      { q: 'Handle conflict?', a: 'Talk it through calmly as soon as possible' },
      { q: 'Perfect vacation?', a: 'A mix — discover by day, rest by evening' },
    ],
  },
  {
    id: 3,
    un: 'Birch_Vale',
    age: 29,
    city: 'Vantaa',
    av: 'B',
    avc: '#8B3520',
    hl: 'Similar values and a preference for intentional connections',
    matched: '5 days ago',
    exp: 2,
    intent: 'Long-term dating',
    why: [
      { i: 'casual', t: 'Both believe in building slowly and with intention' },
      { i: 'book', t: 'Shared interest in reading and reflective conversations' },
    ],
    ans: [
      { q: 'How important are values in a partner?', a: 'Absolutely essential — non-negotiable' },
      { q: 'Independence needed?', a: 'A fair amount — balance between togetherness and freedom' },
    ],
  },
]

/** Pre-seeded "already matched" ids — bridged into the real gate the first time they're touched. See docs/VERIFICATION_GATE_POLICY.md. */
export const LEGACY_MATCH_IDS: string[] = MATCHES.map((m) => String(m.id))

export const VENUES: Venue[] = [
  { n: 'Kaffa Roastery', area: 'Punavuori · 1.2km', type: 'Specialty coffee · Quiet · Recommended', offer: '10% off for ChoiceMi dates' },
  { n: 'Good Life Coffee', area: 'Kruununhaka · 1.8km', type: 'Third-wave coffee · Calm', offer: 'Free refill on first date' },
  { n: 'Café Regatta', area: 'Töölö · 2.1km', type: 'Lakeside café · Cosy · Romantic', offer: 'Complimentary pastry' },
  { n: 'Fazer Café', area: 'Kluuvi · 0.9km', type: 'Classic Finnish café · Central', offer: '10% off for ChoiceMi dates' },
]

export const CAL_EVENTS: Record<string, CalendarEvent> = {
  '2026-3-29': { type: 'confirmed', label: 'Coffee with Cedar_Mist', color: '#EC4899' },
  '2026-4-2': { type: 'pending', label: 'Dinner with Storm_Pine', color: '#A86212' },
  '2026-3-15': { type: 'past', label: 'Coffee with Maple_Dusk', color: '#9E9D94' },
  '2026-3-6': { type: 'past', label: 'Café with River_Ash', color: '#9E9D94' },
}

export const DATE_BOOKINGS: Record<'upcoming' | 'pending' | 'past', DateBooking[]> = {
  upcoming: [
    {
      id: 1,
      un: 'Cedar_Mist',
      age: 31,
      av: 'C',
      avc: '#C026D3',
      date: 'Sat 29 March',
      time: '1:30pm',
      venue: 'Kaffa Roastery',
      varea: 'Punavuori · 1.2km',
      type: 'Afternoon coffee',
      atmo: 'Quiet · Casual',
      status: 'confirmed',
      offer: {
        title: 'ChoiceMi Date Offer',
        desc: 'Show this screen for 10% off your order — valid today only',
      },
    },
  ],
  pending: [
    {
      id: 2,
      un: 'Storm_Pine',
      age: 33,
      av: 'S',
      avc: '#4A42A8',
      date: 'Wed 2 April',
      time: '6:30pm',
      venue: 'Restaurant Löyly',
      varea: 'Hernesaari · 2.8km',
      type: 'Restaurant dinner',
      atmo: 'Romantic · Lively',
      status: 'pending',
      offer: null,
    },
  ],
  past: [
    {
      id: 3,
      un: 'Maple_Dusk',
      age: 28,
      av: 'M',
      avc: '#534AB7',
      date: 'Sat 22 March',
      time: '1:00pm',
      venue: 'Kaffa Roastery',
      varea: 'Punavuori',
      type: 'Afternoon coffee',
      atmo: 'Quiet',
      status: 'past',
      offer: null,
      fdone: false,
    },
    {
      id: 4,
      un: 'River_Ash',
      age: 26,
      av: 'R',
      avc: '#A86212',
      date: 'Thu 6 March',
      time: '2:00pm',
      venue: 'Café Regatta',
      varea: 'Töölö',
      type: 'Casual café',
      atmo: 'Cosy',
      status: 'past',
      offer: null,
      fdone: true,
    },
  ],
}

/** 12:00pm–7:00pm venue-local, same list the server enforces — see lib/booking.ts. */
export const PROPOSE_TIMES: string[] = BOOKING_SLOTS.map(formatSlotLabel)
export const PROPOSE_TIME_VALUES: readonly string[] = BOOKING_SLOTS

/** The match a fresh proposal is addressed to in the pilot demo, keyed by id so /dates/propose?matchId= can resolve any match. */
export const PROPOSE_TARGET = {
  un: 'Maple_Dusk',
  av: 'M',
  avc: '#534AB7',
  intent: 'Serious relationship' as const,
  styleAlignment: 91,
  styleNote: 'Both prefer coffee and a quiet, unhurried atmosphere',
}
