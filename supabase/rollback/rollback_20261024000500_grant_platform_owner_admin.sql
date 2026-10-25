-- Revoke the explicit platform-admin grant from the designated owner account.
-- This does not modify profiles, organizations, or any other account data.
delete from public.platform_admins as a
using auth.users as u
where u.id = a.user_id
  and lower(u.email) = lower('kalnoby0@gmail.com');
