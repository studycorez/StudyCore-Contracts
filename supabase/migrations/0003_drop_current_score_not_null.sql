-- Drop the not-null constraint on contracts.current_score so new contracts
-- can be created without recording a starting (diagnostic baseline) score.
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  alter column current_score drop not null;
