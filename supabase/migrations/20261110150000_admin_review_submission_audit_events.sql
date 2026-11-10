create or replace function public.mycar_log_review_submission_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_row jsonb := to_jsonb(new);
  target_type text;
  initial_state jsonb;
  actor uuid;
begin
  target_type := case tg_table_name
    when 'vehicles' then 'vehicle'
    when 'organizations' then 'account'
    when 'vehicle_payment_submissions' then 'payment'
    when 'vehicle_promotions' then 'advertisement'
    when 'service_provider_submissions' then 'service_provider'
    else tg_table_name
  end;

  initial_state := jsonb_strip_nulls(jsonb_build_object(
    'review_status', new_row -> 'review_status',
    'approval_status', new_row -> 'approval_status',
    'status', new_row -> 'status',
    'payment_status', new_row -> 'payment_status'
  ));
  actor := coalesce(
    auth.uid(),
    nullif(new_row ->> 'created_by', '')::uuid,
    nullif(new_row ->> 'submitted_by', '')::uuid
  );

  insert into public.admin_review_audit_log (
    entity_type, entity_id, action, actor_id, previous_state, new_state
  ) values (
    target_type,
    new_row ->> 'id',
    'submitted',
    actor,
    '{}'::jsonb,
    initial_state
  );
  return new;
end;
$$;

revoke all on function public.mycar_log_review_submission_created() from public, anon, authenticated;

drop trigger if exists mycar_review_submission_created_vehicles on public.vehicles;
create trigger mycar_review_submission_created_vehicles
after insert on public.vehicles
for each row execute function public.mycar_log_review_submission_created();

drop trigger if exists mycar_review_submission_created_organizations on public.organizations;
create trigger mycar_review_submission_created_organizations
after insert on public.organizations
for each row execute function public.mycar_log_review_submission_created();

drop trigger if exists mycar_review_submission_created_payments on public.vehicle_payment_submissions;
create trigger mycar_review_submission_created_payments
after insert on public.vehicle_payment_submissions
for each row execute function public.mycar_log_review_submission_created();

drop trigger if exists mycar_review_submission_created_promotions on public.vehicle_promotions;
create trigger mycar_review_submission_created_promotions
after insert on public.vehicle_promotions
for each row execute function public.mycar_log_review_submission_created();

drop trigger if exists mycar_review_submission_created_service_providers on public.service_provider_submissions;
create trigger mycar_review_submission_created_service_providers
after insert on public.service_provider_submissions
for each row execute function public.mycar_log_review_submission_created();
