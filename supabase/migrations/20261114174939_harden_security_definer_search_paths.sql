-- Harden SECURITY DEFINER function search paths by placing pg_temp last.
-- This prevents temporary-schema object shadowing while preserving required schemas.
alter function public.apply_discount_code_to_payment() set search_path = public, auth, pg_temp;
alter function public.company_accept_invitation(uuid) set search_path = public, auth, pg_temp;
alter function public.company_get_invitation(uuid) set search_path = public, auth, pg_temp;
alter function public.guard_organization_approval_status() set search_path = public, pg_temp;
alter function public.notify_company_subscription_change() set search_path = public, pg_temp;
alter function public.notify_organization_approval_change() set search_path = public, pg_temp;
alter function public.notify_organization_members(uuid, text, text, text, text, uuid) set search_path = public, pg_temp;
alter function public.notify_vehicle_payment_review_change() set search_path = public, pg_temp;
alter function public.notify_vehicle_review_change() set search_path = public, pg_temp;
alter function public.preview_discount_code(text, text, uuid, text, integer) set search_path = public, auth, pg_temp;
alter function public.sync_discount_redemption_status() set search_path = public, pg_temp;
