-- Freeze the advertising plan terms on each promotion request.
-- Existing rows are backfilled once; future plan edits never rewrite their terms.
alter table public.vehicle_promotions
  add column if not exists plan_name_snapshot text,
  add column if not exists plan_description_snapshot text,
  add column if not exists plan_duration_days_snapshot integer,
  add column if not exists plan_price_egp_snapshot numeric,
  add column if not exists plan_features_snapshot jsonb,
  add column if not exists plan_display_order_snapshot integer,
  add column if not exists plan_placement_type_snapshot text;

update public.vehicle_promotions vp
set
  plan_name_snapshot = coalesce(vp.plan_name_snapshot, ap.name),
  plan_description_snapshot = coalesce(vp.plan_description_snapshot, ap.description),
  plan_duration_days_snapshot = coalesce(vp.plan_duration_days_snapshot, ap.duration_days),
  plan_price_egp_snapshot = coalesce(vp.plan_price_egp_snapshot, ap.price_egp),
  plan_features_snapshot = coalesce(vp.plan_features_snapshot, ap.features),
  plan_display_order_snapshot = coalesce(vp.plan_display_order_snapshot, ap.display_order),
  plan_placement_type_snapshot = coalesce(vp.plan_placement_type_snapshot, ap.placement_type)
from public.advertising_plans ap
where ap.id = vp.advertising_plan_id;

alter table public.vehicle_promotions
  alter column plan_name_snapshot set not null,
  alter column plan_description_snapshot set not null,
  alter column plan_duration_days_snapshot set not null,
  alter column plan_price_egp_snapshot set not null,
  alter column plan_features_snapshot set not null,
  alter column plan_display_order_snapshot set not null,
  alter column plan_placement_type_snapshot set not null;

create or replace function app_private.set_vehicle_promotion_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan record;
  v_duration_days integer;
  v_was_activated boolean := false;
  v_next_start timestamptz;
  v_plan_changed boolean := false;
begin
  v_plan_changed := tg_op = 'INSERT'
    or old.advertising_plan_id is distinct from new.advertising_plan_id;

  if v_plan_changed
     or new.plan_name_snapshot is null
     or new.plan_description_snapshot is null
     or new.plan_duration_days_snapshot is null
     or new.plan_price_egp_snapshot is null
     or new.plan_features_snapshot is null
     or new.plan_display_order_snapshot is null
     or new.plan_placement_type_snapshot is null then
    select p.name, p.description, p.duration_days, p.price_egp,
           p.features, p.display_order, p.placement_type
      into v_plan
      from public.advertising_plans p
     where p.id = new.advertising_plan_id;

    if not found then
      raise exception 'The selected advertising plan does not exist';
    end if;

    new.plan_name_snapshot := v_plan.name;
    new.plan_description_snapshot := v_plan.description;
    new.plan_duration_days_snapshot := v_plan.duration_days;
    new.plan_price_egp_snapshot := v_plan.price_egp;
    new.plan_features_snapshot := v_plan.features;
    new.plan_display_order_snapshot := v_plan.display_order;
    new.plan_placement_type_snapshot := v_plan.placement_type;
  end if;

  if new.status = 'approved'
     and new.payment_status in ('verified', 'waived') then
    if tg_op = 'INSERT' then
      v_was_activated := true;
    else
      v_was_activated := old.status is distinct from 'approved'
        or old.payment_status not in ('verified', 'waived');
    end if;

    if v_was_activated or new.starts_at is null or new.ends_at is null then
      v_duration_days := new.plan_duration_days_snapshot;

      if v_duration_days is null or v_duration_days < 1 then
        raise exception 'The selected advertising plan has no valid saved duration';
      end if;

      if v_was_activated then
        select greatest(now(), coalesce(max(p.ends_at), now())) into v_next_start
          from public.vehicle_promotions p
         where p.vehicle_id = new.vehicle_id and p.id <> new.id
           and p.status = 'approved' and p.payment_status in ('verified', 'waived')
           and p.ends_at > now();
        new.starts_at := v_next_start;
      elsif new.starts_at is null then
        new.starts_at := now();
      end if;

      new.ends_at := new.starts_at + make_interval(days => v_duration_days);
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

comment on column public.vehicle_promotions.plan_name_snapshot is
  'Advertising plan name captured for this promotion; refreshed only when the promotion is intentionally assigned a different plan.';
comment on column public.vehicle_promotions.plan_duration_days_snapshot is
  'Advertising plan duration captured for this promotion; used when activating the promotion.';
comment on column public.vehicle_promotions.plan_placement_type_snapshot is
  'Advertising placement captured for this promotion; used by catalog rendering.';
