# Auth API

Sign-up, sign-in, sessions, password reset, email confirmation, account deletion and the Signicat identity-verification flow. Built, tested, and ready: the only things left to add are your **email provider key** and your **Signicat credentials**.

Code: `web/app/api/v1/**` (thin routes), `web/lib/server/auth/**` (logic), `web/lib/server/db/**` (Postgres). Screens: `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify` (Signicat page), `/verify/result`.

## How it works

- **Accounts** live in PostgreSQL (`users`). Passwords are hashed with scrypt (32 MiB, per-user salt). Nothing reversible is stored.
- **Sessions** are a random 256-bit token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`cm_auth`, 30 days). Only the SHA-256 of the token is stored, so a database leak cannot be replayed as logins. Sign-out revokes the row server-side.
- **CSRF**: every POST/DELETE is refused if its `Origin` is not this site, on top of `SameSite=Lax`.
- **Brute force**: limits per IP, per email, and per IP+email pair, kept in Postgres (works across restarts). Wrong password and unknown email give the same answer and take the same time.
- **Password reset** never reveals whether an email has an account; a successful reset signs the user out everywhere.
- **Erasure**: `DELETE /me` removes the account and everything attached (sessions, identities, tokens).
- **Gates**: what a member must finish before using the app switches on by itself when you add a connector:
  - email confirmation, once email delivery is configured;
  - identity verification, once Signicat is configured.
  Override with `REQUIRE_EMAIL_VERIFICATION` / `REQUIRE_IDENTITY` (`1` or `0`).

## Endpoints

All under `/api/v1`. JSON in, JSON out. Errors look like `{"error":{"code","message","fields?"}}`.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `email, password, acceptTerms:true, over18:true` | 201, signs in, sends confirmation mail. 409 `email_taken`, 400 `weak_password` etc. |
| POST | `/auth/login` | `email, password` | 401 `invalid_credentials`, 429 `rate_limited` |
| POST | `/auth/logout` | — | ends this session |
| POST | `/auth/logout-all` | — | ends every session |
| GET | `/auth/session` | — | `{authenticated, user?, next?, requirements, config}`; `next` is `verify_email`, `verify_identity` or `continue` |
| POST | `/auth/email/verify` | `token` | link from the email |
| POST | `/auth/email/resend` | — | signed in; 3 per hour |
| POST | `/auth/password/forgot` | `email` | always 200 |
| POST | `/auth/password/reset` | `token, password` | single use, 1 hour |
| POST | `/auth/password/change` | `currentPassword, newPassword` | signed in; keeps only this session |
| GET | `/me` | — | the signed-in user |
| DELETE | `/me` | `password` | erase my account |
| POST | `/auth/signicat/start` | `returnTo?` | signed in; returns `{authorizeUrl}` |
| GET | `/auth/signicat/callback` | `?code&state` | Signicat redirects the browser here; then → `/verify/result` |

Password rules: 10–128 characters, not a common password, not containing the email name.

## Database

`DATABASE_URL` selects the engine:

| Value | Use |
|---|---|
| `postgres://user:pass@host:5432/db` | production (add `DATABASE_SSL=1` for a managed database that requires TLS) |
| `pglite://memory` or `pglite://./.data/pgdata` | local development and tests only (refused in production) |
| unset, not production | PGlite in `./.data/pgdata` |

Migrations (`lib/server/db/migrations.ts`) run automatically on first connection and are recorded in `schema_migrations`. Add new ones to the end of the list; never edit a shipped one.

Tables: `users`, `identities`, `sessions`, `email_tokens`, `oidc_flows`, `rate_limits`, `auth_events` (a security log: sign-ups, logins, failures, resets, with IP and user agent; prune it on your retention schedule, 90 days suggested).

## Email

Mail goes out through **AhaSend** (or Resend, kept as an alternative). `MAIL_PROVIDER=ahasend|resend` chooses; if it is unset, AhaSend is used once its key and account id are set. Until a provider is fully set, mails are not sent in production, and in development they print to the console and are kept in memory. To use another provider, change only `lib/server/auth/mailer.ts`.

Settings (server `.env`): `MAIL_FROM` (for example `ChoiceMi <no-reply@choicemi.com>`, on a domain you verified), `AHASEND_ACCOUNT_ID`, `AHASEND_API_KEY`. Open and click tracking is switched off on every message, because the links carry one-time tokens and the privacy policy promises no tracking.

