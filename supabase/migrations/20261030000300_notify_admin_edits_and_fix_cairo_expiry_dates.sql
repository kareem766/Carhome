-- Notify users when administrators edit their account, organization, vehicle, payment, subscription, or promotion details.
create or replace function app_private.notify_admin_profile_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid())
     and (new.display_name is distinct from old.display_name or new.phone is distinct from old.phone or new.contact_email is distinct from old.contact_email or new.address is distinct from old.address) then
    perform app_private.create_user_notification(new.id,'تم تحديث بيانات حسابك','قامت إدارة My Car بتحديث بعض بيانات حسابك. يمكنك مراجعة بياناتك من مساحة العمل.','account_details_updated','/workspace');
  end if;
  return new;
end $$;

create or replace function app_private.notify_admin_organization_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid())
     and (new.name is distinct from old.name or new.contact_name is distinct from old.contact_name or new.contact_email is distinct from old.contact_email or new.phone is distinct from old.phone or new.address is distinct from old.address or new.city is distinct from old.city) then
    perform app_private.notify_organization_members(new.id,'تم تحديث بيانات حسابك','قامت إدارة My Car بتعديل بعض بيانات الحساب أو المؤسسة. يمكنك مراجعة بياناتك من مساحة العمل.','account_details_updated','/workspace',new.created_by);
  end if;
  return new;
end $$;

create or replace function app_private.notify_admin_vehicle_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid())
     and new.review_status is not distinct from old.review_status
     and (new.make is distinct from old.make or new.model is distinct from old.model or new.model_year is distinct from old.model_year or new.monthly_price_egp is distinct from old.monthly_price_egp or new.yearly_price_egp is distinct from old.yearly_price_egp or new.address is distinct from old.address or new.notes is distinct from old.notes) then
    perform app_private.notify_organization_members(new.organization_id,'تم تعديل بيانات سيارتك','قامت إدارة My Car بتحديث بيانات السيارة '||new.make||' '||new.model||'. راجع بيانات السيارة من حسابك.','vehicle_details_updated','/workspace/owner/vehicles',new.created_by);
  end if;
  return new;
end $$;

create or replace function app_private.notify_admin_payment_note()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid())
     and new.admin_notes is distinct from old.admin_notes and new.review_status is not distinct from old.review_status then
    perform app_private.create_user_notification(new.submitted_by,'هناك ملاحظة جديدة على إثبات التحويل',coalesce(new.admin_notes,'أضافت إدارة المنصة تحديثًا على إثبات التحويل.'),'payment_admin_note','/workspace/owner/vehicles');
  end if;
  return new;
end $$;

create or replace function app_private.notify_admin_subscription_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid())
     and new.status is not distinct from old.status and new.payment_status is not distinct from old.payment_status
     and (new.ends_at is distinct from old.ends_at or new.plan_name is distinct from old.plan_name or new.amount_egp is distinct from old.amount_egp) then
    perform app_private.notify_organization_members(new.organization_id,'تم تحديث تفاصيل اشتراك شركتك','قامت إدارة My Car بتعديل تفاصيل الاشتراك أو تاريخ انتهائه. راجع مساحة شركتك للتفاصيل.','subscription_details_updated','/workspace/company',new.created_by);
  end if;
  return new;
end $$;

create or replace function app_private.notify_admin_promotion_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid())
     and new.status is not distinct from old.status and new.payment_status is not distinct from old.payment_status
     and (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at) then
    perform app_private.notify_organization_members(new.organization_id,'تم تحديث مدة إعلان سيارتك','قامت إدارة My Car بتعديل مدة الإعلان أو تاريخ انتهائه. راجع تفاصيل الإعلان من حسابك.','advertisement_details_updated','/workspace/owner/vehicles',new.created_by);
  end if;
  return new;
end $$;

