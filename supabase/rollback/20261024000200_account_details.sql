-- Rollback for 20261024000200_account_details.sql.
alter table public.organizations
  drop constraint if exists organizations_company_type_length_check,
  drop constraint if exists organizations_address_length_check,
  drop constraint if exists organizations_contact_email_length_check,
  drop constraint if exists organizations_phone_length_check,
  drop constraint if exists organizations_contact_name_length_check,
  drop column if exists company_type,
  drop column if exists address,
  drop column if exists contact_email,
  drop column if exists phone,
  drop column if exists contact_name;

alter table public.profiles
  drop constraint if exists profiles_address_length_check,
  drop constraint if exists profiles_contact_email_length_check,
  drop constraint if exists profiles_phone_length_check,
  drop column if exists address,
  drop column if exists contact_email,
  drop column if exists phone;
