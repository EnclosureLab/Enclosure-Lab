-- Stripe Tax order audit fields. Run this in Supabase SQL Editor before deploying the updated Edge Functions.
alter table public.enclosure_orders
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists tax_jurisdiction jsonb,
  add column if not exists tax_breakdown jsonb,
  add column if not exists final_total numeric(12,2);
comment on column public.enclosure_orders.tax_amount is 'Final Stripe Tax amount recorded from the paid Checkout Session.';
comment on column public.enclosure_orders.tax_jurisdiction is 'Address source and customer jurisdiction used by Stripe Tax.';
comment on column public.enclosure_orders.tax_breakdown is 'Stripe-provided tax breakdown from the completed Checkout Session.';
comment on column public.enclosure_orders.final_total is 'Final amount charged by Stripe, including applicable taxes and shipping.';
