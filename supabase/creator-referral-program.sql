-- Enclosure Lab Creator & Referral Program
-- Apply in Supabase SQL Editor. No payout automation: rewards are tracked for adult review.
create extension if not exists pgcrypto;

create table if not exists public.el_creator_applications (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 full_name text not null,
 email text not null,
 social_platform text not null,
 social_handle text not null,
 profile_url text,
 audience_size integer,
 audience_description text,
 why_join text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected'))
);

create table if not exists public.el_creators (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references auth.users(id) on delete set null,
 application_id uuid unique references public.el_creator_applications(id),
 display_name text not null,
 email text not null,
 code text not null unique,
 discount_percent numeric(5,2) not null default 10 check(discount_percent between 0 and 50),
 commission_percent numeric(5,2) not null default 5 check(commission_percent between 0 and 50),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.el_referral_clicks (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.el_creators(id) on delete cascade,
 clicked_at timestamptz not null default now(),
 visitor_token text
);
create table if not exists public.el_creator_order_attribution (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.el_creators(id),
 order_id text not null unique,
 order_status text not null default 'pending' check(order_status in ('pending','paid','refunded','cancelled')),
 eligible_subtotal numeric(12,2) not null default 0,
 commission_amount numeric(12,2) not null default 0,
 updated_at timestamptz not null default now()
);

alter table public.el_creator_applications enable row level security;
alter table public.el_creators enable row level security;
alter table public.el_referral_clicks enable row level security;
alter table public.el_creator_order_attribution enable row level security;

-- Public visitors may submit applications only; application records are private.
drop policy if exists "public submit creator applications" on public.el_creator_applications;
create policy "public submit creator applications" on public.el_creator_applications for insert to anon, authenticated
 with check (status='pending');
-- Creator sees their own profile and their own performance only.
drop policy if exists "creator reads own profile" on public.el_creators;
create policy "creator reads own profile" on public.el_creators for select to authenticated using (user_id=auth.uid());
drop policy if exists "creator reads own clicks" on public.el_referral_clicks;
create policy "creator reads own clicks" on public.el_referral_clicks for select to authenticated using (exists(select 1 from public.el_creators c where c.id=creator_id and c.user_id=auth.uid()));
drop policy if exists "creator reads own attributed orders" on public.el_creator_order_attribution;
create policy "creator reads own attributed orders" on public.el_creator_order_attribution for select to authenticated using (exists(select 1 from public.el_creators c where c.id=creator_id and c.user_id=auth.uid()));

create or replace function public.validate_creator_code(p_code text)
returns jsonb language sql stable security definer set search_path=public as $$
 select case when c.id is null then jsonb_build_object('valid',false)
 else jsonb_build_object('valid',true,'discount_percent',c.discount_percent,'creator_id',c.id)
 end
 from (select upper(trim(coalesce(p_code,''))) as code) q
 left join public.el_creators c on c.code=q.code and c.active=true
$$;

create or replace function public.record_creator_click(p_code text,p_visitor_token text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 select id into cid from public.el_creators where code=upper(trim(p_code)) and active=true;
 if cid is null then return false; end if;
 insert into public.el_referral_clicks(creator_id,visitor_token) values(cid,left(p_visitor_token,100));
 return true;
end $$;

-- Admin dashboard access is granted only to accounts explicitly marked in Supabase Auth app_metadata.role.
create or replace function public.el_is_creator_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(auth.jwt()->'app_metadata'->>'role','')='creator_admin'
$$;
drop policy if exists "admin manages applications" on public.el_creator_applications;
create policy "admin manages applications" on public.el_creator_applications for all to authenticated using(public.el_is_creator_admin()) with check(public.el_is_creator_admin());
drop policy if exists "admin manages creators" on public.el_creators;
create policy "admin manages creators" on public.el_creators for all to authenticated using(public.el_is_creator_admin()) with check(public.el_is_creator_admin());
drop policy if exists "admin manages clicks" on public.el_referral_clicks;
create policy "admin manages clicks" on public.el_referral_clicks for all to authenticated using(public.el_is_creator_admin()) with check(public.el_is_creator_admin());
drop policy if exists "admin manages attributed orders" on public.el_creator_order_attribution;
create policy "admin manages attributed orders" on public.el_creator_order_attribution for all to authenticated using(public.el_is_creator_admin()) with check(public.el_is_creator_admin());

grant insert on public.el_creator_applications to anon, authenticated;
grant select on public.el_creators,public.el_referral_clicks,public.el_creator_order_attribution to authenticated;
grant execute on function public.validate_creator_code(text) to anon,authenticated;
grant execute on function public.record_creator_click(text,text) to anon,authenticated;
grant execute on function public.el_is_creator_admin() to authenticated;