### Turning on AhaSend

1. In AhaSend, **Domains** → **Add Domain** → `choicemi.com`. Add the records it shows at your DNS provider:
   - **SPF** (TXT on the root): `v=spf1 include:spf.ahasend.com ~all`. A domain may have only **one** SPF record. If one exists already (Bluehost mail, for example), add `include:spf.ahasend.com` into it instead of creating a second.
   - **DKIM**: the CNAME records AhaSend shows (publish both selectors).
   - **DMARC** (TXT on `_dmarc`): you already have `v=DMARC1; p=none;` from before, which is enough to start.
   - **Return path** (CNAME), if shown: recommended.
   Wait until the domain shows **Verified**.
2. Create an **API key** with permission to send (scope `messages:send:all`, or limited to `choicemi.com`). It starts `aha-sk-`. Also note your **Account ID** (a UUID).
3. On the server, type `~/set-ahasend.sh`, give the account id, paste the key at the hidden prompt. It saves both, switches the provider, restarts the app and runs a sandbox check that sends nothing.
4. `./check-mail.sh` repeats that check any time. Then send one real email: `./invite-waitlist.sh send-to --direct you@example.com`.

### Resend (alternative)

Set `MAIL_PROVIDER=resend`, `RESEND_API_KEY` and `MAIL_FROM`, and verify the domain at resend.com. `~/set-resend-key.sh` does it step by step.

## Signicat: what you add

Everything is built: PKCE authorize URL, state/nonce, single-use callback, token exchange, ID-token decryption (JWE) and signature/issuer/audience/nonce checks, 18+ check, duplicate-identity protection, result page. It is tested against a fake Signicat that encrypts its ID tokens the way Signicat does.

To switch it on, follow `SIGNICAT_VERIFICATION.md` to create the client in the Signicat dashboard, then set these in the server's `.env`:

```
SIGNICAT_DOMAIN=choicemi.app.signicat.com
SIGNICAT_CLIENT_ID=...
SIGNICAT_CLIENT_SECRET=...
SIGNICAT_ENC_PRIVATE_JWK='{"kty":"RSA", ... private key ...}'
```

- Redirect URI to register in Signicat: `https://choicemi.com/api/v1/auth/signicat/callback`
- Generate the encryption key pair with `node web/scripts/gen-signicat-key.mjs`. Upload the **public** key to Signicat (client → Advanced → Public keys, and tick "Encrypt ID tokens"); put the **private** JWK in `.env`.
- Then `./deploy.sh`. The `/verify` page switches from "being connected" to "Verify with bank ID", and identity verification becomes required for new members.

What is kept: the provider's pseudonymous `sub`, the `idp`, an over-18 flag, the time, and the verified legal name (below). Never the national ID, date of birth or the raw token.

### Stored identity data (the legal name)
The verified legal name is stored **encrypted** (AES-256-GCM) in `identities.name_enc`, for security and fraud investigations only. It is never returned by a member-facing API, never shown to other members, and is deleted with the account.
- Key: `IDENTITY_DATA_KEY` in `.env` (32 random bytes, base64). Without it no name is stored. **Back the key up** (password manager): the names cannot be read without it.
- Reading it is an admin action, audited in `auth_events`: `GET /api/v1/admin/identity?email=...` with the admin token.
- Your privacy policy must say what is kept, why (preventing fraud and abuse, protecting members), the lawful basis, who can access it, how long it is kept, and that Signicat is the processor. Decide a retention period (for example, delete 12 months after the account closes) and have it reviewed before launch.

Development without Signicat: set `SIGNICAT_MOCK=1` (ignored in production) and the verify flow completes with a stand-in.

## Tests

`npm test` runs the auth, profile and compatibility tests: sign-up validation and rate limits, login and lock-out, sessions, CSRF, email confirmation, password reset and change, account deletion, the whole identity flow (mock), the OIDC flow against a fake encrypting provider, and the `pg` driver over the Postgres wire protocol.

## Waitlist and invitations (invite-only sign-up)

Sign-up is **invitation-only** while `SIGNUP_MODE=invite` (the default). Set `SIGNUP_MODE=open` to let anyone register.