drop trigger if exists profiles_notify_admin_edit on public.profiles;
create trigger profiles_notify_admin_edit after update on public.profiles for each row execute function app_private.notify_admin_profile_edit();
drop trigger if exists organizations_notify_admin_edit on public.organizations;
create trigger organizations_notify_admin_edit after update on public.organizations for each row execute function app_private.notify_admin_organization_edit();
drop trigger if exists vehicles_notify_admin_edit on public.vehicles;
create trigger vehicles_notify_admin_edit after update on public.vehicles for each row execute function app_private.notify_admin_vehicle_edit();
drop trigger if exists vehicle_payment_submissions_notify_admin_note on public.vehicle_payment_submissions;
create trigger vehicle_payment_submissions_notify_admin_note after update on public.vehicle_payment_submissions for each row execute function app_private.notify_admin_payment_note();
drop trigger if exists company_subscriptions_notify_admin_edit on public.company_subscriptions;
create trigger company_subscriptions_notify_admin_edit after update on public.company_subscriptions for each row execute function app_private.notify_admin_subscription_edit();
drop trigger if exists vehicle_promotions_notify_admin_edit on public.vehicle_promotions;
create trigger vehicle_promotions_notify_admin_edit after update on public.vehicle_promotions for each row execute function app_private.notify_admin_promotion_edit();

create or replace function app_private.send_expiry_notifications()
returns integer language plpgsql security definer set search_path = '' as $$
declare sent_count integer:=0; item record; days_left integer; cairo_today date:=(now() at time zone 'Africa/Cairo')::date;
begin
  for item in select vp.id,vp.organization_id,vp.created_by,vp.ends_at,v.make,v.model from public.vehicle_promotions vp join public.vehicles v on v.id=vp.vehicle_id
    where vp.status in ('active','approved') and vp.ends_at is not null and (vp.ends_at at time zone 'Africa/Cairo')::date in (cairo_today+7,cairo_today+3,cairo_today+1)
  loop
    days_left:=(item.ends_at at time zone 'Africa/Cairo')::date-cairo_today;
    perform app_private.notify_organization_members(item.organization_id,case when days_left=1 then 'إعلان سيارتك ينتهي غدًا' else 'اقترب موعد انتهاء إعلان سيارتك' end,'يتبقى '||days_left||' أيام على انتهاء إعلان '||item.make||' '||item.model||'. يمكنك تجديد الباقة من حسابك.','advertisement_expiring_'||days_left,'/workspace/owner/vehicles',item.created_by);
    sent_count:=sent_count+1;
  end loop;
  for item in select cs.id,cs.organization_id,cs.created_by,cs.ends_at,cs.plan_name from public.company_subscriptions cs
    where cs.status='active' and cs.ends_at is not null and (cs.ends_at at time zone 'Africa/Cairo')::date in (cairo_today+7,cairo_today+3,cairo_today+1)
  loop
    days_left:=(item.ends_at at time zone 'Africa/Cairo')::date-cairo_today;
    perform app_private.notify_organization_members(item.organization_id,case when days_left=1 then 'اشتراك شركتك ينتهي غدًا' else 'اقترب موعد انتهاء اشتراك شركتك' end,'يتبقى '||days_left||' أيام على انتهاء اشتراك '||coalesce(item.plan_name,'الشركة')||'. جدد الاشتراك لتجنب انقطاع المزايا.','subscription_expiring_'||days_left,'/workspace/company',item.created_by);
    sent_count:=sent_count+1;
  end loop;
  for item in select v.id,v.organization_id,v.created_by,v.registration_expires_at,v.make,v.model from public.vehicles v
    where v.review_status='approved' and v.registration_expires_at is not null and (v.registration_expires_at at time zone 'Africa/Cairo')::date in (cairo_today+7,cairo_today+3,cairo_today+1)
  loop
    days_left:=(item.registration_expires_at at time zone 'Africa/Cairo')::date-cairo_today;
    perform app_private.notify_organization_members(item.organization_id,case when days_left=1 then 'رسوم تسجيل سيارتك تنتهي غدًا' else 'اقترب موعد تجديد تسجيل السيارة' end,'يتبقى '||days_left||' أيام على انتهاء تسجيل '||item.make||' '||item.model||'. استكمل التجديد من حسابك.','vehicle_registration_expiring_'||days_left,'/workspace/owner/vehicles',item.created_by);
    sent_count:=sent_count+1;
  end loop;
  return sent_count;
end $$;
