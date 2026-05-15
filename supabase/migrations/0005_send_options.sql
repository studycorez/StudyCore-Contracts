-- Adds send-option support so closers can choose how to deliver a contract:
--   * 'contract_only'   — email the signing/contract link first; payment link later
--   * 'payment_only'    — email the direct Stripe payment link first; contract later
--   * 'both'            — send both at the same time (default; matches prior behavior)
--
-- The Stripe checkout columns store the Checkout Session created for the
-- "pay first" / "both" flows so the parent can pay via a hosted Stripe page
-- without having to open the signing UI yet.
--
-- Run once in the Supabase SQL editor.

alter table public.contracts
  add column if not exists send_option text not null default 'both'
    check (send_option in ('contract_only', 'payment_only', 'both')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_checkout_url text,
  add column if not exists contract_sent_at timestamptz,
  add column if not exists payment_link_sent_at timestamptz;
