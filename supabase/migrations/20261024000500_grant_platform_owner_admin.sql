-- Grant platform administration only to the verified, designated owner account.
-- Authorization is bound to the immutable auth user UUID, not a client-side email check.
insert into public.platform_admins (user_id)
select u.id
from auth.users as u
where lower(u.email) = lower('kalnoby0@gmail.com')
  and u.email_confirmed_at is not null
on conflict (user_id) do nothing;

-- Fail the migration rather than silently leaving the owner without access.
do $$
begin
  if not exists (
    select 1
    from public.platform_admins as a
    join auth.users as u on u.id = a.user_id
    where lower(u.email) = lower('kalnoby0@gmail.com')
      and u.email_confirmed_at is not null
  ) then
    raise exception 'Verified platform owner account kalnoby0@gmail.com was not found; no admin access granted';
  end if;
end
$$;
