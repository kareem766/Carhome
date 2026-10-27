-- Add indexes for foreign keys flagged by the Supabase performance advisor.
-- These are non-destructive and improve joins and parent-row updates/deletes.
create index if not exists idx_advertising_plans_updated_by on public.advertising_plans (updated_by);
create index if not exists idx_company_subscriptions_created_by on public.company_subscriptions (created_by);
create index if not exists idx_company_subscriptions_plan_id on public.company_subscriptions (plan_id);
create index if not exists idx_company_subscriptions_reviewed_by on public.company_subscriptions (reviewed_by);
create index if not exists idx_conversations_created_by on public.conversations (created_by);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_messages_sender_organization_id on public.messages (sender_organization_id);
create index if not exists idx_platform_banners_created_by on public.platform_banners (created_by);
create index if not exists idx_platform_banners_updated_by on public.platform_banners (updated_by);
create index if not exists idx_platform_notifications_created_by on public.platform_notifications (created_by);
create index if not exists idx_platform_settings_updated_by on public.platform_settings (updated_by);
create index if not exists idx_platform_subscription_plans_updated_by on public.platform_subscription_plans (updated_by);
create index if not exists idx_rental_offers_created_by on public.rental_offers (created_by);
create index if not exists idx_rental_offers_organization_id on public.rental_offers (organization_id);
create index if not exists idx_rental_requests_created_by on public.rental_requests (created_by);
create index if not exists idx_rental_requests_organization_id on public.rental_requests (organization_id);
create index if not exists idx_vehicle_images_created_by on public.vehicle_images (created_by);
create index if not exists idx_vehicle_images_organization_id on public.vehicle_images (organization_id);
create index if not exists idx_vehicle_payment_submissions_organization_id on public.vehicle_payment_submissions (organization_id);
create index if not exists idx_vehicle_payment_submissions_reviewed_by on public.vehicle_payment_submissions (reviewed_by);
create index if not exists idx_vehicle_payment_submissions_submitted_by on public.vehicle_payment_submissions (submitted_by);
create index if not exists idx_vehicle_promotions_advertising_plan_id on public.vehicle_promotions (advertising_plan_id);
create index if not exists idx_vehicle_promotions_created_by on public.vehicle_promotions (created_by);
create index if not exists idx_vehicle_promotions_reviewed_by on public.vehicle_promotions (reviewed_by);
create index if not exists idx_vehicle_promotions_vehicle_id on public.vehicle_promotions (vehicle_id);
create index if not exists idx_vehicles_created_by on public.vehicles (created_by);
