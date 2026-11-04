-- Enclosure Lab order management
-- Run this entire file in Supabase SQL Editor for project lblrmljsjimrrighqbdo.
-- Customer checkout may INSERT orders. Only Lawson's approved manager account may read or complete them.
create table if not exists public.enclosure_orders (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 customer_name text not null,
 customer_email text not null,
 customer_phone text,
 fulfillment text not null check (fulfillment in ('shipping','pickup')),
 shipping_address jsonb,
 payment_method text not null,
 items jsonb not null default '[]'::jsonb,
 subtotal numeric(12,2) not null default 0,
 discount_code text,
 discount_amount numeric(12,2) not null default 0,
 estimated_tax numeric(12,2) not null default 0,
 estimated_shipping numeric(12,2) not null default 0,
 estimated_total numeric(12,2) not null default 0,
 customer_notes text,
 completed_at timestamptz
);
alter table public.enclosure_orders enable row level security;
grant insert on public.enclosure_orders to anon, authenticated;
grant select, update on public.enclosure_orders to authenticated;
drop policy if exists "Customers can submit orders" on public.enclosure_orders;
create policy "Customers can submit orders"
 on public.enclosure_orders for insert to anon, authenticated
 with check (true);
drop policy if exists "Only Lawson can view orders" on public.enclosure_orders;
create policy "Only Lawson can view orders"
 on public.enclosure_orders for select to authenticated
 using (
  lower(coalesce(auth.jwt()->>'email',''))='lawsonhughes53@gmail.com'
  and exists (
   select 1 from public.employee_profiles p
   where p.user_id=auth.uid() and p.role='manager' and p.approved=true
  )
 );
drop policy if exists "Only Lawson can mark orders complete" on public.enclosure_orders;
create policy "Only Lawson can mark orders complete"
 on public.enclosure_orders for update to authenticated
 using (
  lower(coalesce(auth.jwt()->>'email',''))='lawsonhughes53@gmail.com'
  and exists (
   select 1 from public.employee_profiles p
   where p.user_id=auth.uid() and p.role='manager' and p.approved=true
  )
 )
 with check (
  lower(coalesce(auth.jwt()->>'email',''))='lawsonhughes53@gmail.com'
  and exists (
   select 1 from public.employee_profiles p
   where p.user_id=auth.uid() and p.role='manager' and p.approved=true
  )
 );
create index if not exists enclosure_orders_active_created_idx
 on public.enclosure_orders (created_at desc) where completed_at is null;
