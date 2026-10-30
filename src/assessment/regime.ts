// The partner regime switch (03-assessment.md §5.2, backlog S2.12/S2.18). Tiny on purpose: screens import it from the
// main chunk, while src/assessment/practical.ts (search, partners) loads lazily.

/** `main`: the 03 §5.2 partner table with `pressing`; `fallback`: fallback F (F1, F1c, F2/F2b, F5). */
export type PartnerRegime = 'main' | 'fallback';

/** `pressing` is not validated yet (S2.18): every task runs in its fallback form until then. */
export const PARTNER_REGIME: PartnerRegime = 'fallback';
