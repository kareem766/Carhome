-- Managed sourcing provider invitations, offer intake, and company result publishing.
alter table public.managed_sourcing_requests
  add column if not exists results_published_at timestamptz,
  add column if not exists results_published_by uuid references auth.users(id);

alter table public.managed_sourcing_offers
  add column if not exists invite_id uuid;

create table if not exists public.managed_sourcing_invites (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.managed_sourcing_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  request_title text not null,
  request_vehicle_type text not null,
  request_quantity integer not null,
  request_makes_models text[] not null default '{}',
  request_model_year_min integer,
  request_model_year_max integer,
  request_governorates text[] not null default '{}',
  request_duration_type text not null,
  request_duration_months integer not null,
  request_start_date date,
  request_budget_per_vehicle_egp numeric,
  request_requirements text not null default '',
  match_score smallint not null default 0 check (match_score between 0 and 100),
  match_reasons text[] not null default '{}',
  status text not null default 'sent'
    check (status in ('sent','viewed','responded','expired','withdrawn')),
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, user_id, vehicle_id)
);

alter table public.managed_sourcing_offers
  add constraint managed_sourcing_offers_invite_id_fkey
  foreign key (invite_id) references public.managed_sourcing_invites(id) on delete set null;

create unique index if not exists managed_sourcing_offers_invite_id_uidx
  on public.managed_sourcing_offers(invite_id)
  where invite_id is not null;
create index if not exists managed_sourcing_invites_user_status_idx
  on public.managed_sourcing_invites(user_id, status, sent_at desc);
create index if not exists managed_sourcing_invites_request_idx
  on public.managed_sourcing_invites(request_id, status);
create index if not exists managed_sourcing_invites_vehicle_idx
  on public.managed_sourcing_invites(vehicle_id);

alter table public.managed_sourcing_invites enable row level security;
revoke all on table public.managed_sourcing_invites from anon, authenticated;
grant select on table public.managed_sourcing_invites to authenticated;

drop policy if exists "managed sourcing invites read own or admin" on public.managed_sourcing_invites;
create policy "managed sourcing invites read own or admin"
on public.managed_sourcing_invites
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
);

