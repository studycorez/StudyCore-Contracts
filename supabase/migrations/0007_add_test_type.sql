-- Add a test_type column to distinguish SAT vs ACT contracts. Existing rows
-- backfill to 'SAT' (the only product before this migration). New contracts
-- must explicitly set 'SAT' or 'ACT'.
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  add column if not exists test_type text not null default 'SAT'
    check (test_type in ('SAT', 'ACT'));

create index if not exists contracts_test_type_idx on public.contracts(test_type);
