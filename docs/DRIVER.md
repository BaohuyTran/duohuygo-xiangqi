# Driver procedure: "do the next task"

This is the exact procedure the main Claude session (the **driver**) follows when asked to *do the
next task*. The driver coordinates. It does not write feature code itself; the subagents in
`.claude/agents/` do the work:

| Agent | Role | Can edit code? |
| --- | --- | --- |
| `implementer` | Implements the task, or fixes findings, including its tests | yes (working tree only, no git writes) |
| `tester` | Lint, build, tests, engine guard, 360px UI check | no |
| `reviewer` | Diff vs `main` against the acceptance criteria and project rules | no (read-only) |

Invoke them with the Agent tool (`subagent_type: "implementer" | "tester" | "reviewer"`), in the
foreground, one at a time. Give every agent the **full text of the task section** from `docs/PLAN.md`,
because subagents start without this conversation's context.

**If those agent types are not available**, use the fallback below. This happens when the Agent tool
answers "Agent type 'implementer' not found", because `.claude/agents/` is only loaded when a session
starts inside the repository checkout.

- Run each role with `subagent_type: "general-purpose"`, and start its prompt with:
  > You are acting as the project's `<role>` subagent. Your role definition is the file
  > `<repo>/.claude/agents/<role>.md` — READ IT FIRST and follow it exactly (hard rules, procedure,
  > report format). Use only the tools that file lists.
- Then give the repository path, the branch and the same inputs as for the real agent.
- Record in the task's notes in `docs/PLAN.md` that the fallback was used. Its tool limits are enforced by instructions,
  not by the harness.

## Absolute rules

- **Work directly on `main`** (the user's decision, 2026-10-21: only the owner and Claude work on this repo and
  there are no users yet). No task branches and no PRs. Push to `main` only work that passed lint, build and
  tests. Never force-push and never rewrite published history.
- **Never change `src/engine` behavior.** If any agent reports `ENGINE BUG`, or the engine guard shows
  modified engine files, **stop** (step 9) and report. Do not patch the engine.
- Never weaken a check to make it pass: do not edit tests just to make them green, skip tests, or edit CI,
  `.claude/agents/*` or this file during a task.
- One task per run. Optional tasks (Task 6) only when the user explicitly asks for them.

## Step 0 — Preflight

```sh
git status --porcelain            # must be empty; otherwise stop and ask
git fetch origin main
git checkout main && git pull --ff-only origin main
npm ci
npm run lint && npm run build && npm test
```

- If the baseline fails, stop and report: never start a task on a red `main`.
- Read `docs/PLAN.md`. If any task is `in-progress`, do not start a new one. Report it and ask whether
  to resume (resume = continue at step 3 with the next attempt number).
- Check that every `done` task is in `main` (its notes name a commit; `git branch -r --contains <commit>`).
  If one is not merged yet (e.g. "not yet merged" in its notes), stop and ask the user to merge it first.

## Step 1 — Pick the task

The task is the **first** `## Task N` in `docs/PLAN.md` whose status is `todo`. Skip tasks marked
**optional** unless the user asked for that task by number. If nothing is left, report "no todo tasks"
and stop.

## Step 2 — Mark in progress

Stay on an up-to-date `main` (step 0). Leave the work uncommitted until step 7, so the tester and reviewer
see the whole task as `git diff main`.

In `docs/PLAN.md`, set the task's status to `in-progress` and add a note:
`- <date>: started (directly on main).`

## Step 3 — Implement (attempt k, starting at k = 1)

Call **implementer** with:

- the task section, verbatim,
- `Attempt: k of 3`,
- for k ≥ 2: the numbered blocking findings from the previous tester and reviewer reports, verbatim,
- the reminder: "Do not commit. Do not modify existing files in src/engine. Report ENGINE BUG and stop if needed."

If the report says `ENGINE BUG`, go to step 9. If it says `BLOCKED`, record the reason and go to step 8.

## Step 4 — Test

Call **tester** with the task section, the implementer report and `Attempt: k`. Keep the report.

## Step 5 — Review

Call **reviewer** with the task section, the implementer report, the tester report and `Attempt: k`.
Always run the reviewer, even when the tester failed, so the next attempt gets all findings at once.

## Step 6 — Decide

- **Tester PASS and reviewer APPROVE**: go to step 7.
- If the engine guard failed, or a report mentions `ENGINE BUG`: go to step 9.
- Otherwise, if k < 3: k = k + 1. Merge the tester failures and reviewer blocking findings into one
  numbered list and go back to step 3.
- Otherwise (3 attempts used): go to step 8.

## Step 7 — Success: commit and push to main, update the plan

1. In `docs/PLAN.md`: set the status to `done`, tick the acceptance criteria, and add notes (date, attempts
   used, key decisions, open questions from the reports). If `CLAUDE.md` is stale, fix it now.
2. Commit everything on `main` and push it (this deploys to GitHub Pages):
   ```sh
   git add -A
   git commit -m "Task <N>: <title>" -m "<3–6 line summary>" -m "<attribution lines required by the session>"
   git push origin main                   # on a network error, retry up to 4 times: 2s, 4s, 8s, 16s
   ```
3. Check that the "Deploy to GitHub Pages" run for that commit succeeds
   (`gh api "repos/BaohuyTran/duohuygo-xiangqi/actions/runs?head_sha=<sha>"`), then go to step 10.

## Step 8 — Out of attempts (or blocked)

Keep the work, but do not present it as finished:

1. In `docs/PLAN.md`, leave the status `in-progress`. Add notes listing the unresolved findings and what was tried.
2. If lint, build and tests pass, commit as `Task <N> (WIP): <title>` and push to `main`. If they do not,
   do not push broken code to `main`: push the work to a branch `wip-task-<N>` so it is not lost when the
   container is reclaimed (the only case where a branch is used), and list the unresolved findings.
3. Go to step 10 and say clearly that the task is **not** done.

## Step 9 — Engine bug or engine change: stop

1. Do **not** fix or revert anything in `src/engine` yourself.
2. In `docs/PLAN.md`, leave the status `in-progress` and add a note: `blocked: engine issue — see report`.
3. Commit the work so far as `Task <N> (blocked): <title>` and push it to a branch `wip-task-<N>` (not to
   `main`), so nothing is lost when the container is reclaimed.
4. Report to the user: the FEN, the moves, the expected vs actual behavior (or the modified engine files),
   which agent found it, and stop. Wait for instructions.

## Step 10 — Summary to the user

Reply with:

```
Task <N> — <title>: DONE | NOT DONE (out of attempts) | BLOCKED (engine)
Commit: <sha> on main · Deploy: <succeeded | failed | not pushed>
Attempts: <k>/3
What was built: <3–6 bullets>
Checks: lint <…>, build <…>, tests <N passed>, ui-check 360px <…>, reviewer <verdict>
Unresolved / open questions: <list or "none">
Next: <the next todo task in PLAN.md, or "none">
```
