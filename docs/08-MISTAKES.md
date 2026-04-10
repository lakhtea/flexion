# 08 — Mistakes Log

> Append-only. New entries at the **bottom**. Never delete an entry — strike it through with a follow-up entry if it gets superseded. Required by `CLAUDE.md` Rule #5.
>
> Read this file on every cold start. If you're about to do something that resembles an entry below, stop and reconsider.

## Entry format

Every entry uses this template. Be specific. "I got confused" is not a mistake entry — *what* confused you, *how* you fixed it, *what rule* prevents the recurrence is.

```markdown
### YYYY-MM-DD — Short title

**What I did:** A factual description of the action that turned out to be wrong.

**Why it was wrong:** The actual harm — broken behavior, drifted docs, bad design, leaked abstraction, missed test, etc.

**How it was caught:** User caught it / self-review subagent caught it / a test failed / I noticed during a re-read.

**The fix:** What changed in code or docs to undo the harm.

**Rule for next time:** A concrete, checkable rule. "Be more careful" is not a rule. "Before extending DOM lib in base.json, check whether it would leak into mobile" is a rule.
```

---

## Entries

### 2026-04-09 — Treated the prototype as the spec instead of as evidence

**What I did:** When first asked to analyze `training-tracker.jsx`, my instinct was to mirror its data shapes and fatigue formulas directly into the rebuild's domain model — i.e., port it. The prototype's `calcFatigue` would have become `packages/domain/src/fatigue.ts` more or less unchanged.

**Why it was wrong:** The prototype has at least four bugs that look like features on a quick read:
1. No cross-day decay; fatigue is whatever's in the current week object.
2. RPE silently defaults to `5` if unset (`training-tracker.jsx:217`), invisibly contaminating the score.
3. Stretches and warm-ups aren't in `LIB`, so they contribute zero fatigue with no warning.
4. The whole week is deep-cloned on every keystroke (`training-tracker.jsx:760`).

Porting these would have baked the bugs into the foundation. Worse, it would have skipped the *actual* product insight — that fatigue is a prescription, not a display — which only emerged from a real conversation with the user, not from reading the prototype.

**How it was caught:** Self-review during the planning round, before any code was written. The user's answer to Q1 (fatigue is a weekly target with under/at/over zones) confirmed the right framing.

**The fix:** `03-FATIGUE-SYSTEM.md` will be written as a *fresh spec*, not a port. The prototype's formulas are inputs to the spec, not the spec itself. Each prototype bug gets called out in 03 with a note on how the rebuild handles it.

**Rule for next time:** A prototype is **evidence of intent**, not a specification. When porting, separate "what the prototype does" from "what the prototype was *trying* to do." The second one is what gets ported. The first one is what gets debugged.

---

### 2026-04-09 — Deferred decisions I had enough information to close

**What I did:** First draft of `01-ARCHITECTURE.md` left four "open architectural questions" at the bottom: Zustand vs `useReducer`, IndexedDB library choice (idb-keyval vs Dexie), widget content location on mobile, and per-user vs per-device layout scope. The first two were genuinely closeable with the information already in hand — I just hedged.

**Why it was wrong:** "Open question" is supposed to mean *I don't have enough information*. When it actually means *I don't want to commit yet*, the doc lies to its reader. A future me (or another agent) reading the doc would see "this is undecided" and either re-litigate it or build around the wrong assumption. The whole point of writing planning docs is to make commitments that downstream code can rely on. Fake openness defeats that.

The two genuinely open questions stayed. The two fake-open ones were closed: **Zustand** (because we need cross-React subscriptions and shallow-equality selectors) and **Dexie** (because the access patterns are queries, not key-value gets).

