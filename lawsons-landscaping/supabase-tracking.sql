-- Lawsons Landscaping client, job, and revenue tracking
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.client_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  phone text not null default '',
  property_address text not null default '',
  customer_status text not null default 'lead' check (customer_status in ('lead','active','inactive')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landscaping_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client_profiles(user_id) on delete cascade,
  service_name text not null,
  job_description text not null default '',
  scheduled_date date,
  status text not null default 'requested' check (status in ('requested','scheduled','in_progress','completed','cancelled')),
  quote_amount numeric(10,2) not null default 0 check (quote_amount >= 0),
  final_amount numeric(10,2) not null default 0 check (final_amount >= 0),
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landscaping_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.landscaping_jobs(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'other' check (payment_method in ('cash','check','card','bank_transfer','other')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists landscaping_jobs_client_id_idx on public.landscaping_jobs(client_id);
create index if not exists landscaping_jobs_status_idx on public.landscaping_jobs(status);
create index if not exists landscaping_payments_job_id_idx on public.landscaping_payments(job_id);

create or replace function public.handle_new_landscaping_client()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.client_profiles(user_id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''), coalesce(new.email,''))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_landscaping_client on auth.users;
create trigger on_auth_user_created_landscaping_client
after insert on auth.users for each row execute procedure public.handle_new_landscaping_client();

create or replace function public.sync_landscaping_client_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.client_profiles set email = coalesce(new.email,''), updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_updated_landscaping_client on auth.users;
create trigger on_auth_user_updated_landscaping_client
after update of email on auth.users for each row execute procedure public.sync_landscaping_client_email();

alter table public.client_profiles enable row level security;
alter table public.landscaping_jobs enable row level security;
alter table public.landscaping_payments enable row level security;

drop policy if exists "Clients read own profile or owner reads all" on public.client_profiles;
create policy "Clients read own profile or owner reads all" on public.client_profiles for select to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');
drop policy if exists "Owner creates client profiles" on public.client_profiles;
create policy "Owner creates client profiles" on public.client_profiles for insert to authenticated
with check (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');

drop policy if exists "Clients read own jobs or owner reads all" on public.landscaping_jobs;
create policy "Clients read own jobs or owner reads all" on public.landscaping_jobs for select to authenticated
using (client_id = auth.uid() or lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');
drop policy if exists "Owner creates jobs" on public.landscaping_jobs;
create policy "Owner creates jobs" on public.landscaping_jobs for insert to authenticated
with check (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');
drop policy if exists "Owner updates jobs" on public.landscaping_jobs;
create policy "Owner updates jobs" on public.landscaping_jobs for update to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');
drop policy if exists "Owner deletes jobs" on public.landscaping_jobs;
create policy "Owner deletes jobs" on public.landscaping_jobs for delete to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');

drop policy if exists "Owner manages payments" on public.landscaping_payments;
create policy "Owner manages payments" on public.landscaping_payments for all to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'lawsonhughes53@gmail.com');

grant select on public.client_profiles to authenticated;
grant insert on public.client_profiles to authenticated;
grant select, insert, update, delete on public.landscaping_jobs to authenticated;
grant select, insert, update, delete on public.landscaping_payments to authenticated;
