-- ── user_preferences ─────────────────────────────────────────────────────────
-- One row per user, storing lightweight UI preferences.
-- Uses user_id as the primary key (one record per user).

create table if not exists public.user_preferences (
  user_id               uuid        primary key references auth.users (id) on delete cascade,
  dismiss_import_prompt boolean     not null default false,
  updated_at            timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can view own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);
