-- Create transactions table
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null,
  description text not null,
  created_at  timestamptz not null default now()
);

-- Index for fast per-user queries
create index if not exists transactions_user_id_idx on public.transactions (user_id);

-- Enable Row Level Security
alter table public.transactions enable row level security;

-- Users can only see their own transactions
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- Users can only insert their own transactions
create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

-- Users can only delete their own transactions
create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);
