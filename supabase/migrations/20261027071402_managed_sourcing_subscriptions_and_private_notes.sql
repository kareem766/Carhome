
-- Add paid monthly sourcing subscriptions, private staff notes, and workflow notifications.
create table if not exists public.managed_sourcing_subscriptions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete restrict, package_id uuid not null references public.managed_sourcing_packages(id) on delete restrict,
 monthly_price_egp numeric(12,2) not null check(monthly_price_egp>=0), requests_included integer not null check(requests_included>=1),
 requests_used integer not null default 0 check(requests_used>=0), payment_reference text not null,
 payment_status text not null default 'submitted' check(payment_status in ('not_submitted','submitted','verified','rejected','refunded')),
 status text not null default 'pending_review' check(status in ('pending_review','active','rejected','expired','cancelled')),
 starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(requests_used<=requests_included), check(status <> 'active' or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);
alter table public.managed_sourcing_requests drop column if exists admin_internal_notes;
alter table public.managed_sourcing_requests add column if not exists subscription_id uuid references public.managed_sourcing_subscriptions(id) on delete set null;
create index if not exists managed_sourcing_subscriptions_company_idx on public.managed_sourcing_subscriptions(organization_id,created_at desc);
create table if not exists public.managed_sourcing_internal_notes (
 id uuid primary key default gen_random_uuid(), request_id uuid references public.managed_sourcing_requests(id) on delete cascade,
 subscription_id uuid references public.managed_sourcing_subscriptions(id) on delete cascade, created_by uuid not null references auth.users(id) on delete restrict,
 note text not null check(char_length(btrim(note)) between 1 and 5000), created_at timestamptz not null default now(),
 check ((request_id is not null)::int + (subscription_id is not null)::int = 1)
);
create index if not exists managed_sourcing_internal_notes_request_idx on public.managed_sourcing_internal_notes(request_id,created_at desc);
create index if not exists managed_sourcing_internal_notes_subscription_idx on public.managed_sourcing_internal_notes(subscription_id,created_at desc);
alter table public.managed_sourcing_subscriptions enable row level security;
alter table public.managed_sourcing_internal_notes enable row level security;
grant select,insert,update,delete on public.managed_sourcing_subscriptions,public.managed_sourcing_internal_notes to authenticated;
drop policy if exists "managed sourcing subscriptions read own or admin" on public.managed_sourcing_subscriptions;
create policy "managed sourcing subscriptions read own or admin" on public.managed_sourcing_subscriptions for select to authenticated using(
 exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
 or exists(select 1 from public.organization_memberships m where m.organization_id=managed_sourcing_subscriptions.organization_id and m.user_id=(select auth.uid()))
);
drop policy if exists "managed sourcing subscriptions create own company" on public.managed_sourcing_subscriptions;
create policy "managed sourcing subscriptions create own company" on public.managed_sourcing_subscriptions for insert to authenticated with check(
 created_by=(select auth.uid()) and status='pending_review' and payment_status='submitted' and requests_used=0
 and exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=managed_sourcing_subscriptions.organization_id and m.user_id=(select auth.uid()) and o.organization_type='company')
 and exists(select 1 from public.managed_sourcing_packages p where p.id=managed_sourcing_subscriptions.package_id and p.is_active=true and p.monthly_price_egp=managed_sourcing_subscriptions.monthly_price_egp and p.included_requests=managed_sourcing_subscriptions.requests_included)
);
drop policy if exists "managed sourcing subscriptions admin update" on public.managed_sourcing_subscriptions;
create policy "managed sourcing subscriptions admin update" on public.managed_sourcing_subscriptions for update to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing subscriptions admin delete" on public.managed_sourcing_subscriptions;
create policy "managed sourcing subscriptions admin delete" on public.managed_sourcing_subscriptions for delete to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing internal notes admin only" on public.managed_sourcing_internal_notes;
create policy "managed sourcing internal notes admin only" on public.managed_sourcing_internal_notes for all to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing requests create own company" on public.managed_sourcing_requests;
create policy "managed sourcing requests create own company" on public.managed_sourcing_requests for insert to authenticated with check(
 created_by=(select auth.uid())
 and exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=company_organization_id and m.user_id=(select auth.uid()) and o.organization_type='company')
 and ((payment_model='per_request' and subscription_id is null) or
 (payment_model='subscription' and subscription_id is not null and exists(
 select 1 from public.managed_sourcing_subscriptions s where s.id=subscription_id and s.organization_id=company_organization_id and s.package_id=managed_sourcing_requests.package_id and s.status='active' and s.payment_status='verified' and s.starts_at<=now() and s.ends_at>now() and s.requests_used<s.requests_included)))
);
create or replace function private.notify_managed_sourcing_request() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP='INSERT' then
  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select a.user_id,'طلب توفير سيارات جديد','وصل طلب جديد من شركة ويحتاج إلى المراجعة.','managed_sourcing_request','/workspace/admin/managed-sourcing',new.created_by from public.platform_admins a;
 elsif new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then
  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  values(new.created_by,'تحديث طلب توفير السيارات',case when new.payment_status='verified' then 'تم تأكيد رسوم الخدمة، وسيبدأ فريق My Car العمل وفق حالة الطلب.' when new.payment_status='rejected' then 'تحتاج بيانات دفع رسوم الخدمة إلى مراجعة. يرجى متابعة الطلب.' else 'حالة طلبك الآن: ' || new.status end,'managed_sourcing_update','/workspace/company/managed-sourcing',coalesce(new.assigned_to,new.created_by));
 end if; return new;
