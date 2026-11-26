# ChoiceMi backend plan

Working checklist. Tick items as they ship. `[exists]` means a route handler already exists in `app/api` but is backed by a JSON file store and a cookie id (demo grade). `[new]` means nothing exists yet.

## 1. Architecture (recommended defaults)

- API: Next.js route handlers under `/api/v1/*`, deployed on Vercel in an EU region (`fra1` or `arn1`). One deploy for web and API.
- Database: managed Postgres in the EU (Neon or Supabase, Frankfurt or Stockholm). ORM: Drizzle or Prisma. The current `.data/*.json` store does not survive Vercel's serverless filesystem and must go.
- Identity: Signicat (Finnish Trust Network) via OpenID Connect. Our own httpOnly session cookie after login. We do not use a second auth provider for members.
- Jobs: Vercel Cron for daily feed, expiries, reminders, retention purge.
- Email: Resend or Postmark (EU data region). Push: FCM for the Android app.
- Payments: Stripe, later (paid tiers launch after the pilot).
- Mobile: the network APK talks to this API. The standalone APK becomes a demo only once data lives on a server.

## 2. Signicat setup (dashboard.signicat.com, account `ChoiceMi-Sandbox`)

Sandbox already exists. Production is a separate account (see step 10).

1. Domain: Settings, Domains. Note your Signicat domain. All Signicat URLs hang off it.
2. Enable the Finnish eIDs: Products, eID and Wallet Hub, eIDs, add **Finnish eIDs (FTN)**. One agreement covers all Finnish bank IDs plus Mobiilivarmenne (Mobile ID), which matches the "Bank login / Mobile ID" choice on the verify screen.
3. Create the OIDC client: Products, eID and Wallet Hub, OIDC clients, Create client. Name `choicemi-web`, grant type Authorization Code (with PKCE).
4. Redirect URIs (exact match): `http://localhost:3000/api/v1/auth/signicat/callback`, your Vercel preview URL, and later the production domain.
5. Scopes: request `openid profile`. Do NOT request `nin` or `ftn-extra` (they return the Finnish personal identity code, see section 6).
6. Encrypted responses: FTN requires them. Generate an RSA key pair, upload the public key (JWK) to the client, keep the private key in a server secret.
7. Copy the client id, client secret and the OIDC discovery URL from the client page into Vercel environment variables (never into the repo).
8. Optional API client (Settings or Get started, API clients): only needed for Signicat server-to-server products such as Data Verification. Not needed for plain login.
9. Test the flow: use "Test in Dashboard" for FTN, then our own `/api/v1/auth/signicat/start`. Confirm exactly which claims come back (sub, birthdate, bank name) before coding the mapping.
10. Production: sales contact (the "Talk to sales" button). Signicat needs a signed agreement plus a data processing agreement (DPA), then a production account with its own domain and client. Start this early; it is the longest lead time.
11. Branding (menu: Branding): put the ChoiceMi logo and colours on the hosted login pages.

