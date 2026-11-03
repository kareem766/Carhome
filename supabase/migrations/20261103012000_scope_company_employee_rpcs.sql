-- Keep every employee-management RPC scoped to an actual company membership.
-- This migration changes functions only; it does not modify existing memberships or invitations.

create or replace function public.company_change_member_role(
  p_user_id uuid,
  p_role public.organization_member_role
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role public.organization_member_role;
  v_target public.organization_member_role;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول'; end if;

  select m.organization_id, m.role
    into v_org, v_role
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = v_uid
    and o.organization_type = 'company'::public.organization_type
  order by m.created_at
  limit 1;

  if v_role <> 'owner' then
    raise exception 'تغيير صلاحيات الموظفين متاح لمالك الشركة فقط';
  end if;
  if p_role not in ('manager','member') then
    raise exception 'الدور المطلوب غير صالح';
  end if;

  select m.role into v_target
  from public.organization_memberships m
  where m.organization_id = v_org and m.user_id = p_user_id;

  if not found or v_target = 'owner' then
    raise exception 'لا يمكن تغيير صلاحية مالك الشركة أو عضو غير موجود';
  end if;

  update public.organization_memberships
  set role = p_role
  where organization_id = v_org and user_id = p_user_id;

  return true;
end;
$function$;

create or replace function public.company_remove_member(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role public.organization_member_role;
  v_target_role public.organization_member_role;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول'; end if;

  select m.organization_id, m.role
    into v_org, v_role
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = v_uid
    and o.organization_type = 'company'::public.organization_type
  order by m.created_at
  limit 1;

  if v_role not in ('owner','manager') then
    raise exception 'ليست لديك صلاحية إزالة أعضاء';
  end if;

  select m.role into v_target_role
  from public.organization_memberships m
  where m.organization_id = v_org and m.user_id = p_user_id;

  if not found then raise exception 'العضو غير موجود'; end if;
  if v_target_role = 'owner' then raise exception 'لا يمكن إزالة مالك الشركة'; end if;
  if v_role = 'manager' and v_target_role <> 'member' then
    raise exception 'المدير لا يمكنه إزالة مدير آخر';
  end if;
  if p_user_id = v_uid then raise exception 'لا يمكنك إزالة نفسك من هنا'; end if;

  delete from public.organization_memberships
  where organization_id = v_org and user_id = p_user_id;

  return true;
end;
$function$;

create or replace function public.company_revoke_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role public.organization_member_role;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول'; end if;

  select m.organization_id, m.role
    into v_org, v_role
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  join public.organization_invitations i on i.organization_id = m.organization_id
  where m.user_id = v_uid
    and i.id = p_invitation_id
    and o.organization_type = 'company'::public.organization_type;

  if v_role not in ('owner','manager') then
    raise exception 'ليست لديك صلاحية إلغاء الدعوة';
  end if;

  update public.organization_invitations
  set status = 'revoked'
  where id = p_invitation_id
    and organization_id = v_org
    and status = 'pending';

  if not found then raise exception 'الدعوة غير متاحة للإلغاء'; end if;
  return true;
end;
$function$;
