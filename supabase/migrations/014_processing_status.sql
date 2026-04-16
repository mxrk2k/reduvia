-- Add processing_status to bank_accounts for async PDF processing via Inngest
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed';