How it flows:

1. A visitor joins the waitlist on the coming-soon page (`POST /api/v1/waitlist`). Their email and consent are stored in Postgres (`waitlist`), and a welcome email goes out (once Resend is on). Duplicates get the same answer, bots are caught by the hidden field, and one address is rate limited.
2. When you are ready, you send invitations (below). Each person gets a personal, one-time link, `https://choicemi.com/signup?invite=...`, valid 14 days. The link is stored only as a hash.
3. They open the link, the sign-up page fills in their invited email (read-only), and they create their account. Using the link also confirms their email, so they skip that step. Their waitlist row becomes `joined`.
4. Every email carries a signed unsubscribe link (`/waitlist/unsubscribe`) that deletes the person from the waitlist and cancels any open invitation.

Admin API (Bearer `ADMIN_TOKEN`, switched off while the token is unset):

| Method | Path | What |
|---|---|---|
| GET | `/admin/waitlist?status=&limit=&offset=` | counts and entries |
| POST | `/admin/invites` | `{limit?, emails?, allowDirect?, dryRun?}` invite the oldest N waiting people, or specific ones |

You do not need to call it by hand. On the server, in `/opt/choicemi`:

```bash
./invite-waitlist.sh status               # how many are waiting / invited / joined
./invite-waitlist.sh list                 # who
./invite-waitlist.sh preview 10           # who WOULD be invited, nothing sent
./invite-waitlist.sh send 10              # email invitations to the oldest 10
./invite-waitlist.sh send-to a@x.com      # invite specific waitlisted people
./invite-waitlist.sh send-to --direct me@x.com   # invite someone not on the list (e.g. to test)
```

Invitations refuse to send until email is configured, and a failed send leaves the person waiting, not marked invited.

**Automatic invitations.** Set `INVITES_AUTO=1` (and `INVITES_PER_RUN`, default 25) in `.env`. An hourly cron job (`invite-waitlist.sh auto`, already installed) then emails the next batch of waiting people. Leave `INVITES_AUTO=0` until you are ready for people to start joining.

### Turning on Resend

1. In Resend, add the domain `choicemi.com` and add the DNS records it shows (SPF, DKIM, and optionally DMARC) at your DNS provider. Wait until Resend shows "Verified".
2. Create an API key with "Sending access".
3. On the server (keys are typed hidden, so they never land in chat or shell history):
   ```bash
   cd /opt/choicemi
   ./set-env.sh RESEND_API_KEY
   ./set-env.sh MAIL_FROM --show     # e.g. ChoiceMi <no-reply@choicemi.com>
   ./deploy.sh
   ```
4. Test with an address you control: `./invite-waitlist.sh send-to --direct you@example.com` (use `--direct` for people not on the waitlist).
5. Check the invitation arrives, the link opens a pre-filled sign-up page, and the account is created. Then set `INVITES_AUTO=1` (or run `./invite-waitlist.sh send 25` yourself) when you want people in.

Once email is configured, email confirmation also becomes required for people who sign up without an invitation.

## Profile, onboarding and the question pool

- `GET /api/v1/me/profile` returns `{ onboarded, data }`: the profile the member built, saved to their account. `PUT /api/v1/me/profile` with `{ data, complete? }` saves it; `complete: true` finishes setup and needs `data.onboarding.consentSensitive === true`. Only `onboarding`, `compatDraft`, `aiDraft` and `poolPicks` are kept, up to 120 KB.
- The session's `user.onboarded` is what decides where sign-in goes: a member who finished setup lands on Discover; a new one on onboarding. Signing in also copies their saved profile onto the device, and signing out wipes it from the device.
- `GET /api/v1/questions/pool` returns the read-check question pool with suggested answers (signed-in members). It starts from `lib/questions.ts` (30 questions in five themes) and lives in the `question_pool` table.
- Grow it as people use ChoiceMi, with the admin token: `POST /api/v1/admin/questions` with `{ theme, question, options: [3 or 4 suggested answers] }`, `PATCH /api/v1/admin/questions` with `{ id, active }` to retire or restore one, `GET /api/v1/admin/questions` to list. Themes: personality, values, lifestyle, relationship, future.
- A member picks 4 to 5 questions and the answer that is true for them. Readers are shown the pool's other suggested answers as the wrong options, so nobody types anything.

