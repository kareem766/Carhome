create or replace function public.notify_company_when_vehicle_provider_replies()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_provider_id uuid;
  v_vehicle_id uuid;
  v_vehicle_label text;
  v_recipient_org_id uuid;
  v_title text;
  v_body text;
begin
  select c.company_organization_id, c.provider_organization_id, c.vehicle_id,
         concat_ws(' ', v.make, v.model, v.model_year::text)
    into v_company_id, v_provider_id, v_vehicle_id, v_vehicle_label
  from public.conversations c
  left join public.vehicles v on v.id=c.vehicle_id
  where c.id=new.conversation_id;

  if v_vehicle_id is null then
    return new;
  end if;

  if new.sender_organization_id = v_provider_id then
    v_recipient_org_id := v_company_id;
    v_title := 'رد مالك السيارة على عرضك';
    v_body := 'قام مالك السيارة بالرد على عرضك ورسالتك بخصوص ' ||
      coalesce(nullif(v_vehicle_label,''),'السيارة') ||
      '. افتح المحادثة لمتابعة الرد.';
  elsif new.sender_organization_id = v_company_id then
    v_recipient_org_id := v_provider_id;
    v_title := 'رسالة جديدة من الشركة بخصوص سيارتك';
    v_body := 'أرسلت الشركة رسالة بخصوص ' ||
      coalesce(nullif(v_vehicle_label,''),'سيارتك') ||
      '. افتح المحادثة للاطلاع والرد.';
  else
    return new;
  end if;

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select distinct m.user_id,
         v_title,
         v_body,
         'message',
         '/messages?conversation=' || new.conversation_id::text,
         new.sender_id
  from public.organization_memberships m
  where m.organization_id=v_recipient_org_id
    and m.user_id is distinct from new.sender_id;

  return new;
end;
$function$;
