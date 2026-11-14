-- Fix managed sourcing dispatch when company requests use Arabic model names
-- while registered vehicles store make/model values in English.
-- Also interpret generic model selections as an unrestricted model match.

create or replace function public.managed_sourcing_model_matches(p_make text, p_model text, p_requested text[])
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_requested text;
  v_actual text;
begin
  if coalesce(cardinality(p_requested), 0) = 0 then
    return true;
  end if;

  v_actual := lower(coalesce(p_make, '') || ' ' || coalesce(p_model, ''));
  v_actual := translate(v_actual, 'أإآٱىة', 'اااايه');
  v_actual := replace(v_actual, 'هيونداي', 'hyundai');
  v_actual := replace(v_actual, 'هونداي', 'hyundai');
  v_actual := replace(v_actual, 'النترا', 'elantra');
  v_actual := replace(v_actual, 'الانترا', 'elantra');
  v_actual := replace(v_actual, 'توسان', 'tucson');
  v_actual := replace(v_actual, 'كيا', 'kia');
  v_actual := replace(v_actual, 'سبورتاج', 'sportage');
  v_actual := regexp_replace(v_actual, '[^a-z0-9ء-ي]+', ' ', 'g');
  v_actual := btrim(regexp_replace(v_actual, '\s+', ' ', 'g'));

  foreach v_requested in array p_requested loop
    v_requested := lower(btrim(coalesce(v_requested, '')));
    v_requested := translate(v_requested, 'أإآٱىة', 'اااايه');
    if v_requested = '' or v_requested in ('any','all','اي نوع','اي ماركة','كل الموديلات','جميع الموديلات','كل الانواع','جميع الانواع') then
      return true;
    end if;
    v_requested := replace(v_requested, 'هيونداي', 'hyundai');
    v_requested := replace(v_requested, 'هونداي', 'hyundai');
    v_requested := replace(v_requested, 'النترا', 'elantra');
    v_requested := replace(v_requested, 'الانترا', 'elantra');
    v_requested := replace(v_requested, 'توسان', 'tucson');
    v_requested := replace(v_requested, 'كيا', 'kia');
    v_requested := replace(v_requested, 'سبورتاج', 'sportage');
    v_requested := regexp_replace(v_requested, '[^a-z0-9ء-ي]+', ' ', 'g');
    v_requested := btrim(regexp_replace(v_requested, '\s+', ' ', 'g'));
    if v_requested <> '' and (v_actual = v_requested or position(v_requested in v_actual) > 0) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

do $$
declare
  v_definition text;
  v_old text := 'where (v.make || '' '' || v.model) ilike (''%'' || mm || ''%'')';
  v_new text := 'where (v.make || '' '' || v.model) ilike (''%'' || mm || ''%'') or public.managed_sourcing_model_matches(v.make, v.model, array[mm])';
  v_count integer;
begin
  v_definition := pg_get_functiondef('public.dispatch_managed_sourcing_request(uuid)'::regprocedure);
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  if v_count <> 3 then
    raise exception 'Expected 3 model match predicates in dispatch function; found %', v_count;
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$$;
