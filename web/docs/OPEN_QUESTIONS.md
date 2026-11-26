# Open questions — flagged, not guessed

Everything below is a place the task explicitly told me not to invent a rule.
Each is implemented with a clearly-documented, reasonable default so the
product works end-to-end today, but every one is a real open decision that
should go back to product/design before being treated as final.

## 1. "Two to three" (verification gate)

> "The voice note mentions 'two to three' but does not clearly specify
> whether that means questions or options — flag that ambiguity and do not
> invent a business rule."

I don't have access to that voice note in this session, and the number
doesn't appear in any written source available to me (`ChoiceMi_Compatibility_Scoring_Logic.md`,
the requirements you gave me, or `choicemi-full.html`). I have **not**
guessed what it refers to. What I *did* build uses only the numbers stated
explicitly in writing: 4–5 questions per profile, 3 failed answers to block.
See `docs/VERIFICATION_GATE_POLICY.md` for the full detail.

## 2. Compatibility engine — four items the spec itself calls unresolved

`ChoiceMi_Compatibility_Scoring_Logic.md` §11 lists these as open. Decisions
taken (all documented in `docs/COMPATIBILITY_DECISIONS.md`, all reversible
without touching the confirmed formula):

- **Unrated options** → the profile-builder blocks save until every option
  on a field is rated (no silent 50% default).
- **Dealbreaker ceiling** → not implemented; only the confirmed ×2 weight
  multiplier runs. Needs a product decision if a ceiling is wanted.
- **Bucket boundaries** → height uses the spec's own example bands exactly;
  age uses a provisional 4-band split I documented as provisional; income is
  not yet in the variable catalog (adding invented bands for a money field
  without sign-off felt like the wrong call).
- **Incomplete profiles** → a variable with no self-value on the *target*
  side is excluded from that direction's score entirely, not counted as 0.

## 3. Verification gate — reset/cooldown policy

The requirement asks for blocking "according to a documented reset policy"
without specifying one. I took a **24-hour cooldown per (reader, target)
pair**, based on existing product copy already in the app ("come back
tomorrow"). Whether it should instead be a *global* daily cap across all
profiles (closer to what that copy implies) is flagged as open in
`docs/VERIFICATION_GATE_POLICY.md`.

## 4. Verification gate — multiple-choice vs free text

"Owner-supplied questions and correct answers" doesn't say whether the
reader picks from options or types a free-text answer. I kept the existing
product's multiple-choice pattern (question + correct answer + 2-3
owner-authored wrong options), which is what `choicemi-full.html` already
does per-profile. This is an interpretation of an underspecified UI detail,
not an invented number/policy.

## 5. AI profile generation — no API key in this environment

`ANTHROPIC_API_KEY` is not configured anywhere this app can read it, so
`POST /api/ai/profile-draft` always takes the deterministic local-extractive
path today (see `lib/ai/profileDraft.ts`) — it reorganises the user's own
words, never invents new ones, and is honest about which path ran
(`usedAI`/`provider` in the response). The real-model call path is fully
wired and will activate the moment a key is set; nothing else changes.

## 6. Logo asset

Not received yet, per your instruction not to invent or substitute a final
logo. `components/ui/Logo.tsx` is wired to pick up `public/brand/logo.svg`
(or `.png`) automatically — see `public/brand/README.md`. Until then every
header shows the same "C" letter mark the app already used.