## Compatibility backend (members scored against each other)

Implements `ChoiceMi_Compatibility_Scoring_Logic.md` on the database. The scoring itself is `lib/compat/engine.ts` (unchanged); this adds storage per account and the API around it.

- **Storage:** table `compat_variables` (one row per member and variable: `self`, `ideal`, `weight`, `dealbreaker`). A member is scoreable once all 10 catalog variables are saved.
- `GET /api/v1/me/compatibility` returns my saved inputs and whether they are complete. `PUT /api/v1/me/compatibility` with `{ variables }` replaces them. The server enforces every rule from the spec: weight 10 to 100, at most 2 dealbreakers per category, every option rated, no missing or duplicate variable. Onboarding step 3 saves here.
- `GET /api/v1/compatibility/{userId}` (spec section 10): the final percentage, the per-category percentages, how **my** ratings scored them variable by variable, and how **their** ratings scored me as a **percentage only**. Their individual ratings are never returned. Both members see the same final number.
- `GET /api/v1/discover` returns members I could meet, best first, with their CV profile. Orientation (Men / Women / Everyone) has to suit **both** people. A member's private "what I want in a partner" is not part of their public card. Members I already liked or passed on, and members I am matched with, are left out. Each card carries age, city, intent, headline, "why you might connect" reasons and the member's read-check answers. Not yet: age and distance filters.
- **Before launch** only `admin` and `tester` accounts can browse, and only each other. Ordinary members get 403, and real early members are never shown to testers.
- Every member has a system-generated anonymous `username` (for example `Willow_Dawn`). It is what other members see.
- The `tester` role: like `admin` it skips the pre-launch "You are in" screen, so dating and matching can be tried. Testers appear only to other testers and admins.
- Screen: `/members` (reachable from Profile, "Members (testing view)", for admin and tester accounts).

## Email codes and passkeys

Code: `lib/server/auth/otp.ts`, `lib/server/auth/passkeys.ts`. Tables from migration `0007_otp_passkeys`: `otp_codes`, `passkeys`, `webauthn_challenges`.

- **Confirming the email at sign-up** now uses a 6-digit code. The email carries the code and the old link (either works). A new member lands on `/verify-email`, types the code, and is then offered a passkey (skippable). Where email confirmation is required, even a member who followed an invitation confirms with a code (before, the invitation counted as proof). `POST /api/v1/auth/email/verify` takes `{ token }` (the link) or `{ code }` (the signed-in member); `POST /api/v1/auth/email/resend` sends a new code and link.
- **Signing in with a password** is now two steps for members with a confirmed email. `POST /api/v1/auth/login` with a correct password answers `{ otpRequired: true, challenge, emailHint }` and emails a code, and no session exists yet. `POST /api/v1/auth/login/verify` with `{ challenge, code }` finishes it. `POST /api/v1/auth/login/resend` sends the code again (answers the same whether or not the challenge exists). Someone who has not confirmed their email signs in without a code, so they can confirm it.
- **Code rules:** a code lives 10 minutes and gets 5 wrong tries, then it is dead; a newer code replaces an older one; at most 5 resends per sign-in challenge; only a hash is stored; wrong tries are counted atomically before the code is compared, and a code works once. A sign-in code is tied to a challenge the browser holds, so a code without the password step is useless. If the code email cannot be sent, sign-in answers 503 (it never lets someone in without the code).
- **When codes apply:** by default whenever an email provider is configured (so a code can really be delivered). `AUTH_OTP=1` forces them on (development, tests); `AUTH_OTP=0` switches them off. **Emergency way back in** if mail is down: `ssh` to the server, run `./set-env.sh AUTH_OTP --show` and enter `0`, then `./deploy.sh`. Afterwards run it again with `auto` (anything other than `0` or `1` means the default) and `./deploy.sh`.
- **Passkeys (WebAuthn)** via `@simplewebauthn`. The device keeps the private key; the server keeps the public key. Adding one needs a signed-in member with a confirmed email: `POST /api/v1/auth/passkeys/register/options`, then `.../register/verify` with `{ response, name }`. `GET /api/v1/auth/passkeys` lists mine, `DELETE /api/v1/auth/passkeys/{id}` removes one. Signing in: `POST /api/v1/auth/passkeys/login/options` (no account needed, the device offers its passkeys) then `.../login/verify` with `{ challengeId, response }`. A passkey asks the device to verify the person (fingerprint, face or screen lock) and is already two factors, so it skips the emailed code. Challenges last 5 minutes and work once; the signature counter is checked; up to 10 passkeys each. The site identity comes from `APP_BASE_URL` (`choicemi.com`): passkeys made on another address will not work.
- **A passkey is optional, never required.** Members who have none (confirmed email, not a test account) are shown an "Add a passkey?" box after signing in, with "Add a passkey" or "Not now". "Not now" (also "Skip for now" on the confirm-email screen) hides it for 7 days, remembered on the account (`users.passkey_prompt_snoozed_until`, `POST /api/v1/auth/passkeys/snooze`), so it holds across devices. `GET /api/v1/auth/session` says whether to show it (`security.suggestPasskey`). Anyone can add or remove passkeys later from Profile.
- **Test accounts are left alone.** Accounts with role `tester` (made-up emails that cannot receive mail) never get a code or a passkey prompt: they sign in with the password only, count as email-confirmed, cannot add or use passkeys (`not_available`), and the screens hide the passkey offer and the Security card for them. Admin and ordinary members are not exempt. When you create a tester by script, set `role = 'tester'` as before.
- Screens: sign-in asks for the code after the password and has a "Sign in with a passkey" button; `/verify-email` takes the code and then offers a passkey; Profile has a "Sign-in security" card to add or remove passkeys. `GET /api/v1/auth/session` now includes `security: { exempt, loginCode, passkeys }`.
- Not built: "remember this device" (so the code is asked on every password sign-in), sign-in codes by SMS, recovery codes. A member who loses all their devices can still sign in with the password and the emailed code, or reset the password.

