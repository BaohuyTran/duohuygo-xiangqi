# Driver procedure: curriculum upgrade phase

This is the procedure the main Claude session (the **driver**, also the lead integrator) follows for the
curriculum-upgrade phase described in [PLAN.md](./PLAN.md) and its four step specifications
(`01-audit-and-design.md` … `04-final-validation.md`). It is adapted from the first phase's
[docs/DRIVER.md](../DRIVER.md); where the two differ, **this file wins for this phase**.

Main differences from the first phase:

| | First phase (`docs/DRIVER.md`) | This phase |
| --- | --- | --- |
| Work items | `## Task N` in `docs/PLAN.md` | Items in [BACKLOG.md](./BACKLOG.md) (`S<step>.<n>` ids) |
| Branch | directly on `main`, push deploys | the phase branch (below); **never push to `main`, never deploy** |
| Runs | one task per run, then stop | keep going item after item, step after step (PLAN.md "Autonomous orchestration") |
| State | task notes in `docs/PLAN.md` | [STATUS.md](./STATUS.md), [DECISIONS.md](./DECISIONS.md), [BACKLOG.md](./BACKLOG.md) |
| Review | `tester` + `reviewer` | the same, plus `content-reviewer` for chess content, assessment logic and pedagogy |

## Branch

- Phase branch: **`claude/pensive-albattani-i4h0ji`**, created from `main` at `f20ea5b` (the commit that added
  the phase prompts). All commits of this phase go there and are pushed there
  (`git push -u origin claude/pensive-albattani-i4h0ji`).
- PLAN.md "Delivery boundary": do not merge into `main`, publish or deploy unless the owner separately
  authorizes it. Pushing to `main` deploys to GitHub Pages, so it is out of bounds for this phase.
- If `main` moves during the phase, merge it into the phase branch (no rebase, no force-push).

## Agents

| Agent (`.claude/agents/`) | Roles from PLAN.md it covers | Edits files? |
| --- | --- | --- |
| `implementer` | curriculum designer, architecture engineer, Xiangqi content author, bilingual content | yes (working tree only, no git writes) |
| `tester` | QA: lint, build, tests, content validation, engine guard, UI checks at phone and desktop width | no |
| `reviewer` | QA / code review: diff against the base, criterion by criterion | no |
| `content-reviewer` | independent Xiangqi content reviewer + learning-experience reviewer | no |

- Every agent prompt starts with a **role focus** line (e.g. "Role focus: curriculum designer"), the backlog
  item verbatim (id, goal, owned files, dependencies, acceptance criteria), `Attempt: k of 3`, and
  **`Base: HEAD`**. Throughout the role files, "`main`" means this base: the tester and reviewer judge
  `git diff HEAD` plus untracked files, which is exactly the uncommitted work of the current item.