end; $$;
revoke all on function private.notify_managed_sourcing_request() from public;
drop trigger if exists managed_sourcing_request_notify on public.managed_sourcing_requests;
create trigger managed_sourcing_request_notify after insert or update of status,payment_status on public.managed_sourcing_requests for each row execute function private.notify_managed_sourcing_request();
create or replace function private.consume_managed_sourcing_subscription_request() returns trigger language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
 if new.payment_model='subscription' then
  update public.managed_sourcing_subscriptions s set requests_used=s.requests_used+1,updated_at=now()
  where s.id=new.subscription_id and s.organization_id=new.company_organization_id and s.package_id=new.package_id and s.status='active' and s.payment_status='verified' and s.starts_at<=now() and s.ends_at>now() and s.requests_used<s.requests_included;
  get diagnostics updated_count = row_count;
  if updated_count<>1 then raise exception 'No available active managed sourcing subscription requests'; end if;
 end if; return new;
end; $$;
revoke all on function private.consume_managed_sourcing_subscription_request() from public;
drop trigger if exists managed_sourcing_subscription_consume_request on public.managed_sourcing_requests;
create trigger managed_sourcing_subscription_consume_request after insert on public.managed_sourcing_requests for each row execute function private.consume_managed_sourcing_subscription_request();
create or replace function private.notify_managed_sourcing_subscription() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP='INSERT' then
  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select a.user_id,'طلب اشتراك خدمة التوفير','أرسلت شركة طلب اشتراك شهري جديدًا يحتاج إلى مراجعة الدفع.','managed_sourcing_subscription','/workspace/admin/managed-sourcing',new.created_by from public.platform_admins a;
 elsif new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then
  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  values(new.created_by,'تحديث اشتراك خدمة التوفير',case when new.status='active' then 'تم تفعيل باقة التوفير المُدار لشركتك.' when new.payment_status='rejected' then 'بيانات دفع اشتراك خدمة التوفير تحتاج إلى مراجعة.' else 'تم تحديث حالة اشتراك خدمة التوفير.' end,'managed_sourcing_subscription_update','/workspace/company/managed-sourcing',new.created_by);
 end if; return new;
end; $$;
revoke all on function private.notify_managed_sourcing_subscription() from public;
drop trigger if exists managed_sourcing_subscription_notify on public.managed_sourcing_subscriptions;
create trigger managed_sourcing_subscription_notify after insert or update of status,payment_status on public.managed_sourcing_subscriptions for each row execute function private.notify_managed_sourcing_subscription();
