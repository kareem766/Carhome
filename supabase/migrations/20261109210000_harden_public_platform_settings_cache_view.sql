-- Keep the public settings endpoint safe while preserving anonymous and signed-in reads.
-- A dedicated safe table prevents the public view from reading the private admin settings row.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.platform_public_settings as
select
  id, platform_name, tagline, description, logo_url, favicon_url, support_email,
  website_url, address, footer_text, announcement_text, primary_color,
  secondary_color, registration_enabled, owner_registration_enabled,
  company_registration_enabled, supplier_registration_enabled, partner_logos,
  partner_ticker_seconds, owner_vehicle_monthly_fee_egp,
  supplier_vehicle_registration_fee_egp, company_subscription_required,
  maintenance_mode, instapay_number, vodafone_cash_number
from public.platform_settings
with no data;

alter table public.platform_public_settings
  add constraint platform_public_settings_pkey primary key (id);
alter table public.platform_public_settings enable row level security;
grant select on public.platform_public_settings to anon, authenticated;
create policy "Public can read safe platform settings"
  on public.platform_public_settings for select to anon, authenticated using (true);

insert into public.platform_public_settings (
  id, platform_name, tagline, description, logo_url, favicon_url, support_email,
  website_url, address, footer_text, announcement_text, primary_color,
  secondary_color, registration_enabled, owner_registration_enabled,
  company_registration_enabled, supplier_registration_enabled, partner_logos,
  partner_ticker_seconds, owner_vehicle_monthly_fee_egp,
  supplier_vehicle_registration_fee_egp, company_subscription_required,
  maintenance_mode, instapay_number, vodafone_cash_number
)
select
  id, platform_name, tagline, description, logo_url, favicon_url, support_email,
  website_url, address, footer_text, announcement_text, primary_color,
  secondary_color, registration_enabled, owner_registration_enabled,
  company_registration_enabled, supplier_registration_enabled, partner_logos,
  partner_ticker_seconds, owner_vehicle_monthly_fee_egp,
  supplier_vehicle_registration_fee_egp, company_subscription_required,
  maintenance_mode, instapay_number, vodafone_cash_number
from public.platform_settings
on conflict (id) do update set
  platform_name = excluded.platform_name,
  tagline = excluded.tagline,
  description = excluded.description,
  logo_url = excluded.logo_url,
  favicon_url = excluded.favicon_url,
  support_email = excluded.support_email,
  website_url = excluded.website_url,
  address = excluded.address,
  footer_text = excluded.footer_text,
  announcement_text = excluded.announcement_text,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  registration_enabled = excluded.registration_enabled,
  owner_registration_enabled = excluded.owner_registration_enabled,
  company_registration_enabled = excluded.company_registration_enabled,
  supplier_registration_enabled = excluded.supplier_registration_enabled,
  partner_logos = excluded.partner_logos,
  partner_ticker_seconds = excluded.partner_ticker_seconds,
  owner_vehicle_monthly_fee_egp = excluded.owner_vehicle_monthly_fee_egp,
  supplier_vehicle_registration_fee_egp = excluded.supplier_vehicle_registration_fee_egp,
  company_subscription_required = excluded.company_subscription_required,
  maintenance_mode = excluded.maintenance_mode,
  instapay_number = excluded.instapay_number,
  vodafone_cash_number = excluded.vodafone_cash_number;

create or replace function private.sync_platform_public_settings()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.platform_public_settings where id = old.id;
    return old;
  end if;
  insert into public.platform_public_settings (
    id, platform_name, tagline, description, logo_url, favicon_url, support_email,
    website_url, address, footer_text, announcement_text, primary_color,
    secondary_color, registration_enabled, owner_registration_enabled,
    company_registration_enabled, supplier_registration_enabled, partner_logos,
    partner_ticker_seconds, owner_vehicle_monthly_fee_egp,
    supplier_vehicle_registration_fee_egp, company_subscription_required,
    maintenance_mode, instapay_number, vodafone_cash_number
  ) values (
    new.id, new.platform_name, new.tagline, new.description, new.logo_url,
    new.favicon_url, new.support_email, new.website_url, new.address,
    new.footer_text, new.announcement_text, new.primary_color,
    new.secondary_color, new.registration_enabled, new.owner_registration_enabled,
    new.company_registration_enabled, new.supplier_registration_enabled,
    new.partner_logos, new.partner_ticker_seconds, new.owner_vehicle_monthly_fee_egp,
    new.supplier_vehicle_registration_fee_egp, new.company_subscription_required,
    new.maintenance_mode, new.instapay_number, new.vodafone_cash_number
  )
  on conflict (id) do update set
    platform_name = excluded.platform_name,
    tagline = excluded.tagline,
    description = excluded.description,
    logo_url = excluded.logo_url,
    favicon_url = excluded.favicon_url,
    support_email = excluded.support_email,
    website_url = excluded.website_url,
    address = excluded.address,
    footer_text = excluded.footer_text,
    announcement_text = excluded.announcement_text,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    registration_enabled = excluded.registration_enabled,
    owner_registration_enabled = excluded.owner_registration_enabled,
    company_registration_enabled = excluded.company_registration_enabled,
    supplier_registration_enabled = excluded.supplier_registration_enabled,
    partner_logos = excluded.partner_logos,
    partner_ticker_seconds = excluded.partner_ticker_seconds,
    owner_vehicle_monthly_fee_egp = excluded.owner_vehicle_monthly_fee_egp,
    supplier_vehicle_registration_fee_egp = excluded.supplier_vehicle_registration_fee_egp,
    company_subscription_required = excluded.company_subscription_required,
    maintenance_mode = excluded.maintenance_mode,
    instapay_number = excluded.instapay_number,
    vodafone_cash_number = excluded.vodafone_cash_number;
  return new;
end;
$$;
revoke all on function private.sync_platform_public_settings() from public, anon, authenticated;

drop trigger if exists sync_platform_public_settings on public.platform_settings;
create trigger sync_platform_public_settings
after insert or update or delete on public.platform_settings
for each row execute function private.sync_platform_public_settings();

create or replace view public.public_platform_settings
with (security_invoker = true, security_barrier = true)
as
select
  id, platform_name, tagline, description, logo_url, favicon_url, support_email,
  website_url, address, footer_text, announcement_text, primary_color,
  secondary_color, registration_enabled, owner_registration_enabled,
  company_registration_enabled, supplier_registration_enabled, partner_logos,
  partner_ticker_seconds, owner_vehicle_monthly_fee_egp,
  supplier_vehicle_registration_fee_egp, company_subscription_required,
  maintenance_mode, instapay_number, vodafone_cash_number
from public.platform_public_settings;

grant select on public.public_platform_settings to anon, authenticated;
