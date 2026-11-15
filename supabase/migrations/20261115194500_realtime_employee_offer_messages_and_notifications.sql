-- Enable live message delivery and notify the other participant in employee offer chats.
-- Existing vehicle conversation notifications are handled by
-- notify_company_on_provider_vehicle_reply (already bidirectional).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employee_rental_offer_messages'
  ) then
    alter publication supabase_realtime add table public.employee_rental_offer_messages;
  end if;
end
$$;

create or replace function public.notify_employee_offer_message_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_user_id uuid;
  v_provider_user_id uuid;
  v_request_title text;
  v_recipient_id uuid;
  v_title text;
  v_body text;
  v_action_url text;
begin
  -- Defense in depth: a message must be attributed to its authenticated sender.
  if auth.uid() is not null and new.sender_user_id <> auth.uid() then
    raise exception 'message sender does not match authenticated user';
  end if;

  select r.employee_user_id, o.created_by, r.title
    into v_employee_user_id, v_provider_user_id, v_request_title
  from public.employee_rental_offers o
  join public.employee_rental_requests r on r.id = o.request_id
  where o.id = new.offer_id;

  if v_employee_user_id is null or v_provider_user_id is null then
    return new;
  end if;

  if new.sender_user_id = v_employee_user_id then
    v_recipient_id := v_provider_user_id;
    v_title := 'رسالة جديدة من الموظف';
    v_body := 'أرسل الموظف رسالة بخصوص ' || coalesce(nullif(v_request_title, ''), 'طلب السيارة') || '. افتح المحادثة للرد.';
    v_action_url := '/workspace/provider/employee-messages?offer=' || new.offer_id::text;
  elsif new.sender_user_id = v_provider_user_id then
    v_recipient_id := v_employee_user_id;
    v_title := 'رسالة جديدة من مقدم العرض';
    v_body := 'أرسل مقدم العرض رسالة بخصوص ' || coalesce(nullif(v_request_title, ''), 'طلب السيارة') || '. افتح المحادثة للرد.';
    v_action_url := '/workspace/employee/messages?offer=' || new.offer_id::text;
  else
    return new;
  end if;

  insert into public.platform_notifications
    (user_id, title, body, notification_type, action_url, created_by)
  values
    (v_recipient_id, v_title, v_body, 'message', v_action_url, new.sender_user_id);

  return new;
end;
$$;

revoke all on function public.notify_employee_offer_message_participant() from public;
drop trigger if exists notify_employee_offer_message_participant on public.employee_rental_offer_messages;
create trigger notify_employee_offer_message_participant
after insert on public.employee_rental_offer_messages
for each row execute function public.notify_employee_offer_message_participant();
