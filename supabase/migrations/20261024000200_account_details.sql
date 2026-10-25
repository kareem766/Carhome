-- Carhome account details for role-specific onboarding.
-- Reviewed migration only: do not apply to the shared/production database without explicit approval.
alter table public.profiles
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists address text;

alter table public.organizations
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists address text,
  add column if not exists company_type text;

alter table public.profiles
  add constraint profiles_phone_length_check
    check (phone is null or char_length(btrim(phone)) between 7 and 30),
  add constraint profiles_contact_email_length_check
    check (contact_email is null or char_length(btrim(contact_email)) <= 254),
  add constraint profiles_address_length_check
    check (address is null or char_length(btrim(address)) <= 500);

alter table public.organizations
  add constraint organizations_contact_name_length_check
    check (contact_name is null or char_length(btrim(contact_name)) <= 120),
  add constraint organizations_phone_length_check
    check (phone is null or char_length(btrim(phone)) between 7 and 30),
  add constraint organizations_contact_email_length_check
    check (contact_email is null or char_length(btrim(contact_email)) <= 254),
  add constraint organizations_address_length_check
    check (address is null or char_length(btrim(address)) <= 500),
  add constraint organizations_company_type_length_check
    check (company_type is null or char_length(btrim(company_type)) <= 120);

comment on column public.profiles.phone is 'Private contact phone for the authenticated user; protected by profile RLS.';
comment on column public.profiles.contact_email is 'Optional contact email; protected by profile RLS.';
comment on column public.profiles.address is 'Private contact address; protected by profile RLS.';
comment on column public.organizations.phone is 'Organization contact phone; protected by organization membership RLS.';
comment on column public.organizations.contact_email is 'Organization contact email; protected by organization membership RLS.';
comment on column public.organizations.address is 'Organization contact address; protected by organization membership RLS.';
comment on column public.organizations.company_type is 'Company business sector, for company accounts only.';
