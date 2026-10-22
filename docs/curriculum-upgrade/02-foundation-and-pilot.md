OBJECTIVE

Implement the smallest complete foundation that proves this application can teach and assess more than isolated tactical puzzles.

Choose a small pilot spanning:
1. A beginner safety/development lesson.
2. An opening-plan lesson with plausible opponent deviations.
3. A positional lesson where improving a piece is better than forcing an attack.
4. A defensive or endgame continuation.
5. An assessment containing unfamiliar positions without motif labels.

Implement the pilot end to end. Do not stop at mockups, schema changes, placeholder content, or a written plan.

FUNCTIONAL REQUIREMENTS

- Support learner play as either colour, including correct board orientation, coordinates, prompts, and feedback.
- Support existing tactical exercises without regressions.
- Add only the exercise capabilities needed for the approved pilot and planned curriculum.
- Support branching continuations and multiple acceptable moves where appropriate.
- Distinguish a tactical solution from a reasonable strategic choice.
- Strategic acceptance must consider the learning objective and resulting continuation, not exact equality with the engine's first choice.
- For constrained training opponents, define their intended defensive quality and disclose limitations.
- Accept reasonable alternative learner moves through a documented evaluation method. Do not silently force a single stored variation.
- Provide position-specific explanations: purpose, key opponent response, common error, and why the tempting alternative fails.
- Reveal guidance progressively; independent assessments must not disclose the intended motif.
- Ensure selecting answers and making moves do not reload the page or reset unrelated lesson state.
- Keep the interaction usable on mobile and accessible by keyboard where applicable.
- Support English and Vietnamese consistently.

ENGINE AND CONTENT INTEGRITY

Inspect existing engine capabilities before selecting an integration approach.

If stronger engine support is necessary:
- Document licensing, compatibility, worker usage, performance, loading size, and offline/hosting implications.
- Keep expensive computation off the UI thread.
- Provide bounded computation and graceful failure behaviour.
- Do not misrepresent a shallow search as complete verification.
- Treat authored lines and engine scores as evidence with stated limits.
- Verify legal positions and moves, all relevant defensive branches for claimed forced outcomes, and accepted alternatives.
- Distinguish legal-position validation from historical reachability.

PROGRESSION AND ASSESSMENT

Implement the approved distinction between:
- Completed.
- Independently mastered.
- Applied in practical play.

Preserve existing user progress through versioned, tested migration. Do not silently equate old lesson completion with newly assessed competence.

Jump-ahead tests must:
- Require at least 90/100.
- Meet the approved competency minimums.
- Use independent assessment items.
- Track first-attempt performance separately from hints/retries.
- Include sustained-play evidence when the target level requires it.

VERIFICATION

Add meaningful tests for:
- Legal content and claimed outcomes.
- Accepted alternative moves and opponent branches.
- Both colours.
- Scoring and jump-ahead boundaries.
- Progress migration.
- Lesson continuity and interaction state.

Review the pilot visually and functionally on mobile and desktop. Independently review chess accuracy and teaching quality.

DEFINITION OF DONE

- The pilot is playable end to end.
- Content contains no placeholder positions or generic success-only explanations.
- Existing lessons remain functional.
- Required build, type, content-validation, and relevant test checks pass.
- Evaluation limitations are documented honestly.
- Phase 1 documents and backlog reflect what was actually implemented.

Do not merge, publish, or deploy. Report implemented capabilities, playable pilot units, verification evidence, material limitations, and readiness for curriculum production.