Signicat docs: [FTN OIDC guide](https://developer.signicat.com/identity-methods/ftn/integration-guide/oidc-ftn/), [OIDC client setup](https://developer.signicat.com/docs/eid-hub/oidc/oidc-client/), [FTN attributes](https://developer.signicat.com/identity-methods/ftn/attributes-reference/), [test in dashboard](https://developer.signicat.com/identity-methods/ftn/test/).

## 3. Data model (tables)

users, identities (signicat_sub, idp, loa, verified_at), sessions, profiles, profile_variables, gate_questions, gate_attempts, daily_picks, likes, passes, matches, date_proposals, dates, venues, venue_slots, venue_offers, venue_staff, feedback, reports, blocks, notifications, devices, notification_prefs, waitlist, invites, consents, subscriptions, admin_users, audit_log, privacy_requests.

Store from Signicat: the pseudonymous `sub`, date of birth (to compute 18+), the bank/IdP name, verification time. Do not store the real name or the personal identity code.

## 4. API list

Base path `/api/v1`. Auth: member session unless marked public, partner or admin.

### A. Waitlist and invites (public)
- [ ] POST /waitlist (email, consent text and version, timestamp; replaces FormSubmit)
- [ ] GET /waitlist/confirm?token (double opt-in)
- [ ] DELETE /waitlist?token (unsubscribe link in every email)
- [ ] POST /auth/redeem-invite (pilot is invite only)

### B. Auth (Signicat)
- [ ] GET /auth/signicat/start?mode=signup|signin (state, nonce, PKCE, redirect)
- [ ] GET /auth/signicat/callback (decrypt, verify, 18+ check, create or find user, set session)
- [ ] GET /auth/session (current member and onboarding status)
- [ ] POST /auth/logout
- [ ] Decision: drop the phone OTP screen (bank ID already proves the person), or keep it only for notifications.

### C. Account, consent, GDPR
- [ ] GET and PATCH /me
- [ ] POST /me/consents (marketing, special-category data, AI drafting), GET /me/consents
- [ ] GET /me/export (access and portability)
- [ ] DELETE /me (erasure, with grace period)
- [ ] POST /me/pause and /me/resume (hide profile)

### D. Profile and onboarding
- [ ] PUT /profile/identity (gender, interested in, city, intent)
- [ ] PUT /profile/story (headline, about, lifestyle, profession, layout)
- [ ] POST /ai/profile-draft [exists]
- [ ] GET and POST /profile/variables [exists]
- [ ] GET and POST /profile/gate-questions [exists]
- [ ] PUT /profile/date-preferences (types, atmosphere, best time, safety)
- [ ] PUT /profile/filters (age range, distance, dealbreakers)
- [ ] POST /profile/publish (completeness check, makes the profile discoverable)
- [ ] GET /profile/me

### E. Discover
- [~] GET /discover (`/api/v1/discover`): real members, orientation both ways, best first. Still to do: age and distance filters, blocks, already seen, daily batch, plan limit
- [ ] GET /discover/profile/:id (public view, includes layout, never private fields)
- [x] POST /members/:id/pass (`/api/v1/members/[id]/pass`)
- [x] POST /members/:id/like (server checks the read-check was passed; returns `mutual`, `matchId`, `score`)

### F. Compatibility and read-check
- [x] GET /compatibility/{userId} for the signed-in member, on Postgres and accounts (`/api/v1/compatibility/[userId]`); saving inputs at PUT /me/compatibility
- [ ] batch compatibility for a list of ids (the feed already scores in bulk)
- [x] Read-check on accounts and Postgres: `/api/v1/members/:id/read-check`, `/start`, `/answer` (the old anonymous `/api/verification/*` is offline-app only)

### G. Matches
- [x] GET /matches, GET /matches/:id
- [x] POST /matches/:id/unmatch
- [~] Matches expire after 7 days without a proposal (checked when read; no scheduled job yet)

### H. Venues (restaurants) and dates
- [x] GET /venues
- [x] GET /venues/:id/slots?date (12:00 to 19:00 local slots with capacity)
- [x] POST /dates/propose (no message field by design)
- [x] GET /dates (upcoming, pending, past; the calendar is built from it)
- [x] POST /dates/:id/accept, /decline, /cancel (reschedule: not yet)
- [ ] GET /dates/:id/offer and a redemption code
- [x] POST /dates/:id/feedback (structured answers and stars, no free text) and POST /dates/:id/redate (mutual re-date reopens the match)
- [~] Proposal expiry (48 h) is applied when read; reminders (24 h and 2 h), feedback prompt, no-show detection still to build

### I. Safety
- [ ] POST /reports (profile, date, behaviour), GET /reports/mine
- [ ] POST /blocks, GET /blocks, DELETE /blocks/:id
- [ ] Trust score from attendance and feedback (computed, read via /me)

### J. Notifications
- [ ] GET /notifications, POST /notifications/:id/read
- [ ] POST /devices (FCM token), DELETE /devices/:id
- [ ] GET and PATCH /notification-prefs
- [ ] Email templates: match, proposal, accepted, reminders, feedback, waitlist confirm

### K. Billing (after the pilot)
- [ ] GET /plans, GET /entitlements
- [ ] POST /billing/checkout, POST /billing/portal
- [ ] POST /webhooks/stripe (public, signature verified)

### L. Restaurant partner portal (`/partner`)
- [x] Partner sign-in (invitation, password and emailed code) and GET /partner/me
- [x] GET /partner/bookings?from=&to= (bookings by anonymous name; never real names)
- [x] POST /partner/bookings/:id/arrived, /no-show, /cancel and POST /partner/redeem (guest offer code)
- [x] GET and PUT /partner/availability (open days, start times, tables per time), POST and DELETE /partner/closures
- [x] GET and PUT /partner/profile (area, address, offer text), POST /partner/status (go live, pause)
- [x] GET /partner/stats, and the team: GET /partner/team, POST /partner/team/invite, DELETE /partner/team/:id
- [x] Restaurants asking to join (POST /partner/apply) and admin approval (/admin/partners): see AUTH_API.md
- [ ] Magic-link sign-in for partners (they use password and code for now), reminders to venues, payouts

### M. Admin (`/admin`, staff only, every action audit-logged)
- [ ] Staff login (SSO) with roles: admin, moderator, support, venue manager
- [ ] GET /admin/users, GET /admin/users/:id, POST /admin/users/:id/suspend|reinstate|ban
- [ ] GET /admin/reports, POST /admin/reports/:id/resolve
- [ ] GET /admin/profiles/flagged, POST /admin/profiles/:id/review (text moderation)
- [ ] CRUD /admin/venues, /admin/venues/:id/offers, /admin/venues/:id/staff
- [ ] GET /admin/dates, POST /admin/dates/:id/cancel (disputes)
- [ ] GET /admin/waitlist (list, export), POST /admin/waitlist/invite, POST /admin/invites
- [ ] GET /admin/privacy-requests, POST /admin/privacy-requests/:id/complete
- [ ] GET /admin/metrics (signups, matches, dates, no-show rate)
- [ ] GET and PUT /admin/config (daily limit, booking window, cities)
- [ ] GET /admin/audit-log

### N. System
- [ ] GET /health, structured logging, error tracking
- [ ] Rate limiting on every public and write route, idempotency keys on writes
- [ ] Cron: daily feed (06:00 Helsinki), expiries, reminders, retention purge

## 5. Suggested order

0. Foundations: Postgres, migrations, env and secrets, sessions, rate limit, logging, EU region.
1. Waitlist (A). The coming-soon page is live and collecting emails today through a third-party form service.
2. Signicat login (B) plus invite codes.
3. Profile and onboarding persistence (D, C consents).
4. Read-check and compatibility on the database (F).
5. Discover, like, pass, matches (E, G).
6. Venues, slots and dates (H), with a minimal admin for venues.
7. Notifications (J).
8. Safety and GDPR tools (I, C).
9. Partner portal (L).
10. Full admin (M).
11. Billing (K).
12. Hardening and production Signicat go-live.

## 6. Legal and compliance flags

- Done: all "Suomi.fi" wording is removed from the site. The identity verification method itself is still to be chosen, so the Signicat steps above assume the Finnish Trust Network and may change.
- Done: the "Finnish residents only" claim is removed. Add a residency check later if it becomes a rule.
- The Finnish personal identity code is restricted by Finnish law. Do not request or store it.
- Special-category data (GDPR Art. 9): who you are interested in (sexual orientation), religion and faith answers. Needs explicit consent and a DPIA.
- "Liveness-checked selfie" on the site means biometric processing (also Art. 9). Either build it with explicit consent, or remove the claim.
- AI profile drafting sends member text to Anthropic. Disclose it, get consent, sign their DPA, and cover the transfer outside the EU.
- Waitlist today goes through FormSubmit, a third-party processor. Replace with API A and update the privacy policy.
- Need before real members: privacy policy and terms naming Signicat, hosting, email and AI processors; cookie consent; 18+ enforcement from birthdate; retention periods; a process for access and erasure requests.
