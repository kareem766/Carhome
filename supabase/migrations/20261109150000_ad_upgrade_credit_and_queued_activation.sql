-- Track remaining payment on pending upgrades and queue approved follow-up plans.
alter table public.vehicle_promotions
  add column if not exists previous_payment_credit_egp numeric not null default 0,
  add column if not exists payment_due_egp numeric;

update public.vehicle_promotions
   set payment_due_egp = coalesce(final_amount_egp, 0)
 where payment_due_egp is null;

create or replace function app_private.set_vehicle_promotion_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_duration_days integer;
  v_was_activated boolean := false;
  v_next_start timestamptz;
begin
  if new.status = 'approved'
     and new.payment_status in ('verified', 'waived') then
    select p.duration_days into v_duration_days
      from public.advertising_plans p
     where p.id = new.advertising_plan_id and p.is_active = true;
    if v_duration_days is null or v_duration_days < 1 then
      raise exception 'The selected advertising plan is unavailable or has no valid duration';
    end if;
    if tg_op = 'INSERT' then
      v_was_activated := true;
    else
      v_was_activated := old.status is distinct from 'approved'
        or old.payment_status not in ('verified', 'waived');
    end if;
    if v_was_activated or new.starts_at is null or new.ends_at is null then
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
