ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_partner_ticker_seconds_range;
ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS partner_ticker_seconds,
  DROP COLUMN IF EXISTS partner_logos;
