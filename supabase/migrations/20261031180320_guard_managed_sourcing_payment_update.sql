-- Restrict company updates to the two payment-submission fields.
-- RLS controls which request row can be updated; this trigger additionally prevents
-- a company member from changing unrelated request fields through the table-level UPDATE grant.
create or replace function public.guard_managed_sourcing_company_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Trusted service-role operations and platform administrators retain existing behavior.
  if auth.role() = 'service_role'
     or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())) then
    return new;
  end if;

  if (to_jsonb(new) - array['payment_reference', 'payment_submitted_at'])
     is distinct from
     (to_jsonb(old) - array['payment_reference', 'payment_submitted_at']) then
    raise exception 'Company members may only submit payment reference fields for managed sourcing requests'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_managed_sourcing_company_payment_update on public.managed_sourcing_requests;
create trigger guard_managed_sourcing_company_payment_update
before update on public.managed_sourcing_requests
for each row execute function public.guard_managed_sourcing_company_payment_update();

revoke all on function public.guard_managed_sourcing_company_payment_update() from public, anon, authenticated;
