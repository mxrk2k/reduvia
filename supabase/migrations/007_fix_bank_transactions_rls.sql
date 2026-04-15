-- ── RLS policies for bank_transactions ──────────────────────────────────────
-- Ensures users can only read, insert, and delete their own bank transactions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions'
    AND policyname = 'Users can view own bank transactions'
  ) THEN
    CREATE POLICY "Users can view own bank transactions"
      ON public.bank_transactions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions'
    AND policyname = 'Users can insert own bank transactions'
  ) THEN
    CREATE POLICY "Users can insert own bank transactions"
      ON public.bank_transactions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions'
    AND policyname = 'Users can delete own bank transactions'
  ) THEN
    CREATE POLICY "Users can delete own bank transactions"
      ON public.bank_transactions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
