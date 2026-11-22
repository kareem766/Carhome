CREATE OR REPLACE FUNCTION private.sync_platform_public_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    delete from public.platform_public_settings where id = old.id;
    return old;
  end if;

  insert into public.platform_public_settings (
    id, platform_name, tagline, description, logo_url, favicon_url, support_email,
    support_phone, website_url, address, footer_text, announcement_text, primary_color,
    secondary_color, registration_enabled, owner_registration_enabled,
    company_registration_enabled, supplier_registration_enabled, partner_logos,
    partner_ticker_seconds, owner_vehicle_monthly_fee_egp,
    supplier_vehicle_registration_fee_egp, company_subscription_required,
    maintenance_mode, instapay_number, vodafone_cash_number
  ) values (
    new.id, new.platform_name, new.tagline, new.description, new.logo_url,
    new.favicon_url, new.support_email, new.support_phone, new.website_url, new.address,
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
    support_phone = excluded.support_phone,
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
$function$;

UPDATE public.platform_settings
SET owner_vehicle_monthly_fee_egp = 150,
    support_email = 'Kalnoby0@yahoo.com',
    support_phone = '01096656281',
    address = 'مصر'
WHERE id = true;
