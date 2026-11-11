create table if not exists public.vehicle_review_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in ('submitted','approved','rejected','resubmitted','updated','status_changed')),
  previous_status text,
  new_status text,
  summary text not null check (char_length(summary) between 1 and 1000),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_review_events_vehicle_created_idx
  on public.vehicle_review_events(vehicle_id, created_at desc);
alter table public.vehicle_review_events enable row level security;
revoke all on public.vehicle_review_events from anon, public;
grant select on public.vehicle_review_events to authenticated;
drop policy if exists "Vehicle review events visible to owner supplier and admins" on public.vehicle_review_events;
create policy "Vehicle review events visible to owner supplier and admins"
on public.vehicle_review_events for select to authenticated
using (
  exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
  or exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_review_events.organization_id
      and m.user_id = (select auth.uid())
  )
);
create or replace function public.capture_vehicle_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    v_type := 'submitted';
    v_summary := 'تم تسجيل السيارة وإرسالها لأول مرة للمراجعة';
    insert into public.vehicle_review_events(vehicle_id, organization_id, event_type, previous_status, new_status, summary, actor_id)
    values (new.id, new.organization_id, v_type, null, new.review_status, v_summary, auth.uid());
    return new;
  end if;
  if old.review_status is distinct from new.review_status then
    if old.review_status = 'rejected' and new.review_status = 'pending_review' then
      v_type := 'resubmitted';
      v_summary := 'تم تعديل بيانات السيارة وإعادة إرسالها للمراجعة';
    elsif new.review_status = 'approved' then
      v_type := 'approved';
      v_summary := 'تم اعتماد السيارة من الإدارة';
    elsif new.review_status = 'rejected' then
      v_type := 'rejected';
      v_summary := 'قررت الإدارة رفض السيارة؛ راجع سبب الرفض الظاهر في تفاصيل السيارة';
    else
      v_type := 'status_changed';
      v_summary := 'تم تغيير حالة مراجعة السيارة من ' || coalesce(old.review_status, 'غير محدد') || ' إلى ' || coalesce(new.review_status, 'غير محدد');
    end if;
  elsif
    old.make is distinct from new.make or old.model is distinct from new.model
    or old.model_year is distinct from new.model_year
    or old.vehicle_type is distinct from new.vehicle_type
    or old.governorate is distinct from new.governorate
    or old.address is distinct from new.address
    or old.monthly_price_egp is distinct from new.monthly_price_egp
    or old.yearly_price_egp is distinct from new.yearly_price_egp
    or old.notes is distinct from new.notes
  then
    v_type := 'updated';
    v_summary := 'تم تحديث بيانات السيارة';
  else
    return new;
  end if;
  insert into public.vehicle_review_events(vehicle_id, organization_id, event_type, previous_status, new_status, summary, actor_id)
  values (new.id, new.organization_id, v_type, old.review_status, new.review_status, v_summary, auth.uid());
  return new;
end;
$$;
revoke all on function public.capture_vehicle_review_event() from public, anon, authenticated;
drop trigger if exists vehicle_review_events_capture on public.vehicles;
create trigger vehicle_review_events_capture
after insert or update of review_status, make, model, model_year, vehicle_type, governorate, address, monthly_price_egp, yearly_price_egp, notes
on public.vehicles
for each row execute function public.capture_vehicle_review_event();
