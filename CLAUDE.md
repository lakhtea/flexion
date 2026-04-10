# Flexion — Operating Rules for Claude

This file is the contract between me (Claude) and the user for every session in this repo. It is **load-bearing**. Read it on every cold start. If a rule here conflicts with a default behavior, the rule here wins.

Flexion is the first of three apps the user is building to demonstrate **Staff Engineer level** craft (see `~/workspace/staff-engineer-3-app-skills-map.md` and `~/workspace/workspace-setup.md`). The bar is not "it works" — the bar is "a staff engineer would defend every decision in this repo."

---

## The Five Rules (non-negotiable)

These come directly from the user. Every session in this repo must follow them.

### 1. Plan everything. Plan again if planning fails.

- **No code is written before a plan exists for it.** Not a function, not a config tweak, not a "quick fix."
- A plan means: a written doc (or doc update) describing the problem, the design, the alternatives considered, and the exit criteria. For small changes this can be a paragraph in the relevant doc; for large changes it is a new section or a new doc.
- If the first plan reveals the problem is bigger or different than expected, **stop and re-plan**. Do not paper over a bad plan with code.
- Every new component, library, or feature gets a doc entry **before** implementation. Update `docs/04-FLOWCHARTS.md`, `docs/05-COMPONENTS.md`, or `docs/07-ITERATION-PLAN.md` as appropriate first.
- The user explicitly said: *"we are not moving forward with code generation without extensive planning."* Honor this literally.

### 2. Review your own code harshly — using a separate agent.

- After any non-trivial code change, dispatch a **review subagent** (Explore agent works well) with a critical brief. Tell it explicitly: *"be harsh, this is meant to be staff-engineer quality, find every issue you can."*
- While the review agent runs, **the main thread keeps working** on the next item — do not idle.
- When the review returns, fix every legitimate finding. If a finding is rejected, write down *why* in the same response so the reasoning is auditable.
- The user's exact framing: *"Be specific and harsh — I'm trying to write staff-level code."* (workspace-setup.md:372)

### 3. Decompose big problems into subagents.

- When a feature has independent pieces, dispatch **multiple subagents in parallel**, one per piece, then integrate their output.
- Use `Explore` agents for research/reading; use `general-purpose` agents for build-and-return work.
- Brief each agent like a colleague who just walked in: explain the *why*, give file paths and line numbers, set the scope, demand a specific deliverable.
- Do not delegate synthesis. The main thread owns the integration and the final judgment call.

### 4. Verify and test everything thoroughly.

- Domain logic (fatigue, scoring, recommendations, layout persistence, anything in `packages/domain`) is the **first-class citizen for tests**. Aim for high coverage there. UI glue gets lighter coverage. (Per skills-map.md:161.)
- Every algorithmic claim in `docs/03-FATIGUE-SYSTEM.md` must have a unit test that pins it. If the doc says "decay half-life is 48h," there is a test that fails if someone changes it without updating the doc.
- Run `npm run lint`, `npm run check-types`, and `npm test` (or the workspace equivalents) **before declaring any task complete**. If a check fails, the task is `in_progress`, not `completed`.
- For UI changes, do a real render (dev server or storybook) and confirm visually. Do not trust types alone.

### 5. Log every mistake and its resolution.

- `docs/08-MISTAKES.md` is an append-only log. Every time the user catches a mistake (or I catch one in self-review), I add an entry: **what I did, why it was wrong, how it was fixed, and the rule I should follow next time to avoid it.**
- Future sessions will read this log on cold start to avoid repeating past errors.
- This is not optional and not embarrassing — it is the feedback loop that makes the work actually improve.

---

## Quality bar (the Staff Engineer line)

Encoded from `staff-engineer-3-app-skills-map.md` and `workspace-setup.md`. Treat each of these as a hard line, not a suggestion.

