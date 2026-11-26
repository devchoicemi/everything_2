# Compatibility engine — open decisions and defaults taken

Source of truth: `ChoiceMi_Compatibility_Scoring_Logic.md` (§11 lists these as
explicitly unresolved). Implementation lives in `lib/compat/`. This file
exists so the four open items are visible and reviewable, not buried in code
comments — **none of them change the confirmed formula** (weighted average,
×2 dealbreaker weight, two-directional average). They only decide what
happens at the *edges* the spec didn't cover.

## 1. Unrated options

**Spec question:** what score does an option get if the user never rated it —
flat 50%, or force completion?

**Decision taken:** force completion. `validateUserVariables`
(`lib/compat/engine.ts`) rejects a save if any SMALL_SET/BUCKETED_CONTINUOUS
option is missing a rating. The API route `POST /api/profile/variables`
returns `422` with the exact missing options.

**Why:** a silent 50% default is itself an invented business rule — it would
quietly change every score involving that option with no record that it
happened. Forcing completion is explicit, auditable, and never diverges from
"the rating the user typed in *is* the score" (§1 of the spec).

**Still open:** whether product wants a lighter-weight onboarding that allows
partial rating with a visible "your profile isn't scoring at full accuracy
yet" state instead of a hard block. Flagging for a product call.

## 2. Dealbreaker ceiling

**Spec question:** should a failed dealbreaker also cap the score at some
ceiling, beyond the ×2 weight multiplier?

**Decision taken:** no ceiling. `directionalPercent` implements exactly the
confirmed pseudocode (§10) — dealbreaker only doubles `effectiveWeight`.

**Why:** the spec's own worked example (§8.2) treats the ×2 multiplier as the
complete mechanic and explicitly calls a ceiling a *separate*, undecided
question. Adding one would be inventing a rule the source document says isn't
confirmed.

**Still open:** entirely — needs a product decision (e.g. "any failed
dealbreaker caps the category at 60%?") before it can be built.

## 3. Bucket boundaries for continuous fields

**Spec question:** height's 4 bands are given as the worked example; age and
income need their own, "trading rating speed against granularity."

**Decision taken:**
- Height: the spec's exact bands (under 5'0", 5'0"–5'5", 5'6"–5'11", 6'0"+).
- Age: a provisional 4-band split (18–24 / 25–30 / 31–38 / 39+), documented
  as provisional in `lib/compat/config.ts`.
- Income: **not in the catalog yet.** Adding invented bands for a sensitive,
  high-stakes field (money) without product/legal input felt like the wrong
  place to guess. The `VariableConfig` shape already supports it — add one
  entry once bands are decided.

## 4. Incomplete profiles

**Spec question:** unset variables currently count as 0 in the denominator —
alternative is excluding them entirely.

**Decision taken:** exclude entirely. If the *target* of a match hasn't set a
self-value for a field (or, for MULTI_SELECT, the *viewer's* ideal set is
empty), that variable is dropped from both the numerator and denominator for
that direction — see `VariableBreakdown.excluded` / `excludedReason` in the
API response, so the UI can show *why* a variable didn't count rather than
silently omitting it.

**Why:** counting a merely-incomplete profile as a hard 0 punishes new users
for not having filled everything in yet, which the spec itself names as the
weaker alternative ("counting as 0" is the status quo it's contrasting
against, not the recommendation).

---

None of the above is exercised by the profile-reading verification gate
(`lib/verification/`) — that system is intentionally separate and never
reads or writes a compatibility score.


## Update, October 2026: height in centimetres and plain slider wording

- Height is entered and stored in **centimetres**. The four bands are: under 160 cm, 160-169 cm, 170-179 cm, 180 cm and over (bucket keys `h_under_160`, `h_160_169`, `h_170_179`, `h_180_plus`). This replaces the earlier feet-and-inches bands. Drafts saved with the old bands are reset for height only, so the member rates it again.
- Every rating slider now says what it measures. For "How much would you want a partner who is...", **0% means "Not for me" and 100% means "My ideal"**, with words that change as you move it (Would rather not, Fine either way, I would like that). The importance slider runs from "Barely matters" to "Essential". The scoring formula itself is unchanged.
