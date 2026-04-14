-- ── bank_accounts ─────────────────────────────────────────────────────────────
-- One row per linked bank account. Multiple statements can belong to the same account.

create table if not exists public.bank_accounts (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  bank_name          text        not null,
  account_last_four  text,
  account_type       text,
  created_at         timestamptz not null default now()
);

create index if not exists bank_accounts_user_id_idx
  on public.bank_accounts (user_id);

alter table public.bank_accounts enable row level security;

create policy "Users can view own bank accounts"
  on public.bank_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own bank accounts"
  on public.bank_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bank accounts"
  on public.bank_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own bank accounts"
  on public.bank_accounts for delete
  using (auth.uid() = user_id);


-- ── imported_statements ────────────────────────────────────────────────────────
-- One row per uploaded file. Tracks what was imported and when.

create table if not exists public.imported_statements (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  bank_account_id   uuid        not null references public.bank_accounts (id) on delete cascade,
  file_name         text        not null,
  date_from         date        not null,
  date_to           date        not null,
  transaction_count int         not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists imported_statements_user_id_idx
  on public.imported_statements (user_id);

create index if not exists imported_statements_account_id_idx
  on public.imported_statements (bank_account_id);

alter table public.imported_statements enable row level security;

create policy "Users can view own statements"
  on public.imported_statements for select
  using (auth.uid() = user_id);

create policy "Users can insert own statements"
  on public.imported_statements for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own statements"
  on public.imported_statements for delete
  using (auth.uid() = user_id);


-- ── bank_transactions ──────────────────────────────────────────────────────────
-- Raw rows parsed from a statement. Separate from the user's manual transactions table
-- so imports can be reviewed/edited before being promoted to public.transactions.

create table if not exists public.bank_transactions (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users (id) on delete cascade,
  bank_account_id     uuid        not null references public.bank_accounts (id) on delete cascade,
  statement_id        uuid        not null references public.imported_statements (id) on delete cascade,
  date                date        not null,
  description         text        not null,
  clean_description   text,
  amount              numeric(12, 2) not null,  -- positive = credit/income, negative = debit/expense
  type                text        not null check (type in ('income', 'expense')),
  category            text,
  created_at          timestamptz not null default now()
);

create index if not exists bank_transactions_user_id_idx
  on public.bank_transactions (user_id);

create index if not exists bank_transactions_statement_id_idx
  on public.bank_transactions (statement_id);

create index if not exists bank_transactions_account_id_idx
  on public.bank_transactions (bank_account_id);

-- Partial index for fast date-range queries per account
create index if not exists bank_transactions_date_idx
  on public.bank_transactions (bank_account_id, date);

alter table public.bank_transactions enable row level security;

create policy "Users can view own bank transactions"
  on public.bank_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own bank transactions"
  on public.bank_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bank transactions"
  on public.bank_transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own bank transactions"
  on public.bank_transactions for delete
  using (auth.uid() = user_id);