- **No `any` ever** (workspace-setup.md:332). Use `unknown` + narrowing if you don't know the shape. If you reach for `any`, stop and design the type properly.
- **Strict TypeScript everywhere.** `noUncheckedIndexedAccess`, `strict`, `isolatedModules` — the shared `@repo/typescript-config/base.json` enforces this. Do not loosen it locally.
- **Domain logic lives in `packages/domain`**, framework-free. The web app and the mobile app must be able to import the *same* fatigue calculator, the *same* type definitions, the *same* layout reducer. If a piece of logic exists in `apps/web` *and* `apps/mobile`, it's a bug — extract it.
- **Pure functions over classes** for domain code unless there's a compelling reason. Easier to test, easier to share.
- **Every architectural decision is documented** in the relevant `docs/0X-*.md` file with a *Why:* line. "Because it's standard" is not a reason — name the alternatives considered and the tradeoff.
- **Tests first for domain logic.** Write the failing test that pins the formula, then implement.
- **Observability from day one.** Even on Flexion (the simplest app), structured logging and error tracking are in scope (skills-map.md:146). Don't `console.log` — use a logger.
- **Performance is a feature.** Memoize fatigue recomputation. Don't deep-clone the world on every keystroke (the prototype does this — see `docs/08-MISTAKES.md` for the prototype anti-patterns we're not repeating). Lighthouse ≥95 is a CI gate from Phase 3.
- **Accessibility is not optional.** Sandbox-mode drag-and-drop must have a keyboard path. Color is never the only signal (the prototype's fatigue bars fail this — fix it).
- **No hidden state.** Every persistent store (Zustand slice, IndexedDB table, SQLite table, remote DB table, even a `localStorage` key) must be declared in `docs/02-DOMAIN-MODEL.md` with a schema before it ships. The self-review subagent (Rule #2) is briefed to grep for new storage calls and fail any PR that adds one without a doc update.

---

## How a session in this repo should run

1. **Cold start:** read this file, then `docs/00-VISION.md`, then `MEMORY.md` (if it exists), then `docs/08-MISTAKES.md`. Skim `docs/07-ITERATION-PLAN.md` to know what phase we're in.
2. **Understand the ask** in the user's own terms. Restate it back if there's any ambiguity. Do not start tools until the goal is clear.
3. **Plan in writing** (Rule #1). Update or create the relevant doc. Present the plan to the user and **wait for approval** before generating code, unless the change is trivial *and* already covered by an approved doc section.
4. **Decompose** (Rule #3). Identify the independent pieces. Spawn parallel subagents where it helps.
5. **Implement** the smallest reviewable slice. Land it behind types and tests.
6. **Self-review with a subagent** (Rule #2). Fix every legitimate finding.
7. **Verify** (Rule #4): lint, type-check, tests, real render. If anything is red, the task is not done.
8. **Update docs** to match what was actually built. Documentation drift is a bug.
9. **Mark the task complete.** If a mistake came up, write it to `docs/08-MISTAKES.md` (Rule #5).

---

## What this repo is becoming

A turborepo with:

- `apps/web` — Next.js (current version, App Router). Read `node_modules/next/dist/docs/` before writing Next code; this version has breaking changes from training data.
- `apps/mobile` — Expo Router (React Native).
- `packages/domain` — pure TS: types, fatigue calculator, recommendation engine, layout reducer. **No React, no DOM, no RN.** Both apps depend on it.
- `packages/ui` — cross-platform-aware shared components where it makes sense (web uses react-dom, native uses RN; some primitives can be platform-split files).
- `packages/typescript-config` — already set up. `base.json` is platform-agnostic; `nextjs.json` adds DOM; `expo.json` adds RN.
- `packages/eslint-config` — shared lint rules.

The core thesis of the product is in `docs/00-VISION.md`. The fatigue system is in `docs/03-FATIGUE-SYSTEM.md`. Sandbox mode (the iOS-style edit grid that's shared across all three of the user's apps) is in `docs/06-SANDBOX-MODE.md`.

---

## Things I have gotten wrong in this repo before

See `docs/08-MISTAKES.md`. Read it on every cold start. If you are about to do something that resembles an entry in that log, stop and reconsider.

---

## When in doubt

Ask the user. The user has been explicit: *"I want to work incredibly iteratively and collaboratively."* A clarifying question is cheaper than a wrong implementation. Use `AskUserQuestion` when the answer is small and bounded; just ask in plain text when it's open-ended.
