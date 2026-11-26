# Verifying members with Signicat

How to set up and run identity verification for ChoiceMi with Signicat, and which APIs to build. Written for the sandbox account `ChoiceMi-Sandbox` at dashboard.signicat.com.

Source of truth is Signicat's own documentation. The pages used here: [FTN with OpenID Connect](https://developer.signicat.com/identity-methods/ftn/integration-guide/oidc-ftn/), [FTN attributes](https://developer.signicat.com/identity-methods/ftn/attributes-reference/), [OIDC implementation](https://developer.signicat.com/docs/eid-hub/oidc/oidc-implementation/), [encrypted responses](https://developer.signicat.com/docs/eid-hub/oidc/advanced-security/receive-encrypted-signed-responses/), [signed and encrypted tokens](https://developer.signicat.com/docs/eid-hub/oidc/code-examples/signed-and-encrypted-tokens/), [ID Document and Biometric Verification](https://developer.signicat.com/docs/id-document-and-biometric-verification/). Signicat's docs site did not load for my fetch tool, so details below come from search summaries. Confirm each marked item in the sandbox before relying on it.

## 1. Which Signicat route to use

| | A. Finnish bank ID / Mobile ID (FTN) | B. ID document + selfie (Assure API) |
|---|---|---|
| What the member does | Logs in with their bank or Mobile ID | Photographs an ID document, then a selfie with a liveness check |
| Who can use it | People with a Finnish bank ID or Mobile ID | Anyone with a supported ID document |
| Product | eID and Wallet Hub, eID "Finnish eIDs (FTN)", over OpenID Connect | ID Document and Biometric Verification (PictureID, VideoID, ReadID, Onfido, WebID) |
| Speed | Seconds | A few minutes |
| Data kept by us | Pseudonymous id, birthdate | A pass/fail result and a reference id |
| Extra legal weight | Low | High: face data is biometric (GDPR Art. 9), needs explicit consent |

Recommendation: ship route A first. It is fast, strong, and the simplest to run. Add route B later only if you need members without a Finnish bank ID, or want to keep the "liveness selfie" promise.

A single agreement with Signicat gives access to all Finnish bank IDs plus Mobile ID (Mobiilivarmenne); there is no separate contract with each bank.

## 2. Dashboard setup (route A, sandbox)

1. **Domain.** Settings, Domains. Note the domain, for example `choicemi.sandbox.signicat.com`. Every Signicat URL starts with it.
2. **Enable FTN.** Products, eID and Wallet Hub, eIDs, add **Finnish eIDs (FTN)**.
3. **Create the OIDC client.** Products, eID and Wallet Hub, OIDC clients, Create client.
   - Name: `choicemi-web`
   - Grant type: Authorization Code
   - Redirect URIs (exact match, one per environment):
     - `http://localhost:3000/api/v1/auth/signicat/callback`
     - your Vercel preview URL with the same path
     - production later
