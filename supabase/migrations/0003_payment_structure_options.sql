-- Update the payment_structure check constraint to the new option set:
--   Paid in Full upfront, Internal payment plan,
--   Paid In Full split payments, Full financing.
--
-- Existing rows are migrated:
--   Full Upfront                     -> Paid in Full upfront
--   50% Upfront + Financed Balance   -> Paid In Full split payments
--   Full Financing via Stripe        -> Full financing
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  drop constraint if exists contracts_payment_structure_check;

update public.contracts
   set payment_structure = case payment_structure
     when 'Full Upfront' then 'Paid in Full upfront'
     when '50% Upfront + Financed Balance' then 'Paid In Full split payments'
     when 'Full Financing via Stripe' then 'Full financing'
     else payment_structure
   end;

alter table public.contracts
  add constraint contracts_payment_structure_check
  check (payment_structure in (
    'Paid in Full upfront',
    'Internal payment plan',
    'Paid In Full split payments',
    'Full financing'
  ));
