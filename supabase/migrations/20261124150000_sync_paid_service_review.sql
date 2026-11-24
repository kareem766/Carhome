-- When a provider webhook confirms a payment, move its service record into the
-- existing administrator review queue. Payment confirmation never activates service.
alter table public.vehicle_payment_submissions
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

create unique index if not exists vehicle_payment_submissions_payment_id_uidx
  on public.vehicle_payment_submissions(payment_id)
  where payment_id is not null;

alter table public.vehicle_payment_submissions
  drop constraint if exists vehicle_payment_submissions_transfer_method_check;

alter table public.vehicle_payment_submissions
  add constraint vehicle_payment_submissions_transfer_method_check
  check (transfer_method = any (array['instapay','vodafone_cash','bank_transfer','online']));

create or replace function public.sync_paid_mycar_payment_to_service_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reference text;
  v_organization_id uuid;
  v_period_months integer;
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;

  v_reference := left(
    'دفع إلكتروني عبر ' || upper(coalesce(new.provider_code,'بوابة الدفع')) ||
    ' · ' || coalesce(new.provider_reference,new.id::text),
    160
  );

  case new.purpose
    when 'vehicle_registration' then
      select v.organization_id into v_organization_id
      from public.vehicles v
      where v.id = new.entity_id and v.created_by = new.created_by;

      if v_organization_id is null then
        raise exception 'vehicle_registration_payment_target_not_found';
      end if;

      v_period_months := greatest(1, least(24, coalesce((new.metadata->>'period_months')::integer,1)));

      insert into public.vehicle_payment_submissions(
        payment_id,vehicle_id,organization_id,submitted_by,amount_egp,period_months,
        transfer_method,transfer_reference,review_status,coupon_code,
        original_amount_egp,discount_amount_egp,final_amount_egp
      ) values (
        new.id,new.entity_id,v_organization_id,new.created_by,new.original_amount,v_period_months,
        'online',v_reference,'pending',new.discount_code,
        new.original_amount,new.discount_amount,new.amount_due
      )
      on conflict (payment_id) where payment_id is not null do nothing;

    when 'company_subscription' then
      update public.company_subscriptions
      set payment_status='submitted',
          payment_reference=v_reference,
          payment_transfer_date=current_date,
          payment_submitted_at=now(),
          updated_at=now()
      where id=new.entity_id and created_by=new.created_by and status='pending';
      if not found then raise exception 'company_subscription_payment_target_not_found'; end if;

    when 'advertising' then
      update public.vehicle_promotions
      set payment_status='submitted',payment_reference=v_reference,updated_at=now()
      where id=new.entity_id and created_by=new.created_by and status='pending_review';
      if not found then raise exception 'advertising_payment_target_not_found'; end if;

    when 'featured_advertising' then
      update public.vehicle_promotions
      set payment_status='submitted',payment_reference=v_reference,updated_at=now()
      where id=new.entity_id and created_by=new.created_by and status='pending_review';
      if not found then raise exception 'featured_advertising_payment_target_not_found'; end if;

    when 'managed_sourcing_request' then
      update public.managed_sourcing_requests
      set payment_status='payment_submitted',
          payment_reference=v_reference,
          payment_transfer_date=current_date,
          payment_submitted_at=now(),
          updated_at=now()
      where id=new.entity_id and created_by=new.created_by
        and status='awaiting_payment' and payment_status='awaiting_payment';
      if not found then raise exception 'managed_sourcing_request_payment_target_not_found'; end if;

      insert into public.managed_sourcing_actions(request_id,created_by,action_type,payment_reference,message)
      values(new.entity_id,new.created_by,'submit_payment_reference',v_reference,
        'تم تأكيد الدفع الإلكتروني عبر ' || upper(coalesce(new.provider_code,'بوابة الدفع')) || '. الطلب بانتظار مراجعة الإدارة.');

    when 'managed_sourcing_subscription' then
      update public.managed_sourcing_subscriptions
      set payment_status='submitted',
          payment_reference=v_reference,
          payment_transfer_date=current_date,
          updated_at=now()
      where id=new.entity_id and created_by=new.created_by and status='pending_review';
      if not found then raise exception 'managed_sourcing_subscription_payment_target_not_found'; end if;

    else
      raise exception 'unsupported_paid_service_purpose';
  end case;

  return new;
end;
$$;

revoke all on function public.sync_paid_mycar_payment_to_service_review() from public,anon,authenticated;

drop trigger if exists payments_sync_paid_service_review on public.payments;
create trigger payments_sync_paid_service_review
after update of status on public.payments
for each row
when (new.status='paid' and old.status is distinct from new.status)
execute function public.sync_paid_mycar_payment_to_service_review();

comment on function public.sync_paid_mycar_payment_to_service_review() is
  'Moves provider-confirmed payments into existing admin review queues. It does not approve or activate the underlying service.';
