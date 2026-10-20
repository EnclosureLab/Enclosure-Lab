-- Run this script in the Supabase SQL Editor for the existing project:
-- https://supabase.com/dashboard/project/lblrmljsjimrrighqbdo/sql/new
-- Public visitors can submit and read customer reviews. No update/delete policy is granted.

create table if not exists public.landscaping_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_name text not null check (char_length(trim(reviewer_name)) between 1 and 100),
  service_received text not null check (char_length(trim(service_received)) between 1 and 100),
  review text not null check (char_length(trim(review)) between 1 and 2000),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

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
