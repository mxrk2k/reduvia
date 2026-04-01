-- Create budgets table
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  category      text not null,
  monthly_limit numeric(12, 2) not null check (monthly_limit > 0),
  created_at    timestamptz not null default now(),
  unique (user_id, category)
);

-- Index for fast per-user queries
create index if not exists budgets_user_id_idx on public.budgets (user_id);

-- Enable Row Level Security
alter table public.budgets enable row level security;

-- Users can only see their own budgets
create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

-- Users can only insert their own budgets
create policy "Users can insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

-- Users can only delete their own budgets
create policy "Users can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);
