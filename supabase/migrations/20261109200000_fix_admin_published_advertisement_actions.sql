-- Fix admin removal notifications and allow editing dates on an already active
-- promotion even when its historical plan has since been deactivated.

create or replace function public.notify_vehicle_promotion_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.notify_organization_members(
        new.organization_id,
        'تم اعتماد باقة الإعلان',
        'تم اعتماد طلب الترويج وستظهر السيارة ضمن نتائج الترويج وفق مدة الباقة.',
        'promotion',
        '/workspace/catalog',
        null::uuid
      );
    elsif new.status in ('rejected', 'declined') then
      perform public.notify_organization_members(
        new.organization_id,
        'لم تتم الموافقة على الإعلان',
        'لم تتم الموافقة على طلب الترويج. يرجى مراجعة الملاحظات في حسابك.',
        'promotion',
        '/workspace/catalog',
        null::uuid
      );
    elsif new.status = 'expired' then
      perform public.notify_organization_members(
        new.organization_id,
        'انتهت باقة إعلان سيارتك',
        'انتهت مدة باقة الإعلان. يمكنك اختيار باقة جديدة لتجديد الترويج.',
        'promotion_expired',
        '/workspace/catalog',
        null::uuid
      );
    elsif new.status = 'cancelled' and old.status = 'approved' then
      perform public.notify_organization_members(
        new.organization_id,
        'تم حذف إعلان سيارتك من الكتالوج',
        'قامت إدارة My Car بإيقاف ظهور الإعلان وحفظ سجل الدفع والمراجعة. راجع ملاحظات الإدارة من حسابك عند الحاجة.',
        'promotion_removed_by_admin',
        '/workspace/owner/vehicles',
        new.created_by
      );
    end if;
  end if;
  return new;
end;
$function$;

create or replace function app_private.set_vehicle_promotion_period()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_duration_days integer;
  v_was_activated boolean := false;
  v_next_start timestamptz;
begin
  if new.status = 'approved'
     and new.payment_status in ('verified', 'waived') then
    if tg_op = 'INSERT' then
      v_was_activated := true;
    else
      v_was_activated := old.status is distinct from 'approved'
        or old.payment_status not in ('verified', 'waived');
    end if;

    -- Only require an active plan when the database must generate the period.
    -- Admin edits that provide explicit dates must remain possible for legacy
    -- promotions whose original plan has since been deactivated.
    if v_was_activated or new.starts_at is null or new.ends_at is null then
      select p.duration_days into v_duration_days
        from public.advertising_plans p
       where p.id = new.advertising_plan_id and p.is_active = true;

      if v_duration_days is null or v_duration_days < 1 then
        raise exception 'The selected advertising plan is unavailable or has no valid duration';
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
