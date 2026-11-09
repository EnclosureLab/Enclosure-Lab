-- Enclosure Lab Creator Network
-- Run this script in the Supabase SQL Editor for project lblrmljsjimrrighqbdo.
create extension if not exists pgcrypto;

create table if not exists public.creator_applications (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 full_name text not null,
 email text not null,
 social_handle text not null,
 platform text not null,
 follower_count text,
 average_views text,
 content_type text,
 program text not null check(program in ('code','sponsorship','both')),
 reason text not null,
 goals text,
 requested_products text,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_at timestamptz,
 manager_notes text
);
alter table public.creator_applications enable row level security;
revoke insert on public.creator_applications from anon,authenticated;\ngrant insert(full_name,email,social_handle,platform,follower_count,average_views,content_type,program,reason,goals,requested_products) on public.creator_applications to anon,authenticated;
grant select,update on public.creator_applications to authenticated;
drop policy if exists "Anyone can apply to creator network" on public.creator_applications;
create policy "Anyone can apply to creator network" on public.creator_applications for insert to anon,authenticated with check(status='pending');
drop policy if exists "Creators view own application and managers view all" on public.creator_applications;
create policy "Creators view own application and managers view all" on public.creator_applications for select to authenticated using (
 lower(email)=lower(coalesce(auth.jwt()->>'email',''))
 or exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
drop policy if exists "Managers review applications" on public.creator_applications;
create policy "Managers review applications" on public.creator_applications for update to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
) with check (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);

create table if not exists public.creator_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references auth.users(id) on delete cascade,
 application_id uuid unique references public.creator_applications(id),
 display_name text not null,
 email text not null,
 creator_code text unique,
 platform text,
 social_handle text,
 discount_percent numeric(5,2) not null default 5 check(discount_percent between 0 and 30),
 commission_percent numeric(5,2) not null default 5 check(commission_percent between 0 and 30),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.creator_profiles enable row level security;
grant select,insert,update,delete on public.creator_profiles to authenticated;
drop policy if exists "Creators see own profile managers see all" on public.creator_profiles;
create policy "Creators see own profile managers see all" on public.creator_profiles for select to authenticated using (
 user_id=auth.uid() or exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
drop policy if exists "Managers manage creator profiles" on public.creator_profiles;
create policy "Managers manage creator profiles" on public.creator_profiles for all to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
) with check (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);

create table if not exists public.creator_sales (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.creator_profiles(id) on delete cascade,
 order_id uuid unique references public.enclosure_orders(id) on delete set null,
 order_reference text,
 order_amount numeric(12,2) not null default 0,
 commission_amount numeric(12,2) not null default 0,
 status text not null default 'pending' check(status in ('pending','approved','paid','reversed')),
 created_at timestamptz not null default now(),
 notes text
);
alter table public.creator_sales enable row level security;
grant select,insert,update,delete on public.creator_sales to authenticated;
drop policy if exists "Creators see own sales managers see all" on public.creator_sales;
create policy "Creators see own sales managers see all" on public.creator_sales for select to authenticated using (
 exists(select 1 from public.creator_profiles c where c.id=creator_id and c.user_id=auth.uid())
 or exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
drop policy if exists "Managers manage creator sales" on public.creator_sales;
create policy "Managers manage creator sales" on public.creator_sales for all to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
) with check (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);

create table if not exists public.creator_payouts (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.creator_profiles(id) on delete cascade,
 amount numeric(12,2) not null check(amount>0),
 status text not null default 'paid' check(status in ('pending','paid','cancelled')),
 payment_date timestamptz,
 payment_method text,
 reference text,
 notes text,
 created_at timestamptz not null default now()
);
alter table public.creator_payouts enable row level security;
grant select,insert,update,delete on public.creator_payouts to authenticated;
drop policy if exists "Creators see own payouts managers manage all" on public.creator_payouts;
create policy "Creators see own payouts managers manage all" on public.creator_payouts for select to authenticated using (
 exists(select 1 from public.creator_profiles c where c.id=creator_id and c.user_id=auth.uid())
 or exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);
drop policy if exists "Managers manage creator payouts" on public.creator_payouts;
create policy "Managers manage creator payouts" on public.creator_payouts for all to authenticated using (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
) with check (
 exists(select 1 from public.employee_profiles p where p.user_id=auth.uid() and p.role='manager' and p.approved=true)
);

create or replace function public.creator_claim_account()
returns jsonb language plpgsql security definer set search_path=public as $$
declare app public.creator_applications%rowtype; prof public.creator_profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into prof from public.creator_profiles where user_id=auth.uid();
 if found then return jsonb_build_object('ok',true,'creator_id',prof.id); end if;
 select * into app from public.creator_applications where lower(email)=lower(auth.jwt()->>'email') and status='approved' order by reviewed_at desc nulls last,created_at desc limit 1;
 if not found then raise exception 'No approved application was found for this email yet'; end if;
 update public.creator_profiles set user_id=auth.uid() where application_id=app.id and user_id is null returning * into prof;
 if prof.id is null then
  insert into public.creator_profiles(user_id,application_id,display_name,email,platform,social_handle)
  values(auth.uid(),app.id,app.full_name,app.email,app.platform,app.social_handle)
  on conflict(user_id) do nothing returning * into prof;
 end if;
 if prof.id is null then select * into prof from public.creator_profiles where user_id=auth.uid(); end if;
 return jsonb_build_object('ok',true,'creator_id',prof.id);
end $$;
grant execute on function public.creator_claim_account() to authenticated;

create or replace function public.validate_creator_code(p_code text)
returns jsonb language sql security definer set search_path=public as $$
 select coalesce((select jsonb_build_object('valid',true,'code',creator_code,'discount_percent',discount_percent)
 from public.creator_profiles where upper(creator_code)=upper(trim(p_code)) and active=true and creator_code is not null limit 1),jsonb_build_object('valid',false));
$$;
grant execute on function public.validate_creator_code(text) to anon,authenticated;

alter table public.enclosure_orders add column if not exists creator_code text;
create or replace function public.attribute_creator_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare prof public.creator_profiles%rowtype; eligible numeric(12,2);
begin
 if new.creator_code is null or trim(new.creator_code)='' then return new; end if;
 select * into prof from public.creator_profiles where upper(creator_code)=upper(trim(new.creator_code)) and active=true limit 1;
 if not found then return new; end if;
 eligible:=greatest(0,coalesce(new.subtotal,0)-coalesce(new.discount_amount,0));
 insert into public.creator_sales(creator_id,order_id,order_reference,order_amount,commission_amount,status)
 values(prof.id,new.id,new.id::text,eligible,round(eligible*prof.commission_percent/100,2),'pending')
 on conflict(order_id) do nothing;
 return new;
end $$;
drop trigger if exists trg_attribute_creator_order on public.enclosure_orders;
create trigger trg_attribute_creator_order after insert on public.enclosure_orders for each row execute function public.attribute_creator_order();

create index if not exists creator_applications_status_created_idx on public.creator_applications(status,created_at desc);
create index if not exists creator_sales_creator_created_idx on public.creator_sales(creator_id,created_at desc);
create index if not exists creator_payouts_creator_created_idx on public.creator_payouts(creator_id,created_at desc);
