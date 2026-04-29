-- Add marketing_release_consent toggle. Default false — closers must
-- explicitly opt the parent in for the marketing & media release clause
-- to appear in the agreement.
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  add column if not exists marketing_release_consent boolean not null default false;
