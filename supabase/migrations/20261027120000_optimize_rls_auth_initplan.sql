-- Optimize simple RLS policies that call auth.uid() per row.
-- Rewrites only policies whose expressions do not already contain an init-plan
-- form, preserving policy commands, roles, and logical conditions.
do $$
declare
  p record;
  using_expr text;
  check_expr text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
      and coalesce(qual, '') not like '%SELECT auth.uid()%'
      and coalesce(with_check, '') not like '%SELECT auth.uid()%'
  loop
    using_expr := case
      when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '(select auth.uid())')
    end;
    check_expr := case
      when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    if using_expr is not null then
      stmt := stmt || format(' USING (%s)', using_expr);
    end if;
    if check_expr is not null then
      stmt := stmt || format(' WITH CHECK (%s)', check_expr);
    end if;
    execute stmt;
  end loop;
end
$$;

-- Leaked-password protection is an Auth dashboard setting, not a Postgres policy.
-- Enable in Supabase Dashboard > Authentication > Settings after reviewing
-- the intended password policy.
