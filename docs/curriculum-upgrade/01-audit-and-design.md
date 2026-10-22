USER GOAL

Learners completing the course should be able to play complete games with purpose: develop pieces, understand opening plans, assess positions, coordinate attacks, defend, transition into endgames, convert advantages, and analyze their own mistakes.

Completing tactical puzzles alone is insufficient evidence of this outcome. “Master” is a course stage, not a promise of an official title or rating.

CONTEXT TO VERIFY

A previous audit of main found:
- 13 units, 36 lessons, and 146 practice exercises, excluding learn cards and the separate puzzle bank.
- Intermediate through Master contained 120 practice exercises: 100 mating exercises, 15 mate-defence exercises, and 5 material-winning combinations.
- Major gaps were opening development, positional assessment, planning, broader defence, endgame technique, and sustained play.
- Existing exercises were designed for the learner to play Red.
- The existing jump-ahead mechanism sampled exercises from existing lessons.

These are historical findings, not assumptions about the current checkout. Re-audit before making decisions.

TEAM

Delegate distinct responsibilities:
1. Curriculum designer: learning progression, prerequisites, measurable outcomes.
2. Xiangqi content reviewer: chess accuracy, terminology, pedagogical validity.
3. Architecture engineer: exercise models, opponent behaviour, evaluation, persistence.
4. Learning-experience reviewer: onboarding, scaffolding, feedback, assessment.
5. QA reviewer: validation strategy, migration risks, acceptance criteria.

Use separate ownership areas and a lead integrator. Independent reviewers must review substantive content and architecture.

TASK

Inspect the repository and applicable repository instructions. Read the actual curriculum, translations, engine, validators, lesson player, progression, assessments, and persistence.

Do not change application behaviour in this phase. Produce a concrete implementation plan and repository-native design documents.

CURRICULUM REQUIREMENTS

Cover all six competency strands across the course:
- Rules and board safety.
- Tactical recognition and calculation.
- Openings and piece development.
- Positional assessment, planning, and attack.
- Defence and endgames.
- Practical play and self-analysis.

Use the following 50-topic outline as a coverage baseline. You may split, merge, reorder, or rename topics when educationally justified. Do not force exactly ten units per level or add filler.

Basic:
1. Board, setup, turns, and objectives.
2. General, Advisors, Elephants, and facing generals.
3. Chariot and Horse movement and restrictions.
4. Cannon screens and Soldiers before/after crossing.
5. Check, escaping check, checkmate, stalemate, and game outcomes.
6. Threatened, undefended, and defended pieces.
7. Exchanges and relative material value.
8. Pre-move safety routine.
9. Opening development principles.
10. First complete guided games.

Intermediate:
11. Piece activity and coordination.
12. Forks and pins.
13. Discovered attacks and double check.
14. Removing defenders, deflection, decoys, and overload.
15. Characteristic mating patterns and their defences.
16. Tactical defence, exchanges, and counter-threats.
17. Central Cannon plans as Red.
18. Screen Horse defence plans as Black.
19. Elementary endgames and General/Soldier activity.
20. Transition from opening to middlegame.

Advanced:
21. Position assessment.
22. Candidate moves and opponent responses.
23. Improving poorly placed pieces.
24. Open files, ranks, and invasion points.
25. Soldier structures, breaks, and weaknesses.
26. Preparing attacks before a combination exists.
27. Positional defence and counterplay.
28. Exchanges and phase transitions.
29. Practical Chariot, Horse, and Cannon endgames.
30. Annotated games connecting all phases.

Expert:
31. Branching calculation and intermediate moves.
32. Sound sacrifices and compensation.
33. Initiative and tempo.
34. Multiple targets and switching the attack.
35. Active defence.
36. Static versus dynamic advantages.
37. Converting advantages while restricting counterplay.
38. Defending inferior positions and verified drawing resources.
39. A practical opening repertoire for both colours.
40. Independent analysis of personal games.

Master:
41. Diagnosing unfamiliar positions without motif labels.
42. Comparing plausible plans.
43. Switching between attack and defence.
44. Irreversible decisions.
45. Complex practical endgames.
46. Handling unfamiliar opening moves.
47. Time management and practical risk.
48. Deep annotated-game analysis.
49. Multi-game practical assessment.
50. Graduation portfolio, remediation, and reassessment.

DESIGN RULES

- Teach why a move works, when the idea applies, and when it fails.
- Teach both colours and both attacking and defending perspectives.
- Include positions with no immediate tactical win.
- Teach development and plans before lengthy opening memorization.
- Increase difficulty through reduced hints, unfamiliarity, branching, counterplay, evaluation, and sustained decisions; not merely longer mating sequences.
- Separate lesson completion, independent mastery, and practical application.
- Never treat XP, streaks, retries, or memorized answers as proof of competence.
- Jump-ahead assessment must require at least 90/100, with minimum competency-strand requirements.
- Select and document a ruleset, including repetition adjudication and implementation limitations.
- Preserve useful existing content through an explicit mapping.

DELIVERABLES

Create or adapt repository-native documents covering:

1. Current-state audit with file references and verified counts.
2. Curriculum specification.
   For every unit include:
   - Stable ID, level, prerequisites, and competency tags.
   - Observable learning outcomes.
   - Individual lesson titles and learning objectives.
   - Exercise types and scaffolding progression.
   - Guided practice, independent practice, and transfer tasks.
   - Common misconceptions and feedback requirements.
   - Assessment and remediation criteria.
3. Assessment specification, including practical-play rubrics and jump-ahead scoring.
4. Exercise architecture and engine/evaluation feasibility assessment.
5. Existing-content reuse and progress migration map.
6. Prioritized implementation backlog with dependencies, ownership, and acceptance criteria.
7. Content sourcing, attribution/licensing, and verification policy.

Differentiate verified facts, design proposals, and unresolved decisions.

Do not invent verified chess positions, exact ratings, or learning-time guarantees. Do not assume an engine score proves a pedagogical objective.

Finish by recommending a small representative pilot for the next phase, explaining what it will validate.

Complete the documents and commits locally as appropriate. Do not publish, merge, or deploy. Report the resulting files, key decisions, outstanding blockers, and the next implementation batch.