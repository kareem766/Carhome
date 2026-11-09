-- Avoid evaluating auth.uid() once per row in discount code policies.
alter policy discount_codes_admin_all on public.discount_codes
  using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

alter policy discount_redemptions_admin_read on public.discount_code_redemptions
  using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

alter policy discount_redemptions_user_read_own on public.discount_code_redemptions
  using (user_id = (select auth.uid()));
