drop policy if exists "platform admins delete subscription plans" on public.platform_subscription_plans;
drop policy if exists "platform admins update subscription plans" on public.platform_subscription_plans;
drop policy if exists "platform admins insert subscription plans" on public.platform_subscription_plans;
drop policy if exists "active subscription plans are publicly readable" on public.platform_subscription_plans;
drop table if exists public.platform_subscription_plans;
