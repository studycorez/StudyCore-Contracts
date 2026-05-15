-- Drop program start_date and end_date from contracts. The agreement_date
-- (already on the row) is the effective start, and test_date is the date
-- that matters for guarantee logic. Existing rows lose these columns.
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  drop column if exists start_date,
  drop column if exists end_date;
