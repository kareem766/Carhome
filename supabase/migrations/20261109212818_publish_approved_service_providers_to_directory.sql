-- Expose only the public listing fields for approved service providers.
create table public.published_service_providers as
select id, provider_name, category, governorate, address, phone,
       website_url, official_source_url, description
from public.service_provider_submissions
with no data;

alter table public.published_service_providers
  add constraint published_service_providers_pkey primary key (id);
alter table public.published_service_providers enable row level security;
grant select on public.published_service_providers to anon, authenticated;
create policy "Public can read approved published service providers"
  on public.published_service_providers
  for select to anon, authenticated
  using (true);

create or replace function private.sync_published_service_provider()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.published_service_providers where id = old.id;
    return old;
  end if;
  if new.status = 'approved' then
    insert into public.published_service_providers (
      id, provider_name, category, governorate, address, phone,
      website_url, official_source_url, description
    ) values (
      new.id, new.provider_name, new.category, new.governorate, new.address,
      new.phone, new.website_url, new.official_source_url, new.description
    )
    on conflict (id) do update set
      provider_name = excluded.provider_name,
      category = excluded.category,
      governorate = excluded.governorate,
      address = excluded.address,
      phone = excluded.phone,
      website_url = excluded.website_url,
      official_source_url = excluded.official_source_url,
      description = excluded.description;
  else
    delete from public.published_service_providers where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_published_service_provider() from public, anon, authenticated;

drop trigger if exists sync_published_service_provider on public.service_provider_submissions;
create trigger sync_published_service_provider
after insert or update or delete on public.service_provider_submissions
for each row execute function private.sync_published_service_provider();

insert into public.published_service_providers (
  id, provider_name, category, governorate, address, phone,
  website_url, official_source_url, description
)
select id, provider_name, category, governorate, address, phone,
       website_url, official_source_url, description
from public.service_provider_submissions
where status = 'approved'
on conflict (id) do update set
  provider_name = excluded.provider_name,
  category = excluded.category,
  governorate = excluded.governorate,
  address = excluded.address,
  phone = excluded.phone,
  website_url = excluded.website_url,
  official_source_url = excluded.official_source_url,
  description = excluded.description;