create or replace function public.dispatch_managed_sourcing_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.managed_sourcing_requests%rowtype;
  v_invites integer := 0;
  v_recipients integer := 0;
  v_now timestamptz := now();
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  ) then
    raise exception 'غير مصرح لك بإرسال تفويضات البحث';
  end if;

  select * into v_request
  from public.managed_sourcing_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'تفويض البحث غير موجود';
  end if;

  if v_request.status not in ('searching','gathering_offers') then
    raise exception 'يجب اعتماد التفويض وبدء البحث قبل إرساله للمؤهلين';
  end if;

  if v_request.payment_status not in ('verified','not_required') then
    raise exception 'لا يمكن إرسال التفويض قبل تأكيد رسوم الخدمة';
  end if;

  with eligible as (
    select
      m.user_id,
      v.organization_id,
      v.id as vehicle_id,
      case
        when cardinality(coalesce(v_request.governorates, '{}'::text[])) > 0
          and v.governorate = any(v_request.governorates) then 25
        when cardinality(coalesce(v_request.governorates, '{}'::text[])) = 0 then 15
        else 0
      end
      + case
        when v_request.vehicle_type in ('','أي نوع مناسب','أخرى')
          or lower(btrim(v.vehicle_type)) = lower(btrim(v_request.vehicle_type)) then 25
        else 0
      end
      + case
        when (v_request.model_year_min is null or v.model_year >= v_request.model_year_min)
          and (v_request.model_year_max is null or v.model_year <= v_request.model_year_max) then 15
        else 0
      end
      + case
        when cardinality(coalesce(v_request.makes_models, '{}'::text[])) = 0 then 15
        when exists (
          select 1 from unnest(v_request.makes_models) mm
          where (v.make || ' ' || v.model) ilike ('%' || mm || '%')
        ) then 15
        else 0
      end
      + case
        when v_request.budget_per_vehicle_egp is null
          or v.monthly_price_egp <= v_request.budget_per_vehicle_egp then 20
        else 5
      end as match_score,
      array_remove(array[
        case when cardinality(coalesce(v_request.governorates, '{}'::text[])) = 0
          or v.governorate = any(v_request.governorates) then 'الموقع مناسب' end,
        case when v_request.vehicle_type in ('','أي نوع مناسب','أخرى')
          or lower(btrim(v.vehicle_type)) = lower(btrim(v_request.vehicle_type)) then 'نوع المركبة مطابق' end,
        case when (v_request.model_year_min is null or v.model_year >= v_request.model_year_min)
          and (v_request.model_year_max is null or v.model_year <= v_request.model_year_max) then 'سنة الصنع ضمن المطلوب' end,
        case when cardinality(coalesce(v_request.makes_models, '{}'::text[])) = 0
          or exists (select 1 from unnest(v_request.makes_models) mm
            where (v.make || ' ' || v.model) ilike ('%' || mm || '%'))
          then 'الماركة أو الموديل مناسب' end,
        case when v_request.budget_per_vehicle_egp is null
          or v.monthly_price_egp <= v_request.budget_per_vehicle_egp then 'السعر ضمن الميزانية' end
      ], null) as match_reasons
    from public.vehicles v
    join public.organizations o on o.id = v.organization_id
    join public.organization_memberships m on m.organization_id = v.organization_id
    where o.organization_type in ('individual_owner','fleet_supplier')
      and o.approval_status = 'approved'
      and v.review_status = 'approved'
      and v.payment_status in ('verified','waived')
      and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
      and (
        o.organization_type <> 'individual_owner'
        or (v.registration_expires_at is not null and v.registration_expires_at > v_now)
      )
      and (
        cardinality(coalesce(v_request.governorates, '{}'::text[])) = 0
        or v.governorate = any(v_request.governorates)
      )
      and (
        v_request.vehicle_type in ('','أي نوع مناسب','أخرى')
        or lower(btrim(v.vehicle_type)) = lower(btrim(v_request.vehicle_type))
      )
      and (v_request.model_year_min is null or v.model_year >= v_request.model_year_min)
      and (v_request.model_year_max is null or v.model_year <= v_request.model_year_max)
      and (
        cardinality(coalesce(v_request.makes_models, '{}'::text[])) = 0
        or exists (select 1 from unnest(v_request.makes_models) mm
          where (v.make || ' ' || v.model) ilike ('%' || mm || '%'))
      )
  ),
  inserted as (
    insert into public.managed_sourcing_invites (
      request_id,user_id,organization_id,vehicle_id,
      request_title,request_vehicle_type,request_quantity,request_makes_models,
      request_model_year_min,request_model_year_max,request_governorates,
      request_duration_type,request_duration_months,request_start_date,
      request_budget_per_vehicle_egp,request_requirements,match_score,match_reasons,
      status,sent_at
    )
    select
      v_request.id,e.user_id,e.organization_id,e.vehicle_id,
      v_request.title,v_request.vehicle_type,v_request.quantity,v_request.makes_models,
      v_request.model_year_min,v_request.model_year_max,v_request.governorates,
      v_request.duration_type,v_request.duration_months,v_request.start_date,
      v_request.budget_per_vehicle_egp,v_request.requirements,e.match_score,e.match_reasons,
      'sent',v_now
    from eligible e
    on conflict (request_id,user_id,vehicle_id) do nothing
    returning id,user_id
  )
  select count(*),count(distinct user_id)
  into v_invites,v_recipients
  from inserted;

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select distinct i.user_id,
    'تفويض بحث جديد مناسب لسيارتك',
    'لديك فرصة بحث جديدة من My Car عربيتي. راجع المواصفات وقدّم عرضك إذا كانت سيارتك متاحة.',
    'managed_sourcing_request',
    '/workspace/provider/managed-sourcing',
    (select auth.uid())
  from public.managed_sourcing_invites i
  where i.request_id = p_request_id and i.sent_at = v_now
  on conflict do nothing;

  update public.managed_sourcing_requests
  set status = 'gathering_offers', updated_at = v_now
  where id = p_request_id;

  insert into public.managed_sourcing_updates(request_id,created_by,visibility,title,body,status_from,status_to)
  values (
    p_request_id,(select auth.uid()),'internal','إرسال التفويض للمؤهلين',
    format('تم إرسال التفويض إلى %s مستخدم مؤهل عبر %s مركبة.',v_recipients,v_invites),
    v_request.status,'gathering_offers'
  );

  return jsonb_build_object(
    'invited_users',v_recipients,
    'invited_vehicles',v_invites,
    'dispatched_at',v_now
  );
