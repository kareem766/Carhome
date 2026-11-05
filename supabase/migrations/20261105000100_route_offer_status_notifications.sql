-- Route rental-offer status notifications to the provider's own offer record.
create or replace function app_private.notify_rental_offer_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_row record;
  provider_type text;
  offer_url text;
begin
  if tg_op = 'INSERT' then
    select rr.organization_id, rr.created_by, rr.title
      into request_row
    from public.rental_requests rr
    where rr.id = new.request_id;

    if request_row.organization_id is not null then
      perform app_private.notify_organization_members(
        request_row.organization_id,
        'وصل عرض جديد لطلب شركتك',
        'وصل عرض جديد على طلب ' || coalesce(request_row.title, 'التأجير') || '. افتح الطلب لمراجعة التفاصيل.',
        'request',
        '/workspace/company/requests',
        request_row.created_by
      );
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    select o.organization_type
      into provider_type
    from public.organizations o
    where o.id = new.organization_id;

    offer_url := case
      when provider_type = 'individual_owner' then '/workspace/owner/offers?offer=' || new.id::text
      else '/workspace/supplier/offers?offer=' || new.id::text
    end;

    perform app_private.notify_organization_members(
      new.organization_id,
      'تم تحديث حالة عرضك',
      'تم تحديث حالة عرضك المقدم على طلب التأجير. افتح العرض لمتابعة التفاصيل والحالة الجديدة.',
      'request',
      offer_url,
      new.created_by
    );
  end if;
  return new;
end;
$function$;
