-- Account sync of the three-level learning records (curriculum upgrade, 05-migration.md §8.6).
-- `data_v2` holds the `learning.records.v1` JSON written by src/sync (merge rule in src/sync/merge-records.ts).
-- `data` keeps the v1 JSON unchanged, so older builds keep working: they read and upsert only `data`, which
-- leaves `data_v2` as it is on update and null on insert (confirm with manual test T15 in CLAUDE.md before
-- deploying a build that writes data_v2).
--
-- Run this BEFORE deploying the build that writes data_v2. Until it is run, that build still syncs `data` and
-- keeps the records on the device (sync status shows an error).
--
-- No policy or grant change is needed: the RLS policies are per row and the grants are table-level
-- (20261016000000_progress.sql), so the new column is covered by both.

alter table public.progress add column if not exists data_v2 jsonb; -- nullable, no default

-- Make PostgREST see the new column at once (otherwise its schema cache may report PGRST204 for a while).
notify pgrst, 'reload schema';
