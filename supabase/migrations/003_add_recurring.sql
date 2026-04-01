-- Add recurring transaction support to the transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_recurring        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_frequency text    CHECK (recurring_frequency IN ('weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS next_due_date       date;

-- Partial index: only recurring rows need fast next_due_date lookups
CREATE INDEX IF NOT EXISTS transactions_recurring_due_idx
  ON public.transactions (user_id, next_due_date)
  WHERE is_recurring = true;
