// TEST-ONLY loader of the review records (07-sourcing.md §5.2). Never import this from app code: the records must not
// be bundled (src/content/release.test.ts checks that no non-test module imports src/content/reviews).
import type { ReviewFile, ReviewRecord } from './gate';

const files = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

/** Every record file as `{ name, file }` (name = file name without `.json`), unvalidated. */
export const reviewFiles: { name: string; file: unknown }[] = Object.keys(files)
  .sort()
  .map((path) => ({ name: path.replace(/^\.\//, '').replace(/\.json$/, ''), file: files[path] }));

/** All records of all well-shaped files (shape problems are reported by `reviewFileProblems`). */
export const reviewRecords: ReviewRecord[] = reviewFiles.flatMap(({ file }) =>
  typeof file === 'object' && file !== null && Array.isArray((file as ReviewFile).records) ? (file as ReviewFile).records : [],
);