**How it was caught:** Self-review subagent dispatched against the first draft of the docs (Rule #2). It flagged both as blockers. The review brief explicitly asked "find places that *sound* decisive but are actually deferrals in disguise" — that prompt was load-bearing.

**The fix:** Closed both decisions in `01-ARCHITECTURE.md` with explicit *why*-against-alternative reasoning. Left only three genuinely-open questions in the bottom-of-doc list. Added a closing line: *"None of these get re-litigated without an entry in `08-MISTAKES.md` explaining what changed."*

**Rule for next time:** Before adding anything to an "Open questions" section, ask one question: *"Do I already have enough information to close this?"* If yes, close it now and write the *why*. The "Open" section is for things that genuinely depend on information I don't have yet (a spike result, a user answer, a library benchmark). Not for things I'm uncomfortable committing to.

---

### 2026-04-09 — Misframed fatigue as a recovery gauge when the user's model was a plan-execution gauge

**What I did:** In the first planning round I treated "fatigue" as a cross-day recovery concept that would eventually need exponential decay with per-muscle half-lives. I flagged the absence of decay as a v2 gap and started designing around a readiness/recovery-over-time axis. `00-VISION.md` even included language about how a user who trains Sunday and sees "0% quads" on Monday is "seeing the wrong answer."

**Why it was wrong:** That's not what the user meant by fatigue. When the user clarified, the actual mental model is: the weekly plan defines a volume target per muscle, and the bar shows how much of that target has been executed *this week*. Skipping a workout leaves muscles low. Modifying a workout changes what got counted. There is no recovery axis at all — the Monday reset isn't a limitation, it's the definition. A user who trains Sunday and sees "0% quads" on Monday is seeing the *correct* answer to the *right* question.

The mistake led to a cascade: I was about to design persistence rows for cross-week fatigue carryover, a decay half-life configuration system, and a "recovery" section of the settings screen — all of which were solving a problem the user didn't have. The reviewer's blocker #4 ("cross-week decay is a v1 correctness problem") was landing on the wrong target because I had described the wrong target.

**How it was caught:** The user, explicitly: *"it's not a running gauge of how fatigued the user is, it's a gauge for how much each muscle was hit during this week's workout split."* I had to re-read `training-tracker.jsx` with this framing in mind to see that the prototype's lack of decay was not a missing feature but the correct implementation of a different model than I was thinking about.

**The fix:**
- `00-VISION.md` got a new "precise definition" paragraph up front and a rewritten non-goal making the weekly reset a feature rather than a limitation.
- `03-FATIGUE-SYSTEM.md` was written from scratch around the plan-execution framing, not ported from my earlier notes.
- The recommender was recast as an explainable stand-in for a human personal trainer, which only makes sense once fatigue is understood as "what's still on the plan."
- Skip and Modify became first-class domain entities, which they have to be if the bar reflects what was *actually* executed.

**Rule for next time:** When a user describes a system I've already started sketching, **restate it back in the user's exact words before extending the sketch**. My internal framing will fight the user's framing, and the user's framing wins — always — because they're the one who knows what they want. A single sentence of restatement ("so the bar shows _this week's_ execution against target, and it resets Monday by design?") would have caught this in one exchange instead of two. This is cheap, so do it every time I notice I'm building a model on top of a concept the user introduced.

---

### 2026-04-09 — Conflated Skip and Modification in the same preset library

**What I did:** First draft of `02-DOMAIN-MODEL.md` defined a single `ModificationPreset` entity with a 12-item seed list. The first three entries had `type: 'skip'` — but the `Modification.type` enum has no `'skip'` variant because Skip is a completely separate first-class entity (`SkipSchema`, elsewhere in the same doc). The three seed entries referenced a type that didn't exist. It would have been impossible to instantiate them, and Zod validation of the seed loader would have blown up on the first app start.

Along the same review pass, I also shipped several other unforced errors in 02 + 03:

- `WeekTemplate.days` used `z.record(z.enum(DAY_KEYS), ...)` and asserted "exactly 7 keys" as an invariant, but `z.record` only validates the shape of keys *that are present* — it doesn't enforce that every key in the enum appears. A WeekTemplate with only Mon and Wed would pass validation. The invariant was aspirational.
- The Dexie schema declared `layouts: '[userId+surface+deviceClass]'` without the `&` primary-key prefix. Dexie interprets bare `[...]` as a *secondary* compound index, not a primary key. This would have silently allowed duplicate layout rows for the same (user, surface, deviceClass) triple — the uniqueness constraint was never actually enforced. Same bug on `exercise_alternatives`.
- The `Session` invariant rule (skip xor loggedBlocks) was written as time-independent but prose-qualified with "once the day is past." A pristine future session (no skip, no logs) would have failed the stateless refinement.
- LoggedSet used `reps: 0` as an implicit sentinel for a dropped set. No explicit `outcome` field.
- The Exercise stim map allowed `0` values "as a pruning guideline" — not enforced, which meant two semantically equivalent exercises would serialize differently depending on how their stim map was authored.
- The recommender algorithm had two undefined paths: what happens if every available template touches a vetoed muscle (no fallback specified), and what `lowest-score exercises` means when the score is only defined at the template level (step 8 was unimplementable).
- Note-based sets (free-text cardio logs) silently contributed zero to fatigue, violating the doc's own "no silent defaults" policy.

**Why it was wrong:** every one of these is the same shape of mistake — **I wrote an invariant in prose and didn't verify the schema actually enforces it.** The docs claimed a stricter semantic than the code would have delivered. A reviewer following the doc to implement would either (a) hit runtime errors, (b) silently corrupt data, or (c) have to re-derive the semantics from first principles. All three are bad.

**How it was caught:** Review subagent dispatched against the fresh drafts of 02 and 03, with a brief that asked specifically to "verify the schema actually enforces the stated invariant" and to "spot-check technical claims about Zod, Dexie, IndexedDB syntax." The agent returned 22 findings with 8 labeled blockers, every one of which was legitimate.

**The fix:** all blockers and all serious findings were applied:

- `Modification` and `Skip` presets are now **separate entities** (`ModificationPreset` and `SkipPreset`) with disjoint seed libraries. The "skip" entries were never Modifications; they belong to Skip.
- `WeekTemplate.days` now uses a Zod `.refine()` to assert all 7 day keys are present.
- `Session` invariant is now time-independent, expressed as three legal states (pristine, skipped, executed) with explicit handling for pristine-past sessions.
- Dexie compound primary keys now have the required `&` prefix on `layouts` and `exercise_alternatives`.
- `LoggedSet` gained an explicit `outcome: 'completed' | 'dropped'` discriminator. No more sentinel values.
- Exercise `stimMap` now rejects `0` values at the schema level — pruning is enforced, not suggested.
- Recommender algorithm now defines per-exercise scoring, specifies the all-vetoed-templates fallback (rest day), and includes a minimum-effective-dose check in the time-budget abbreviation path.
- Note-based sets now emit a `note-set-not-counted` structured warning per set, matching the policy for RPE-missing and unknown-exercise.

**Rule for next time:** **Every invariant in a schema doc gets paired, in the same paragraph, with the code-level mechanism that enforces it.** If the mechanism is "a refinement in the Zod schema," the word `.refine()` appears. If the mechanism is "a test," the test file name appears. If the mechanism is "review discipline," say so explicitly and don't pretend otherwise. Invariants without enforcement mechanisms are lies. The review checklist for any future schema doc in this repo starts with: *"for every 'must,' 'exactly,' 'only,' or 'never' in the prose, trace the word to a line of enforcement."*
