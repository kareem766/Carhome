-- Rollback for 20261024000600_internal_messaging.sql
drop policy if exists "members can see related organization names" on public.organizations;
drop table if exists public.messages;
drop table if exists public.conversations;
