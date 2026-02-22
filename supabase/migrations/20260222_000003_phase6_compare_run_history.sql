-- Phase 6: compare run persistence + history

create table if not exists public.compare_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id text,
  prompt text not null,
  status text not null check (status in ('complete', 'error', 'aborted')),
  session_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists compare_runs_user_id_created_at_idx
  on public.compare_runs (user_id, created_at desc);

alter table public.compare_runs enable row level security;

drop policy if exists "compare_runs_select_own" on public.compare_runs;
create policy "compare_runs_select_own"
on public.compare_runs
for select
using (auth.uid() = user_id);

drop policy if exists "compare_runs_insert_own" on public.compare_runs;
create policy "compare_runs_insert_own"
on public.compare_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "compare_runs_update_own" on public.compare_runs;
create policy "compare_runs_update_own"
on public.compare_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "compare_runs_delete_own" on public.compare_runs;
create policy "compare_runs_delete_own"
on public.compare_runs
for delete
using (auth.uid() = user_id);

drop trigger if exists compare_runs_set_updated_at on public.compare_runs;
create trigger compare_runs_set_updated_at
before update on public.compare_runs
for each row
execute function public.set_updated_at();

create table if not exists public.compare_run_targets (
  id uuid primary key default gen_random_uuid(),
  compare_run_id uuid not null references public.compare_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_id text not null,
  provider text not null check (provider in ('openai', 'anthropic', 'google')),
  connection_id uuid references public.provider_connections (id) on delete set null,
  connection_label text not null,
  model text not null,
  status text not null check (status in ('queued', 'streaming', 'done', 'error')),
  content text not null default '',
  error text,
  finish_reason text,
  sort_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (compare_run_id, sort_order)
);

create index if not exists compare_run_targets_run_sort_idx
  on public.compare_run_targets (compare_run_id, sort_order asc);

create index if not exists compare_run_targets_user_id_created_at_idx
  on public.compare_run_targets (user_id, created_at desc);

alter table public.compare_run_targets enable row level security;

drop policy if exists "compare_run_targets_select_own" on public.compare_run_targets;
create policy "compare_run_targets_select_own"
on public.compare_run_targets
for select
using (auth.uid() = user_id);

drop policy if exists "compare_run_targets_insert_own" on public.compare_run_targets;
create policy "compare_run_targets_insert_own"
on public.compare_run_targets
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.compare_runs
    where public.compare_runs.id = compare_run_id
      and public.compare_runs.user_id = auth.uid()
  )
);

drop policy if exists "compare_run_targets_update_own" on public.compare_run_targets;
create policy "compare_run_targets_update_own"
on public.compare_run_targets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "compare_run_targets_delete_own" on public.compare_run_targets;
create policy "compare_run_targets_delete_own"
on public.compare_run_targets
for delete
using (auth.uid() = user_id);

drop trigger if exists compare_run_targets_set_updated_at on public.compare_run_targets;
create trigger compare_run_targets_set_updated_at
before update on public.compare_run_targets
for each row
execute function public.set_updated_at();
