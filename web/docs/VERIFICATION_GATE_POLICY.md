# Profile-reading verification gate — policy & flagged ambiguity

Implementation for real members: `lib/server/social/readCheck.ts`, on accounts and
Postgres (table `gate_attempts`). It is enforced when someone **likes** a member
(`POST /api/v1/members/{id}/like` refuses until the read-check is passed), and a
date can only be proposed on a mutual match, which needs both people to have passed.
The questions are the member's own pool picks. The rules below are unchanged.

`lib/verification/` (the anonymous JSON-store version, enforced at
`POST /api/dates/propose`) is now used only by the offline Android app; the real
server answers 404 for those routes.

## What the requirement specified explicitly

- ~4–5 owner-supplied questions per profile.
- Questions are selected **randomly** from that profile's set.
- A wrong answer shows **another eligible random question**.
- **Three** failed answers blocks that attempt.
- The block must survive a page refresh.

All of the above is implemented exactly as specified (`lib/verification/gate.ts`).

## Flagged, not guessed: "two to three"

The task description says *"The voice note mentions 'two to three' but does
not clearly specify whether that means questions or options — flag that
ambiguity and do not invent a business rule."*

I do not have access to that voice note in this session, and the number
doesn't appear anywhere in the written spec I *do* have (which says "four to
five questions" and "three failed answers" — both unambiguous and what's
implemented). I have **not** guessed what "two to three" refers to or built
any rule around it. If it turns out to mean, e.g., "show 2–3 options per
question" or "allow only 2–3 attempts instead of 3," that needs the actual
voice note or a product decision — happy to wire it in once it's resolved.

## Decision taken: reset ("cooldown") policy

The written requirement says a block should follow "a documented reset
policy" without specifying one. Documented default taken:

**A blocked (reader, target) pair resets automatically after 24 hours.**

Rationale: this matches copy already shipped in the product
(`'Daily read limit reached — come back tomorrow'`, previously shown in the
discover flow), so it's the best available signal for intended behavior
rather than an arbitrary number. `BLOCK_DURATION_MS` in `lib/verification/gate.ts`
is the single place to change it.

Flagged as open: whether the cooldown should be per-pair (current
implementation — blocked on Maple_Dusk doesn't block River_Ash) or a global
daily cap across all profiles ("come back tomorrow" reads more like the
latter). Per-pair was chosen as the safer, less-punitive default; easy to
widen to global once confirmed.

## Interpretation taken: multiple-choice, not free text

"Owner-supplied questions and correct answers" doesn't say whether the reader
picks from options or types a free-text answer. I kept the existing product's
multiple-choice pattern (`choicemi-full.html`'s per-profile `quiz` field:
question + 4 options + 1 correct answer) rather than building free-text
matching, which is fragile against typos/phrasing and wasn't asked for
explicitly either. The 3 "distractor" options per question are authored
alongside the correct answer (see `lib/verification/bank.ts`) — they are
deliberately-wrong quiz choices, never assertions about the person, so this
does not fabricate any fact.

## What's genuinely bullet-proof today

- **Refresh:** the server returns the *same* in-flight question on repeated
  `start` calls; it does not reroll.
- **Client bypass:** `POST /api/dates/propose` independently checks
  `hasPassedGate` server-side — a client that never called the gate UI at all
  still can't propose a date.
- **Concurrency:** every mutation goes through `jsonStore.mutateTable`, which
  serialises writes to the attempts table through one promise chain — two
  simultaneous `answer` calls for the same session cannot double-count an
  attempt or race past the 3-attempt cap. Covered by
  `lib/verification/gate.test.ts`.


## Update, October 2026: questions come from the question pool

Members no longer type their own read-check questions. They choose 4 to 5 questions from the shared pool (see `AUTH_API.md`, "Profile, onboarding and the question pool") and the suggested answer that is true for them. The correct answer is their pick; the wrong options are the pool's other suggested answers for that question. The gate itself (random question, 3 failed answers to block, 24-hour cooldown) is unchanged.
