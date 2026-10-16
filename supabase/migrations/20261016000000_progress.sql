-- Account sync for duohuygo-xiangqi: one row of progress JSON per user.
-- `data` holds the RemoteData JSON written by src/sync (merge rule documented in src/sync/merge.ts).
-- Row Level Security: a signed-in user can read, create and update ONLY their own row.

create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "progress: select own row" on public.progress;
create policy "progress: select own row" on public.progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "progress: insert own row" on public.progress;
create policy "progress: insert own row" on public.progress
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress: update own row" on public.progress;
create policy "progress: update own row" on public.progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete policy: rows go away only with the user (on delete cascade).
-- Anonymous (signed-out) requests get nothing.
revoke all on public.progress from anon;
grant select, insert, update on public.progress to authenticated;

-- Server-side timestamp of the last write.
create or replace function public.progress_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists progress_touch_updated_at on public.progress;
create trigger progress_touch_updated_at
  before insert or update on public.progress
  for each row execute function public.progress_touch_updated_at();