4. **Encrypted tokens (required for FTN).**
   - Generate an RSA 2048-bit key pair as a JWK, usable for encryption (4096 is also supported).
   - In the client, Advanced, Public keys: upload the public key.
   - Turn on "Encrypt ID Tokens". Content encryption algorithm: A128CBC-HS256 (the default in Signicat's examples). Key algorithm: RSA-OAEP.
   - Keep the private key only as a server secret.
5. **Client secret.** Copy the client id and secret. For a stricter setup use Private Key JWT client authentication instead of a secret (documented by Signicat), but a secret is fine for the pilot.
6. **Branding.** Branding menu: add the ChoiceMi logo and colours so the Signicat login pages look like ours.
7. **Write down these values:**
   - Discovery URL: `https://<domain>/auth/open/.well-known/openid-configuration`
   - Issuer: `https://<domain>/auth/open`
   - Token endpoint: `https://<domain>/auth/open/connect/token`
   - The authorize and JWKS URLs: read them from the discovery document, do not hardcode.
8. **Test.** On the FTN page use "Test in Dashboard" to run a sandbox login. Note exactly which claims come back.

Item to confirm in the sandbox: which scope returns `birthdate`. Signicat lists the FTN scopes as `openid profile idp-id nin ftn-extra`. We want `birthdate` (to check 18+) and the pseudonymous `sub` without the national identity number.

## 3. What to request and what to keep

- Scopes: `openid profile`. Do not request `nin` or `ftn-extra`: they return the Finnish personal identity code, whose use is restricted by Finnish law, and there is no need for it.
- Preselect FTN with `acr_values=idp:ftn`. To jump straight to one bank add `ftn_idp:<code>` (for example `fi-op`); leave it off so members choose their own bank.
- Keep: `sub` (stable per client, pseudonymous), birthdate (or only "is 18 or over" plus birth year), the bank/IdP used, verification time.
- Keep, encrypted at rest: the verified legal name, for security and fraud investigations only (see `AUTH_API.md`, Stored identity data). Do not keep: the personal identity code, date of birth, the raw ID token.

## 4. The login flow in our app

```
/verify page  ->  GET /api/v1/auth/signicat/start
  -> 302 to Signicat authorize (state, nonce, PKCE S256, scope, acr_values=idp:ftn)
  -> member logs in with their bank / Mobile ID
  -> 302 to /api/v1/auth/signicat/callback?code=...&state=...
  -> server: check state, exchange code, decrypt and verify the ID token, check age
  -> create or find user by sub, set session cookie
  -> 302 to /onboarding?step=1 (new member) or /discover (returning)
```

Start route:
- Create `state`, `nonce`, and a PKCE `code_verifier` (32 random bytes, base64url). The challenge is the SHA-256 of the verifier, base64url.
- Store the three secrets in a short-lived (10 minute) httpOnly, SameSite=Lax, signed cookie.
- Redirect to the authorize endpoint from the discovery document.

Callback route (use the `jose` library for the token work):
1. Compare `state` with the cookie. Reject on mismatch.
2. POST to the token endpoint with `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`, authenticating with the client id and secret.
3. The response `id_token` is encrypted (JWE). Decrypt with our private key (`compactDecrypt`). The result is a signed JWT.
4. Verify the signature against Signicat's JWKS (`createRemoteJWKSet`), plus `iss`, `aud` (our client id), `exp`, and `nonce`.
5. Read the claims, compute age. Under 18: stop, show an error, store nothing.
6. Upsert the user by `sub`, create our session, clear the PKCE cookie, redirect.

Both routes live in `app/api/v1/auth/signicat/` (new).

Environment variables (Vercel, never in the repo): `SIGNICAT_DOMAIN`, `SIGNICAT_CLIENT_ID`, `SIGNICAT_CLIENT_SECRET`, `SIGNICAT_ENC_PRIVATE_JWK`, `SESSION_SECRET`, `APP_BASE_URL`.

## 5. Changes in the app

- `/verify`: the "Continue" button calls the start route (full page navigation). Keep email and birth date fields only if we need them for contact; the birthdate should come from the verified claims, not typing.
- Remove the phone-code screen (`/verify/otp`), or keep it only for notifications. A bank login already proves the person.
- Add result pages: cancelled, failed, under 18, already verified.
- Sign in and sign up use the same flow; the callback decides.
- Replace the demo cookie id in `lib/server/session.ts` with the real session.
- Profile page: show "ID verified" with the date, never the bank or name.

## 6. APIs to build for verification (route A)

| Method and path | Purpose |
|---|---|
| GET `/api/v1/auth/signicat/start?mode=signup\|signin` | Begin login, set the PKCE cookie, redirect |
| GET `/api/v1/auth/signicat/callback` | Finish login, verify, create session |
| GET `/api/v1/auth/session` | Who is signed in, onboarding stage |
| POST `/api/v1/auth/logout` | End the session |
| GET `/api/v1/me/verification` | Verified yes/no, date, method (never the claims) |
| POST `/api/v1/me/verification/reauth` | Ask for a fresh login before sensitive actions (delete account, export data) |
| GET `/api/v1/admin/users/:id/verification` | Support view: verified date and method only, audit logged |

Tables: `identities (user_id, signicat_sub, idp, verified_at, loa)`, `sessions`, `auth_events` (login, failure, under-18, no PII).

## 7. Route B later (document and selfie)

APIs to add: POST `/api/v1/me/verification/document/start` (creates an Assure process and returns the redirect), GET `/api/v1/me/verification/document/return`, POST `/api/v1/webhooks/signicat-assure` (signature checked), GET `/api/v1/me/verification/document/status`. Needs: an API client in the dashboard (Settings or Get started, API clients) with the Assure/ID verification product enabled, an explicit biometric consent screen, a retention rule that deletes images and keeps only the result, and a privacy assessment first.

## 8. Mobile app

The Android app is a web view of the site. Bank apps often switch to the bank's own mobile app and return by link. Test this on a real phone early. If it fails in the web view, open the login in the system browser (Chrome Custom Tabs) and use an Android App Link to return to ChoiceMi.

## 9. Test plan

- Sandbox: complete a login from `localhost:3000` with a Signicat test identity; check the claims and the encrypted token handling.
- Unit tests with a fake token: wrong `state`, wrong `nonce`, expired token, wrong audience, under 18.
- Check the cookie survives the redirect (SameSite=Lax is required; Strict would drop it).
- Check what happens if the member closes the bank page and comes back.

## 10. Going to production

1. Start now: contact Signicat sales ("Talk to sales" in the dashboard).
2. Sign the agreement and the data processing agreement. Production is a separate account with its own domain and client.
3. Repeat steps 2.2 to 2.7 in production: FTN enabled, new OIDC client, new key pair, production redirect URIs, branding.
4. Before launch: privacy policy naming Signicat as processor, retention periods, DPIA, test with a real bank ID, monitoring on login failures.
5. Rotate secrets on a schedule and whenever a team member leaves.

## 11. Open items

- Confirm the claims returned by `openid profile` (birthdate present?).
- Decide on route B and the selfie promise on the site.
- Decide if the phone-code step stays.
- Confirm Signicat pricing for sandbox to production and per-login fees.
