// Public API of the assessment engine (design/03-assessment.md §2–§4, §6, §7, §9). Pure modules only: credit, forms,
// unit checks, jump-ahead, exams and progress states. The practical-task engine (practical.ts) is NOT re-exported: it
// pulls in the analysis layer and is loaded lazily by the play screen.
export * from './credit';
export * from './form';
export * from './checks';
export * from './placement';
export * from './exams';
export { PARTNER_REGIME, type PartnerRegime } from './regime';
