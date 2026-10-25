ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS partner_logos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS partner_ticker_seconds integer NOT NULL DEFAULT 28;

ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_partner_ticker_seconds_range
  CHECK (partner_ticker_seconds BETWEEN 12 AND 90);

COMMENT ON COLUMN public.platform_settings.partner_logos IS
  'Admin-managed public partner logos: array of {name, logo_url, website_url?}. Only approved partner logos should be listed.';
