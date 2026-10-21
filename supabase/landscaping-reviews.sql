-- Run this script in the Supabase SQL Editor for the existing project:
-- https://supabase.com/dashboard/project/lblrmljsjimrrighqbdo/sql/new
-- Public visitors can submit and read reviews. Only the owner email can pin or delete reviews.

create table if not exists public.landscaping_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_name text not null check (char_length(trim(reviewer_name)) between 1 and 100),
  service_received text not null check (char_length(trim(service_received)) between 1 and 100),
  review text not null check (char_length(trim(review)) between 1 and 2000),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  is_pinned boolean not null default false
);

-- Also safely upgrade an existing reviews table.
alter table public.landscaping_reviews
  add column if not exists is_pinned boolean not null default false;

alter table public.landscaping_reviews enable row level security;

grant select, insert on public.landscaping_reviews to anon, authenticated;

drop policy if exists "Anyone can read landscaping reviews" on public.landscaping_reviews;
create policy "Anyone can read landscaping reviews"
  on public.landscaping_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit landscaping reviews" on public.landscaping_reviews;
create policy "Anyone can submit landscaping reviews"
  on public.landscaping_reviews for insert
  to anon, authenticated
  with check (
    char_length(trim(reviewer_name)) between 1 and 100
    and char_length(trim(service_received)) between 1 and 100
    and char_length(trim(review)) between 1 and 2000
    and rating between 1 and 5
  );


-- Only the signed-in owner can delete reviews.
grant delete, update on public.landscaping_reviews to authenticated;

drop policy if exists "Owner can delete landscaping reviews" on public.landscaping_reviews;
create policy "Owner can delete landscaping reviews"
  on public.landscaping_reviews for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'lawsonhughes53@gmail.com');

drop policy if exists "Owner can pin landscaping reviews" on public.landscaping_reviews;
create policy "Owner can pin landscaping reviews"
  on public.landscaping_reviews for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'lawsonhughes53@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'lawsonhughes53@gmail.com');
