-- ── Add statement detail columns to imported_statements ─────────────────────
-- Adds beginning balance, ending balance, and statement period
-- extracted directly from the parsed PDF.

alter table public.imported_statements
  add column if not exists beginning_balance numeric(12, 2),
  add column if not exists ending_balance    numeric(12, 2),
  add column if not exists statement_period  text;
