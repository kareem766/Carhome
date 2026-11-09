alter table public.vehicle_promotions
  add column if not exists previous_payment_reference text,
  add column if not exists previous_payment_amount_egp numeric(12,2) not null default 0;

alter table public.vehicle_promotions
  drop constraint if exists vehicle_promotions_previous_payment_amount_nonnegative;

alter table public.vehicle_promotions
  add constraint vehicle_promotions_previous_payment_amount_nonnegative
  check (previous_payment_amount_egp >= 0);

comment on column public.vehicle_promotions.previous_payment_reference is
  'References for earlier transfers claimed as credit during a pending plan upgrade; admin must verify each reference before approval.';

comment on column public.vehicle_promotions.previous_payment_amount_egp is
  'Total claimed amount of earlier transfers represented by previous_payment_reference; not verified until admin approves the promotion.';