## Restaurant partners (the `restaurant/` site)

The restaurant site (`restaurant/`, live at restaurant.choicemi.com) is its own app with no backend of its own: it calls this API on its own address (Caddy sends `restaurant.choicemi.com/api/*` here). Code: `lib/server/partner/` and `lib/server/social/availability.ts`. Tables from migration `0009_partners`: `venue_staff`, `venue_closures`, `partner_applications`, plus new columns on `venues`, `dates` and `invites`.

- **Joining.** `POST /api/v1/partner/apply` (public, honeypot, rate-limited) stores a request and emails a receipt and a note to `ADMIN_NOTIFY_EMAIL` (default admin@choicemi.com). Admin (Bearer `ADMIN_TOKEN`; the server script is `./partners.sh`): `GET /api/v1/admin/partners?status=`, `POST .../approve {id}` (creates the venue as `pending` and emails the owner an invitation to the restaurant site), `POST .../reject {id}`, `POST .../create {venueName, email, area?, address?}` (a venue agreed directly). An invitation now carries a role and a venue: signing up with it makes the account a `partner` linked to that venue (the first person is the owner, later ones are staff). `GET /api/v1/invites/check` also returns `role` and `venueName`.
- **Partner accounts.** Role `partner`. They skip identity verification and the pre-launch screen, confirm their email with the same 6-digit code, and sign in with password and emailed code. Emails to partners (confirm email, password reset, invitations) link to `PARTNER_BASE_URL` (default `https://restaurant.choicemi.com`). Passkeys are not offered on the restaurant site.
- **The partner API** (`/api/v1/partner/*`, signed-in partners only, a venue's staff see only their own venue): `GET me`, `GET bookings?from=&to=` (up to 62 days; guests by anonymous name only, never the offer code), `POST bookings/{id}/arrived` (from 3 hours before until the next day), `POST bookings/{id}/no-show` (20 minutes after the time), `POST redeem {code}` (checks guests in and claims the offer once; the code is the one the guests see on their date), `POST bookings/{id}/cancel` (owner; the guests see it cancelled and the match reopens), `GET/PUT profile`, `POST status {active|paused}` (a venue goes live only when its essentials are filled in), `GET/PUT availability` (open weekdays, start times, tables per time), `POST closures` and `DELETE closures/{id}` (a day or one time; existing bookings stay and the owner is told how many), `GET stats`, `GET team`, `POST team/invite`, `DELETE team/{userId}` (removing someone ends their sessions). Staff can see bookings and check guests in; only the owner changes settings, hours, closures, team and cancels.
- **What members see.** Only `active` venues are listed. Available times follow the venue's open weekdays, offered start times, closures and free tables (`lib/server/social/availability.ts`), both when proposing and when the invitee accepts. A confirmed date now carries a 6-character `offerCode` (no 0/O/1/I) for the two guests to show at the venue.

## Read-check, likes, matches, venues and dates (all on accounts and Postgres)

Tables from migration `0006_social`: `gate_attempts`, `reactions`, `matches`, `venues`, `dates`, `date_feedback`, `redate_requests`. Code: `lib/server/social/` (read-check, matches, dates). Everything is limited to admin/tester accounts until launch, like discover.

- **Read-check.** The questions are the member's own pool picks (`poolPicks` in their profile). The wording and the answer choices always come from `question_pool`; the right answer never leaves the server. Finishing setup needs at least 4 valid picks (`read_check_required`).
  - `GET /api/v1/members/{id}/read-check` (status), `POST .../read-check/start`, `POST .../read-check/answer` with `{ questionId, selectedOption }`.
  - Policy is unchanged (see `VERIFICATION_GATE_POLICY.md`): 3 wrong answers block that reader and member for 24 hours, the same question is served until it is answered, a wrong answer moves on to a question not yet asked. Each change runs in a transaction on the row, so two answers at once cannot get past the cap. A member who has no usable questions answers `no_read_check`.
- **Likes.** `POST /api/v1/members/{id}/like` needs the read-check passed (`read_check_required`, 403) and returns `{ mutual, matchId, score }`. `POST .../pass` hides the member for good (a pass cannot become a like). Orientation has to suit both people or the member is simply "not found".
- **Matches.** A mutual like creates one `matches` row per pair (7 days to propose). `GET /api/v1/matches`, `GET /api/v1/matches/{id}` (with the pair's compatibility and the other member's CV), `POST /api/v1/matches/{id}/unmatch` (also cancels an open date). A match with a date in motion stops counting down; a proposal that lapses, is declined or cancelled gives the match a fresh 7 days.
- **Venues.** `GET /api/v1/venues`, `GET /api/v1/venues/{id}/slots?date=YYYY-MM-DD` (the six start times 12:00 to 19:00, `available` false once a venue's capacity for that time is used). Four seeded venues, capacity 4 per time (change `venues.capacity`).
- **Dates.** `POST /api/v1/dates/propose` with `{ matchId, dateKey, time, venueId }`: no message field (a request carrying `message` or `note` is refused), time must be one of the offered slots, the day from tomorrow up to 60 days ahead (Helsinki), one open date per match, capacity checked under a lock on the venue. `GET /api/v1/dates` returns `{ upcoming, pending, past }`. `POST /api/v1/dates/{id}/accept` and `/decline` (invitee only), `/cancel` (either person, before it starts). An unanswered proposal lapses after 48 hours.
- **After a date.** `POST /api/v1/dates/{id}/feedback` with `{ stars, answers }` (choices only, at least 3 answered, once per person), `POST /api/v1/dates/{id}/redate`. A new date on a match whose last date finished needs **both** people to have asked for a re-date.
- Screens: Discover, Matches (and a match), Dates, Propose a date, Feedback now read from these. The offline Android app keeps its own demo members and does not use them.
- The anonymous demo routes (`/api/profile/*`, `/api/verification/*`, `/api/dates/propose`, `/api/compatibility/{a}/{b}`) answer 404 on the real server. They exist only inside the offline app.

## Not done yet

- Nothing stops two members reporting or blocking each other yet (no blocks or reports tables). Reminders (24 h and 2 h), the feedback prompt and no-show detection are not built, and neither is the venue offer redemption code. Proposals and matches lapse lazily when someone reads them, not by a scheduled job.
- Admin screens: the admin API and server scripts exist; there is no admin web page yet. Restaurant-partner sign-in: the `role` column exists; the screens and invites do not.
- People who joined the waitlist before 12 Oct 2026 went to the old FormSubmit inbox (admin@choicemi.com), not the database. Add them with `POST /waitlist` or ask me to import them.
- Two-factor sign-in, magic links, and sign-in with Apple/Google.
