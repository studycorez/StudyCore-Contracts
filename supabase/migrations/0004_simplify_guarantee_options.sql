-- Collapse guarantee options to "We Work With You Free Until You Hit Your
-- Score" and "No Guarantee", and drop the now-unused guaranteed_target_score
-- column. Existing rows tagged "Score Improvement Guarantee" or "Full Refund
-- Guarantee" are migrated to the new "we work with you free" guarantee.
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  drop constraint if exists contracts_guarantee_type_check;

update public.contracts
  set guarantee_type = 'We Work With You Free Until You Hit Your Score'
  where guarantee_type in ('Score Improvement Guarantee', 'Full Refund Guarantee');

alter table public.contracts
  add constraint contracts_guarantee_type_check
  check (guarantee_type in (
    'We Work With You Free Until You Hit Your Score',
    'No Guarantee'
  ));

alter table public.contracts
  drop column if exists guaranteed_target_score;