end;
$function$;

create or replace function public.mark_managed_sourcing_invite_viewed(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.managed_sourcing_invites
  set status = case when status = 'sent' then 'viewed' else status end,
      viewed_at = coalesce(viewed_at,now())
  where id = p_invite_id
    and user_id = (select auth.uid())
    and status in ('sent','viewed');
  return found;
end;
$function$;

create or replace function public.submit_managed_sourcing_invite_offer(
  p_invite_id uuid,
  p_monthly_price_egp numeric,
  p_yearly_price_egp numeric default null,
  p_availability_status text default 'available',
  p_terms text default '',
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invite public.managed_sourcing_invites%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_offer_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'يجب تسجيل الدخول لتقديم العرض';
  end if;

  if p_monthly_price_egp is null or p_monthly_price_egp < 0
     or (p_yearly_price_egp is not null and p_yearly_price_egp < 0) then
    raise exception 'أدخل أسعارًا صحيحة وغير سالبة';
  end if;

  if p_availability_status not in ('available','limited','awaiting_confirmation') then
    raise exception 'حالة التوافر غير صحيحة';
  end if;

  select * into v_invite
  from public.managed_sourcing_invites i
  where i.id = p_invite_id
    and i.user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'دعوة البحث غير موجودة أو غير مخصصة لحسابك';
  end if;

  if v_invite.status not in ('sent','viewed') then
    raise exception 'تم الرد على هذه الدعوة أو لم تعد متاحة';
  end if;

  select v.* into v_vehicle
  from public.vehicles v
  join public.organization_memberships m on m.organization_id = v.organization_id
  where v.id = v_invite.vehicle_id
    and v.organization_id = v_invite.organization_id
    and m.user_id = (select auth.uid())
    and v.review_status = 'approved'
    and v.payment_status in ('verified','waived')
    and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
    and (
      exists (
        select 1 from public.organizations o
        where o.id = v.organization_id
          and (o.organization_type <> 'individual_owner'
            or (v.registration_expires_at is not null and v.registration_expires_at > now()))
      )
    );

  if not found then
    raise exception 'لم تعد السيارة مستوفية لشروط المشاركة في هذا البحث';
  end if;

  insert into public.managed_sourcing_offers(
    request_id,invite_id,vehicle_id,supplier_organization_id,
    make,model,model_year,vehicle_type,seats,governorate,
    monthly_price_egp,yearly_price_egp,availability_status,outreach_status,
    terms,notes,recommendation_rank,company_decision,created_by
  ) values (
    v_invite.request_id,v_invite.id,v_vehicle.id,v_vehicle.organization_id,
    v_vehicle.make,v_vehicle.model,v_vehicle.model_year,v_vehicle.vehicle_type,
    v_vehicle.seats,v_vehicle.governorate,p_monthly_price_egp,p_yearly_price_egp,
    p_availability_status,'price_received',left(coalesce(p_terms,''),2000),
    left(coalesce(p_notes,''),2000),0,'pending',(select auth.uid())
  )
  returning id into v_offer_id;

  update public.managed_sourcing_invites
  set status = 'responded',responded_at = now()
  where id = v_invite.id;

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select pa.user_id,'عرض جديد على تفويض البحث',
    'وصل عرض جديد من أحد مقدمي السيارات. راجعه من مركز تشغيل التفويضات.',
    'managed_sourcing_update','/workspace/admin/managed-sourcing-center',(select auth.uid())
  from public.platform_admins pa
  on conflict do nothing;

  return v_offer_id;
end;
$function$;

create or replace function public.publish_managed_sourcing_results(
  p_request_id uuid,
  p_offer_ids uuid[],
  p_company_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.managed_sourcing_requests%rowtype;
  v_selected integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  ) then
    raise exception 'غير مصرح لك بإرسال نتائج البحث';
  end if;

  if coalesce(cardinality(p_offer_ids),0) = 0 then
    raise exception 'اختر عرضًا واحدًا على الأقل لإرساله للشركة';
  end if;

  select * into v_request
  from public.managed_sourcing_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'تفويض البحث غير موجود';
  end if;

  select count(*) into v_selected
  from public.managed_sourcing_offers o
  where o.request_id = p_request_id
    and o.id = any(p_offer_ids);

  if v_selected <> cardinality(p_offer_ids) then
    raise exception 'توجد عروض مختارة لا تتبع هذا التفويض';
  end if;

  update public.managed_sourcing_offers o
  set company_decision = case when o.id = any(p_offer_ids) then 'selected' else 'rejected' end,
      recommendation_rank = case
        when o.id = any(p_offer_ids) then array_position(p_offer_ids,o.id)
        else o.recommendation_rank
      end,
      updated_at = now()
  where o.request_id = p_request_id;

  update public.managed_sourcing_requests
  set status = 'results_ready',
      results_published_at = now(),
      results_published_by = (select auth.uid()),
      updated_at = now()
  where id = p_request_id;

  insert into public.managed_sourcing_updates(
    request_id,created_by,visibility,title,body,status_from,status_to
  ) values (
    p_request_id,(select auth.uid()),'company','نتيجة البحث جاهزة لشركتك',
    coalesce(nullif(left(btrim(p_company_message),2000),''),'أنهى فريق My Car مراجعة العروض وتجهيز الخيارات المرشحة. يمكنك مراجعة المقارنة واتخاذ قرارك من حساب الشركة.'),
    v_request.status,'results_ready'
  );

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select m.user_id,'نتيجة البحث أصبحت جاهزة',
    'تم تجهيز العروض المرشحة لتفويض البحث الخاص بشركتك. افتح حسابك لمراجعة التقرير.',
    'managed_sourcing_update',
    '/workspace/company/managed-sourcing',
    (select auth.uid())
  from public.organization_memberships m
  where m.organization_id = v_request.company_organization_id
  on conflict do nothing;

  return jsonb_build_object('published_offers',v_selected,'published_at',now());
end;
$function$;

revoke execute on function public.dispatch_managed_sourcing_request(uuid) from public, anon;
revoke execute on function public.mark_managed_sourcing_invite_viewed(uuid) from public, anon;
revoke execute on function public.submit_managed_sourcing_invite_offer(uuid,numeric,numeric,text,text,text) from public, anon;
revoke execute on function public.publish_managed_sourcing_results(uuid,uuid[],text) from public, anon;
grant execute on function public.dispatch_managed_sourcing_request(uuid) to authenticated;
grant execute on function public.mark_managed_sourcing_invite_viewed(uuid) to authenticated;
grant execute on function public.submit_managed_sourcing_invite_offer(uuid,numeric,numeric,text,text,text) to authenticated;
grant execute on function public.publish_managed_sourcing_results(uuid,uuid[],text) to authenticated;

drop policy if exists "managed sourcing offers read own or admin" on public.managed_sourcing_offers;
create policy "managed sourcing offers read own or admin"
on public.managed_sourcing_offers
for select to authenticated
using (
  exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
  or (
    company_decision = 'selected'
    and exists (
      select 1
      from public.managed_sourcing_requests r
      join public.organization_memberships m on m.organization_id = r.company_organization_id
      where r.id = managed_sourcing_offers.request_id
        and m.user_id = (select auth.uid())
        and r.status in ('results_ready','awaiting_company_choice','completed')
    )
  )
);
