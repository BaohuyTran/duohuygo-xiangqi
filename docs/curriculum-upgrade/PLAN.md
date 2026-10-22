Execute the complete curriculum upgrade autonomously using the following step specifications:

1. docs/curriculum-upgrade/01-audit-and-design.md
2. docs/curriculum-upgrade/02-foundation-and-pilot.md
3. docs/curriculum-upgrade/03-curriculum-production.md
4. docs/curriculum-upgrade/04-final-validation.md

These files contain the detailed requirements for each step. Read them before starting. Use existing project context and repository instructions; do not ask the user to repeat information already available.

EXECUTION PLAN

Step 1 — Audit and design
Audit the current implementation, define the complete curriculum and assessment model, identify required exercise capabilities, and create a dependency-ordered implementation backlog.

Step 2 — Foundation and representative pilot
Implement and validate the exercise, evaluation, progression, and migration capabilities required by representative pilot lessons. Use pilot findings to correct the design before scaling content production.

Step 3 — Curriculum production
Implement the approved curriculum in dependency-ready batches of approximately 3–5 units. Repeat this step until the entire approved curriculum is implemented and reviewed. Each batch must include teaching, practice, independent assessment, and practical application where specified.

Step 4 — Final validation
Validate the complete learning journey, chess accuracy, practical assessments, application behaviour, and progress migration. Fix defects and produce a release candidate with an honest readiness report.

AUTONOMOUS ORCHESTRATION

- Start with Step 1 and proceed automatically through all subsequent steps.
- Do not stop after producing a plan, finishing one step, completing one batch, or reporting progress.
- Do not ask the user to issue the next prompt or approve routine implementation choices.
- A step completion report is a checkpoint, not the end of the assignment.
- Read the next step specification yourself and continue.
- During Step 3, select and execute the next dependency-ready batch yourself until the approved scope is complete.
- Resolve ordinary design and implementation choices using the project requirements, evidence, and engineering judgment.
- Request user input only for a genuinely blocking decision that cannot be resolved from available context. Continue independent work while blocked.
- Do not silently reduce scope to finish sooner. Record any necessary scope change and its justification.

MULTI-AGENT WORK

Delegate independent work to specialist agents:
- Curriculum and assessment design.
- Xiangqi content authoring and verification.
- Exercise architecture and engine integration.
- Learning experience and bilingual content.
- Independent review and QA.

Adapt assignments to each step. Give each agent explicit scope, owned files, dependencies, deliverables, and acceptance criteria.

Use isolated branches or worktrees when appropriate. Prevent conflicting edits to shared files. The lead agent owns integration, shared contracts, execution state, and progression between steps.

Substantive chess content and assessment logic require independent review. An author's own review does not replace this requirement.

QUALITY GATES

Proceed to the next step only after the current step's acceptance criteria are satisfied.

If a gate fails:
1. Identify the cause.
2. Assign corrective work.
3. Revalidate the affected behaviour and dependent content.
4. Continue when the gate passes.

Do not bypass failed checks or count placeholders, unverified positions, or incomplete lessons as delivered work.

If final validation exposes a design or implementation problem, return to the relevant earlier step, fix it, and repeat the affected validation. Do not merely list fixable defects in the final report.

PERSISTENT EXECUTION STATE

Maintain:
- docs/curriculum-upgrade/STATUS.md
- docs/curriculum-upgrade/DECISIONS.md
- docs/curriculum-upgrade/BACKLOG.md

Adapt existing equivalent documents instead of creating competing sources of truth.

STATUS.md must record:
- Current step and active batch.
- Completed work and verification evidence.
- Outstanding blockers and failed gates.
- Agent ownership.
- Exact next actions.

Update these documents after each meaningful milestone. Commit coherent changes according to repository conventions.

After interruption or context reset, read the execution state and resume unfinished work. Do not restart completed phases unnecessarily.

GLOBAL REQUIREMENTS

- Preserve useful existing content and user progress through explicit mappings and versioned migrations.
- Cover both colours and the full game: opening, middlegame, defence, endgame, and self-analysis.
- Separate content completion, independent mastery, and practical application.
- Require at least 90/100 for jump-ahead assessments, together with the specified competency minimums.
- Do not equate XP, streaks, hints, retries, or memorized answers with competence.
- Verify chess claims and document engine or ruleset limitations.
- Accept reasonable alternative moves where the learning objective permits them.
- Keep English and Vietnamese content consistent.
- Avoid unrelated refactoring and unnecessary infrastructure changes.
- Do not claim automated checks prove real-world learning effectiveness.

DELIVERY BOUNDARY

Complete implementation, independent review, relevant checks, documentation, and release-candidate preparation autonomously.

Do not merge into a protected/default branch, publish, or deploy unless separately authorized. This boundary must not prevent completing local implementation and reviewable deliverables.

FINAL RESPONSE

End the assignment only when:
- All four steps and their acceptance criteria are complete; or
- A genuine external blocker prevents further useful work.

Report the delivered scope, verification results, remaining limitations, release-candidate status, and any external action still required.