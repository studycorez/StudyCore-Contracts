-- StudyCore Contracts — Supabase schema
-- Run this in the Supabase SQL Editor.

-- Required extensions
create extension if not exists "pgcrypto";

-- USERS TABLE
-- Mirrors auth.users (id is the same uuid). Stores role, name, active flag.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'closer', 'parent')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users(role);

-- CONTRACTS TABLE
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  closer_id uuid not null references public.users(id) on delete restrict,

  -- Section 1 — Parties
  parent_name text not null,
  parent_email text not null,
  parent_phone text not null,
  agreement_date date not null default current_date,
  student_name text not null,
  current_score int not null,
  target_score int not null,

  -- Section 2 — Program
  program_duration text not null,
  sessions_per_week int not null check (sessions_per_week in (1, 2, 3)),
  session_length numeric(3,1) not null check (session_length in (1, 1.5, 2)),
  total_hours numeric(6,2) not null,
  test_date date not null,

  -- Section 3 — Payment
  total_price numeric(10,2) not null,
  payment_structure text not null check (payment_structure in (
    'Full Upfront',
    '50% Upfront + Financed Balance',
    'Full Financing via Stripe'
  )),
  upfront_amount numeric(10,2),
  remaining_balance numeric(10,2),
  financing_details text,
  amount_due_at_signing numeric(10,2) not null,

  -- Section 4 — Guarantee
  guarantee_type text not null check (guarantee_type in (
    'We Work With You Free Until You Hit Your Score',
    'No Guarantee'
  )),

  -- Section 5 — Cancellation
  trial_window boolean not null default false,
  show_cancellation_refund_terms boolean not null default true,

  -- Lifecycle
  status text not null default 'draft' check (status in ('draft','sent','viewed','signed','completed')),
  send_option text not null default 'both' check (send_option in ('contract_only', 'payment_only', 'both')),
  contract_sent_at timestamptz,
  payment_link_sent_at timestamptz,
  signed_at timestamptz,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_checkout_url text,
  pdf_url text,
  signing_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  signature_data text,

  created_at timestamptz not null default now()
);

create index if not exists contracts_closer_idx on public.contracts(closer_id);
create index if not exists contracts_status_idx on public.contracts(status);
create index if not exists contracts_signing_token_idx on public.contracts(signing_token);

-- ROW LEVEL SECURITY
alter table public.users enable row level security;
alter table public.contracts enable row level security;

-- Helper: is the calling user an active admin?
-- SECURITY DEFINER so it can read public.users WITHOUT re-triggering RLS,
-- which would otherwise cause infinite recursion when used inside a policy
-- on the same table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- USERS policies
-- Anyone authenticated can read their own user row
drop policy if exists "users_self_read" on public.users;
create policy "users_self_read" on public.users
  for select using (auth.uid() = id);

-- Admins can read all user rows
drop policy if exists "users_admin_read" on public.users;
create policy "users_admin_read" on public.users
  for select using (public.is_admin());

-- Admins can update any user row (activate/deactivate, rename)
drop policy if exists "users_admin_update" on public.users;
create policy "users_admin_update" on public.users
  for update using (public.is_admin());

-- Admins can insert user rows (in practice we use service role from server)
drop policy if exists "users_admin_insert" on public.users;
create policy "users_admin_insert" on public.users
  for insert with check (public.is_admin());

-- CONTRACTS policies
-- Closers can read contracts they created
drop policy if exists "contracts_closer_read" on public.contracts;
create policy "contracts_closer_read" on public.contracts
  for select using (closer_id = auth.uid());

-- Closers can insert contracts as themselves
drop policy if exists "contracts_closer_insert" on public.contracts;
create policy "contracts_closer_insert" on public.contracts
  for insert with check (
    closer_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'closer' and u.active = true
    )
  );

-- Admins can read all contracts
drop policy if exists "contracts_admin_read" on public.contracts;
create policy "contracts_admin_read" on public.contracts
  for select using (public.is_admin());

-- Admins can update contracts
drop policy if exists "contracts_admin_update" on public.contracts;
create policy "contracts_admin_update" on public.contracts
  for update using (public.is_admin());

-- Note: parent signing happens server-side via the service role key
-- (no parent auth, only the signed token in the URL).

-- STORAGE BUCKET for signed contract PDFs
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', true)
on conflict (id) do nothing;
