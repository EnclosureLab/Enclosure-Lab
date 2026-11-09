-- Enclosure Lab Creator Network
-- Run this file in Supabase SQL Editor for project lblrmljsjimrrighqbdo.
-- Creator records are private: creators can see only their own records;
-- approved Enclosure Lab managers can administer the entire program.

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null,
  contact_email text not null,
  social_handle text not null,
  primary_platform text not null,
  other_platforms text,
  follower_count text,
  average_views text,
  content_type text,
  program text not null check (program in ('creator_code','sponsorship','both')),
  reason text not null,
  partnership_goals text,
  requested_products text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','paused')),
  creator_code text unique,
  customer_discount numeric(5,2) not null default 5,
  commission_rate numeric(5,2) not null default 5,
  admin_notes text,
  approved_at timestamptz
);

create index if not exists creator_applications_user_idx
  on public.creator_applications(user_id, created_at desc);
create index if not exists creator_applications_status_idx
  on public.creator_applications(status, created_at desc);
create unique index if not exists creator_applications_code_upper_idx
  on public.creator_applications (upper(creator_code)) where creator_code is not null;

create table if not exists public.creator_sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  application_id uuid not null references public.creator_applications(id) on delete cascade,
  order_reference text,
  eligible_amount numeric(12,2) not null default 0 check (eligible_amount >= 0),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending','approved','paid','void')),
  notes text
);
create index if not exists creator_sales_application_idx
  on public.creator_sales(application_id, created_at desc);

create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  application_id uuid not null references public.creator_applications(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payout_method text,
  reference text,
  paid_at timestamptz not null default now(),
  notes text
);
create index if not exists creator_payouts_application_idx
  on public.creator_payouts(application_id, paid_at desc);

alter table public.creator_applications enable row level security;
alter table public.creator_sales enable row level security;
alter table public.creator_payouts enable row level security;

grant select, insert on public.creator_applications to authenticated;
grant update on public.creator_applications to authenticated;
grant select on public.creator_sales to authenticated;
grant select on public.creator_payouts to authenticated;
grant select, insert, update, delete on public.creator_sales to authenticated;
grant select, insert, update, delete on public.creator_payouts to authenticated;

drop policy if exists "Creators read own application" on public.creator_applications;
create policy "Creators read own application" on public.creator_applications
 for select to authenticated using (user_id = auth.uid());

drop policy if exists "Creators submit own application" on public.creator_applications;
create policy "Creators submit own application" on public.creator_applications
 for insert to authenticated with check (user_id = auth.uid() and status = 'pending'
   and creator_code is null and admin_notes is null);

drop policy if exists "Managers read all creator applications" on public.creator_applications;
create policy "Managers read all creator applications" on public.creator_applications
 for select to authenticated using (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 );

drop policy if exists "Managers update creator applications" on public.creator_applications;
create policy "Managers update creator applications" on public.creator_applications
 for update to authenticated using (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 ) with check (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 );

drop policy if exists "Creators read own sales" on public.creator_sales;
create policy "Creators read own sales" on public.creator_sales
 for select to authenticated using (
  exists(select 1 from public.creator_applications a
   where a.id = application_id and a.user_id = auth.uid())
 );

drop policy if exists "Managers administer creator sales" on public.creator_sales;
create policy "Managers administer creator sales" on public.creator_sales
 for all to authenticated using (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 ) with check (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 );

drop policy if exists "Creators read own payouts" on public.creator_payouts;
create policy "Creators read own payouts" on public.creator_payouts
 for select to authenticated using (
  exists(select 1 from public.creator_applications a
   where a.id = application_id and a.user_id = auth.uid())
 );

drop policy if exists "Managers administer creator payouts" on public.creator_payouts;
create policy "Managers administer creator payouts" on public.creator_payouts
 for all to authenticated using (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 ) with check (
  exists(select 1 from public.employee_profiles p
   where p.user_id = auth.uid() and p.role = 'manager' and p.approved = true)
 );

-- Initial terms are defaults only. Final rates are controlled by an approved manager.
