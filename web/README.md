# ChoiceMi Web — Main App

The compatibility-first blind-dating web app. No photos, no pre-date chat — read the
person, pass the read-check, meet for real. This package is the **web / main app**
surface. Restaurant portal, admin dashboard and the mobile wrap come next.

Built to `choicemi-full.html` (visual reference) and
`ChoiceMi_Compatibility_Scoring_Logic.md` (confirmed scoring model — implemented
exactly, see `docs/`).

---

## Stack

| Layer        | Choice                                             |
| ------------ | ------------------------------------------------- |
| Framework    | Next.js 15 + React 19 (App Router) — App + **Route Handlers as a real backend** |
| Language     | TypeScript (strict)                              |
| Styling      | Tailwind CSS + CSS custom-property design tokens |
| State        | Zustand (single sliced store)                    |
| Animation    | Framer Motion + CSS keyframes                    |
| Icons        | lucide-react                                     |
| Fonts        | DM Serif Display + Outfit (self-hosted, `app/fonts/`) |
| Backend data | File-backed JSON store (`lib/server/jsonStore.ts`) — see below |
| Tests        | Vitest (`lib/**/*.test.ts`)                       |

---

## Quick start

```bash
npm install
npm run dev         # http://localhost:3000
npm run build
npm run typecheck
npm run test         # vitest
```

---

## This is a real backend, not a mock

Compatibility scoring, the profile-reading verification gate, date proposals and
AI profile drafting are served by this app's own **Next.js Route Handlers**
under `app/api/*` — genuine server-side logic and persistence, not client-side
stubs:

| Route | What it does |
| --- | --- |
| `GET /api/compatibility/[a]/[b]` | Self-vs-ideal compatibility engine — `lib/compat/engine.ts` |
| `GET/POST /api/profile/variables` | Save a user's self/ideal/weight/dealbreaker inputs |
| `POST /api/verification/[targetId]/start` | Begin/resume a read-check attempt (refresh-proof) |
| `POST /api/verification/[targetId]/answer` | Server-validated answer, retry/block logic |
| `GET /api/verification/[targetId]/status` | Read-only gate status check |
| `GET/POST /api/profile/gate-questions` | Owner-authored read-check question bank |
| `POST /api/dates/propose` | Booking-hour + gate enforcement, no message field |
| `POST /api/ai/profile-draft` | Secure, rate-limited AI-assisted bio drafting |

Persistence is `lib/server/jsonStore.ts` — a small file-backed store under
`.data/` (gitignored) with serialised, concurrency-safe writes. It's a
deliberate, documented placeholder for Postgres/Supabase, sized for the pilot:
swap `readTable`/`mutateTable` for real queries when that's ready. Session
identity is an anonymous httpOnly cookie (`lib/server/session.ts`) — the one
thing to swap for real auth.

**Four things were left open by the spec / requirements on purpose** — see
`docs/OPEN_QUESTIONS.md`, `docs/COMPATIBILITY_DECISIONS.md` and
`docs/VERIFICATION_GATE_POLICY.md` for exactly what was decided, why, and what
still needs a product call.

---

## Routes

| Path                       | Screen |
| -------------------------- | ------ |
| `/`                        | Landing / splash + how-it-works   |
| `/verify` → `/verify/otp`  | Sign-up + identity check          |
| `/onboarding?step=1..6`    | Identity → Story+AI draft → Compatibility → Read-check questions → Date prefs → Filters |
| `/ready`                   | Identity ready                    |
| `/discover`                | Card stack → full profile (live scores) → read-check → match celebration |
| `/matches` / `/matches/[id]` | Mutual matches (live scores) + detail |
| `/dates`                   | Calendar + date list              |
| `/dates/propose?matchId=`  | Propose a blind date — no message field, 12pm–7pm only |
| `/dates/feedback/[id]`     | Post-date feedback (private, one-way — not chat) |
| `/profile`                 | My profile + settings             |

The `/discover` full-profile view and read-check are rendered **inline** (not
separate routes) so the feed cursor and card-stack state survive.

---

## Responsive behaviour

Full-width desktop web app that collapses to a mobile layout — not a phone
mock-up. References: Hinge (editorial calm), Bumble (warmth), Tinder (bold,
card-based feel — swipe-to-pass on Discover, `useReducedMotion`-aware).

| Surface            | Desktop (≥ 1024)                                   | Mobile (< 1024)                  |
| ------------------- | -------------------------------------------------- | --------------------------------- |
| Marketing (`/`)     | Full-bleed sections, sticky glass nav               | Single column, hamburger menu     |
| App (discover…)     | 264px sidebar + fluid content, right rail           | Sticky top bar + bottom nav       |
| Auth / onboarding   | Split screen: teal brand panel + form panel         | Stacked, form only                |

---

## Design tokens & logo

Colours, radii, shadows and typography live as CSS custom properties in
`app/globals.css`, mirrored in `tailwind.config.ts`. `components/ui/Logo.tsx`
is wired to auto-detect `public/brand/logo.svg` / `.png` the moment it's
added — see `public/brand/README.md`. Until then it renders the existing "C"
letter mark unchanged.

---

## Tests

```bash
npm run test
```

Covers: the compatibility engine against the spec's own worked examples
(§8.1/§8.2), dealbreaker-cap validation, booking-hour boundaries, the
"no message field" propose guard, and the full verification-gate lifecycle
(correct/wrong/retry/exhaustion/refresh/concurrent — `lib/verification/gate.test.ts`).

---

## Not yet wired (pilot follow-ups)

- Real identity verification provider + callback
- Selfie liveness (AWS Rekognition / Azure Face)
- A real database in place of the file-backed store
- Real accounts in place of the anonymous session cookie
- Push notifications (FCM)
- `next-pwa` service worker for offline + installability
- Stripe / IAP for Plus & Elite tiers
