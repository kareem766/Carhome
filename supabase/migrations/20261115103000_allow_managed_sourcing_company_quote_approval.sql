-- Allow a company member to approve a priced managed-sourcing quote,
-- while keeping all other request lifecycle/payment fields protected.
create or replace function public.guard_managed_sourcing_company_payment_update()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  is_platform_admin boolean;
  is_company_member boolean;
  is_quote_approval boolean;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  ) into is_platform_admin;

  if is_platform_admin then
    return new;
  end if;

  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = old.company_organization_id
      and m.user_id = (select auth.uid())
  ) into is_company_member;

  if not is_company_member then
    raise exception 'غير مصرح لك بتحديث طلب الشركة'
      using errcode = '42501';
  end if;

  is_quote_approval :=
    old.status = 'awaiting_company_approval'
    and new.status = 'awaiting_payment'
    and old.company_approved_at is null
    and new.company_approved_at is not null
    and new.payment_status = 'awaiting_payment'
    and coalesce(new.quoted_fee_egp, 0) > 0
    and (to_jsonb(new) - array[
      'status','payment_status','company_approved_at','updated_at'
    ]) = (to_jsonb(old) - array[
      'status','payment_status','company_approved_at','updated_at'
    ]);

  if is_quote_approval then
    return new;
  end if;

  if (to_jsonb(new) - array['payment_reference', 'payment_submitted_at'])
     is distinct from
     (to_jsonb(old) - array['payment_reference', 'payment_submitted_at']) then
    raise exception 'Company members may only approve a priced quote or submit payment reference fields for managed sourcing requests'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
