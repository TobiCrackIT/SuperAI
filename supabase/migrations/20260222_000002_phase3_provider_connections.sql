-- Phase 3: provider connection management

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'google')),
  label text not null,
  encrypted_api_key text not null,
  api_key_mask text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  last_validated_at timestamptz,
  last_validation_status text,
  last_validation_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider, label)
);

create index if not exists provider_connections_user_id_created_at_idx
  on public.provider_connections (user_id, created_at desc);

alter table public.provider_connections enable row level security;

drop policy if exists "provider_connections_select_own" on public.provider_connections;
create policy "provider_connections_select_own"
on public.provider_connections
for select
using (auth.uid() = user_id);

drop policy if exists "provider_connections_insert_own" on public.provider_connections;
create policy "provider_connections_insert_own"
on public.provider_connections
for insert
with check (auth.uid() = user_id);

drop policy if exists "provider_connections_update_own" on public.provider_connections;
create policy "provider_connections_update_own"
on public.provider_connections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "provider_connections_delete_own" on public.provider_connections;
create policy "provider_connections_delete_own"
on public.provider_connections
for delete
using (auth.uid() = user_id);

drop trigger if exists provider_connections_set_updated_at on public.provider_connections;
create trigger provider_connections_set_updated_at
before update on public.provider_connections
for each row
execute function public.set_updated_at();
