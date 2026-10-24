// Public API of practical play (design/04-architecture.md §5.5–§5.7, 03 §5.2, §5.5–§5.6): training
// partners, the game record and the training-ruleset adjudicator. Pure TypeScript over the engine and
// the analysis layer: no React, DOM, storage or gamification (src/play/purity.test.ts).
export * from './rng';
export * from './record';
export * from './adjudicate';
export * from './policies';