- Substantive chess content, assessment logic and pedagogy need `content-reviewer` approval from an agent
  run **other than the one that authored it** (PLAN.md: an author's own review does not count).
- **Fallback when an agent type is missing** (the Agent tool says "Agent type '…' not found", e.g. for
  `content-reviewer`, which was added mid-session): use `subagent_type: "general-purpose"` and start the
  prompt with
  > You are acting as the project's `<role>` subagent. Your role definition is the file
  > `<repo>/.claude/agents/<role>.md` — READ IT FIRST and follow it exactly (hard rules, procedure,
  > report format). Use only the tools that file lists.

  and record the fallback in STATUS.md.
- **Parallel work.** Items with no dependency between them and **disjoint owned files** may run as
  parallel `implementer` agents in the background. Shared files (`src/i18n/messages.ts`, `src/content/types.ts`,
  `CLAUDE.md`, `src/storage/index.ts`, the state documents) have a single owner per round; when two items
  need one, run them one after the other. The driver owns the state documents and all git operations.

## Absolute rules

- **Never change existing `src/engine` behavior.** Do not edit existing files in `src/engine/`. New search or
  evaluation code goes in new modules outside `src/engine` (or new files the item explicitly allows). On
  `ENGINE BUG`, or a modified engine file in the engine guard: stop (step 9).
- Never weaken a check to make it pass: no editing tests just to go green, no skipped tests, no edits to CI,
  `.claude/agents/*` or this file while an item is in progress.
- Never count placeholders, unverified positions or incomplete lessons as delivered (PLAN.md "Quality gates").
  Unverified content is `draft` and stays out of the published learning path.
- Never silently reduce scope. A scope change goes in DECISIONS.md with its justification.
- Ask the owner only for a genuinely blocking decision (PLAN.md); record it in STATUS.md under blockers and
  keep working on independent items meanwhile.

## Step 0 — Preflight (once per session, and after any interruption)

```sh
git status --porcelain                     # must be empty; otherwise inspect, never discard someone's work
git fetch origin claude/pensive-albattani-i4h0ji main
git checkout claude/pensive-albattani-i4h0ji && git pull --ff-only origin claude/pensive-albattani-i4h0ji
npm ci
npm run lint && npm run build && npm test
```

- A red baseline: fix it first as its own item (or stop and report if the cause is outside this phase).
- Read STATUS.md, DECISIONS.md and BACKLOG.md. Resume an `in-progress` item at its next attempt; never redo a
  `done` item unless a later gate sends work back to it (PLAN.md: final validation may return to earlier steps).

## Step 1 — Pick the work

The next item is the first `todo` item in BACKLOG.md whose dependencies are all `done`, in the current step.
Independent ready items with disjoint owned files may be picked together (see "Parallel work").
A step's **gate item** (the last item of each step, `S<n>.gate`) runs only when every other item of that step is
`done`; when the gate passes, move STATUS.md to the next step and continue. When step 4's gate passes, go to step 10.

## Step 2 — Mark in progress

Set the item to `in-progress` in BACKLOG.md and update STATUS.md (current step, active item/batch, owner agent).
Leave the item's work uncommitted until step 7.

## Step 3 — Implement (attempt k, starting at k = 1)

Call `implementer` with the role focus, the item verbatim, `Attempt: k of 3`, `Base: HEAD`, for k ≥ 2 the
numbered blocking findings from the previous reports verbatim, and the reminder:
"Do not commit. Do not modify existing files in src/engine. Report ENGINE BUG and stop if needed.
Edit only your owned files plus new files the item needs; do not edit STATUS.md, DECISIONS.md, BACKLOG.md or
DRIVER.md (put proposed decisions and backlog changes in your report)."

`ENGINE BUG` → step 9. `BLOCKED` → record the reason and go to step 8.

## Step 4 — Test

Call `tester` with the item, the implementer report, `Attempt: k`, `Base: HEAD`. For documentation-only items
the tester still runs lint, build, tests and the engine guard, and checks every file reference and count the
documents claim (`file:line` exists, counts match the repository).

## Step 5 — Review

Call `reviewer` (always, even if the tester failed). For items that author or change chess content, assessment
or scoring logic, exercise evaluation, or curriculum/pedagogy documents, also call `content-reviewer`. Give
each the item, the implementer and tester reports, `Attempt: k`, `Base: HEAD`.

## Step 6 — Decide

- Tester PASS, reviewer APPROVE and (when called) content-reviewer APPROVE → step 7.
- Engine guard failed or any report says `ENGINE BUG` → step 9.
- Otherwise, if k < 3: k = k + 1, merge all failures and blocking findings into one numbered list, back to step 3.
- Otherwise (3 attempts used) → step 8.

## Step 7 — Success: record, commit, push to the phase branch

1. BACKLOG.md: item `done`, criteria ticked. STATUS.md: completed work with verification evidence (commands and
   results, review verdicts), agent ownership, exact next actions. DECISIONS.md: decisions taken or confirmed
   (date, decision, reason, alternatives). Fix `CLAUDE.md` if it became stale.
2. Commit on the phase branch and push it:
   ```sh
   git add -A
   git commit -m "Curriculum <item id>: <title>" -m "<3–6 line summary>" -m "<session attribution lines>"
   git push -u origin claude/pensive-albattani-i4h0ji   # on a network error retry up to 4 times: 2s, 4s, 8s, 16s
   ```
3. Do **not** push to `main` and do not check or trigger a deploy. Go back to step 1 (do not stop).

## Step 8 — Out of attempts (or blocked)

1. Item stays `in-progress`; BACKLOG.md and STATUS.md list the unresolved findings and what was tried.
2. If lint, build and tests pass, commit as `Curriculum <item id> (WIP): <title>` and push to the phase branch.
   If not, push to `wip-<item id>` instead so nothing is lost.
3. Continue with other ready items that do not depend on it. If none remain, go to step 10 and say clearly
   what is not done.

## Step 9 — Engine bug or engine change: stop

1. Do not fix or revert anything in `src/engine` yourself.
2. STATUS.md: blocker `engine issue — see report`; item stays `in-progress`.
3. Commit as `Curriculum <item id> (blocked)` to `wip-<item id>`, push, and report the FEN, the moves, expected
   vs actual behavior (or the modified files) and which agent found it. Continue only with items that do not
   depend on the engine behavior in question.

## Step 10 — Report to the owner

Only when all four steps' gates have passed, or a genuine external blocker stops all useful work
(PLAN.md "Final response"):

```
Curriculum upgrade — <COMPLETE | BLOCKED>
Branch: claude/pensive-albattani-i4h0ji @ <sha> (not merged, not deployed)
Delivered: <scope by step>
Verification: lint, build, tests <N passed>, content validation, ui-check widths, reviews
Limitations / blockers: <list>
Release candidate: <status>; external actions still required: <list>
```

Intermediate checkpoint summaries (after each step) go in STATUS.md and in a short chat update; they are not
the end of the run.
