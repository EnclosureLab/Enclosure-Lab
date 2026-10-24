-- Enclosure Lab quote request storage
-- Run this SQL in Supabase SQL Editor for project lblrmljsjimrrighqbdo.
create table if not exists public.enclosure_quote_requests (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 name text not null, email text not null, phone text,
 brand text not null, model text not null, size text not null, quantity text not null,
 rms text, spec_link text, year text, make text, vehicle text,
 max_width text, max_height text, max_depth text,
 type text not null, goal text not null, finish text, port text, notes text,
 status text not null default 'New'
);
alter table public.enclosure_quote_requests enable row level security;
grant insert on public.enclosure_quote_requests to anon, authenticated;
grant select, update, delete on public.enclosure_quote_requests to authenticated;
drop policy if exists "Public can submit quote requests" on public.enclosure_quote_requests;
create policy "Public can submit quote requests" on public.enclosure_quote_requests for insert to anon, authenticated with check (true);
drop policy if exists "Approved managers can read quote requests" on public.enclosure_quote_requests;
create policy "Approved managers can read quote requests" on public.enclosure_quote_requests for select to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
drop policy if exists "Approved managers can update quote requests" on public.enclosure_quote_requests;
create policy "Approved managers can update quote requests" on public.enclosure_quote_requests for update to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
) with check (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
drop policy if exists "Approved managers can delete quote requests" on public.enclosure_quote_requests;
create policy "Approved managers can delete quote requests" on public.enclosure_quote_requests for delete to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
