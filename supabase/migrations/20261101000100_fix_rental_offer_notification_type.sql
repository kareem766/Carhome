-- Keep rental-offer notifications within the notification_type values allowed by platform_notifications.
create or replace function app_private.notify_rental_offer_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_row record;
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
    perform app_private.notify_organization_members(
      new.organization_id,
      'تم تحديث حالة عرضك',
      'تم تحديث حالة عرضك المقدم على طلب التأجير. افتح حسابك لمتابعة التفاصيل.',
      'request',
      '/workspace/supplier/requests',
      new.created_by
    );
  end if;
  return new;
end;
$function$;
