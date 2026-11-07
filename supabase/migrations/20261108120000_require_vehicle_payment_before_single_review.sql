-- Keep a vehicle out of the admin review queue until its payment submission is recorded.
ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_review_status_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_review_status_check
  CHECK (review_status = ANY (ARRAY[
    'pending_payment'::text,
    'pending_review'::text,
    'approved'::text,
    'rejected'::text,
    'paused'::text
  ]));

DROP POLICY IF EXISTS "vehicle owners can insert their own organization vehicles" ON public.vehicles;

CREATE POLICY "vehicle owners can insert their own organization vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND review_status = 'pending_payment'
  AND payment_status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = vehicles.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND o.organization_type = ANY (ARRAY[
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      ])
  )
);

CREATE OR REPLACE FUNCTION public.notify_admin_review_needed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_title text;
  v_body text;
  v_url text := '/workspace/admin/vehicle-reviews';
  v_type text := 'request';
  v_is_pending boolean := false;
  v_actor uuid;
  v_account_label text;
  v_vehicle_label text;
  v_organization_name text;
begin
  if tg_table_name = 'organizations' then
    v_is_pending := new.approval_status = 'pending_review';
    v_account_label := case new.organization_type
      when 'individual_owner' then 'مالك سيارة'
      when 'company' then 'شركة طالبة'
      when 'fleet_supplier' then 'مورد أسطول'
      else 'حساب مؤسسة'
    end;
    v_title := 'حساب جديد يحتاج المراجعة: ' || v_account_label;
    v_body := 'تم تسجيل حساب جديد من نوع ' || v_account_label
      || ' باسم ' || coalesce(nullif(btrim(new.name), ''), 'اسم غير محدد')
      || case when nullif(btrim(coalesce(new.contact_name, '')), '') is not null
        then '، مسؤول التواصل: ' || btrim(new.contact_name) else '' end
      || case when nullif(btrim(coalesce(new.contact_email, '')), '') is not null
        then '، البريد الإلكتروني: ' || btrim(new.contact_email) else '' end
      || case when nullif(btrim(coalesce(new.phone, '')), '') is not null
        then '، رقم الهاتف: ' || btrim(new.phone) else '' end
      || '. الحساب بانتظار مراجعة واعتماد الإدارة.';
    v_url := '/workspace/admin/vehicle-reviews#admin-organizations';
    v_type := 'account';
    v_actor := new.created_by;
  elsif tg_table_name = 'vehicles' then
    -- pending_payment is a private pre-submission state, not a review request.
    v_is_pending := new.review_status = 'pending_review';
    v_title := 'سيارة جديدة تحتاج المراجعة';
    v_body := 'تم تسجيل سيارة جديدة وتحتاج إلى مراجعة البيانات والصور قبل اعتمادها.';
    v_url := '/workspace/admin/vehicle-reviews#admin-vehicles';
    v_type := 'vehicle';
    v_actor := new.created_by;
  elsif tg_table_name = 'vehicle_payment_submissions' then
    v_is_pending := new.review_status = 'pending';
    v_title := 'طلب تسجيل سيارة وتحويل يحتاج مراجعة واحدة';
    v_url := '/workspace/admin/vehicle-reviews#admin-payments';
    v_type := 'payment';
    v_actor := new.submitted_by;

    if v_is_pending then
      select concat_ws(' ', v.make, v.model, v.model_year::text), o.name
      into v_vehicle_label, v_organization_name
      from public.vehicles v
      join public.organizations o on o.id = v.organization_id
      where v.id = new.vehicle_id
        and v.organization_id = new.organization_id;

      -- The payment submission and transition into the review queue are atomic.
      update public.vehicles
      set review_status = 'pending_review',
          updated_at = now()
      where id = new.vehicle_id
        and organization_id = new.organization_id
        and review_status = 'pending_payment'
        and payment_status = 'pending';

      v_body := 'تم استلام طلب تسجيل السيارة والتحويل في عملية واحدة.'
        || ' | السيارة: ' || coalesce(nullif(v_vehicle_label, ''), 'بيانات السيارة غير متاحة')
        || ' | الحساب: ' || coalesce(nullif(v_organization_name, ''), 'غير محدد')
        || ' | المبلغ المحوّل: ' || new.amount_egp::text || ' جنيه'
        || ' | وسيلة التحويل: ' || case new.transfer_method
          when 'instapay' then 'InstaPay'
          when 'vodafone_cash' then 'Vodafone Cash'
          when 'bank_transfer' then 'تحويل بنكي'
          else new.transfer_method
        end
        || ' | بيانات العملية: ' || coalesce(new.transfer_reference, 'غير متاحة')
        || '. راجع بيانات السيارة والتحويل معًا واتخذ قرارًا واحدًا من قسم طلبات تسجيل السيارات ورسومها.';
    end if;
  elsif tg_table_name = 'vehicle_promotions' then
    v_is_pending := new.status = 'pending_review' or new.payment_status = 'pending';
    v_title := 'طلب إعلان أو ترويج يحتاج المراجعة';
    v_body := 'تم إرسال طلب ترويج سيارة أو بيانات دفع جديدة وتحتاج إلى مراجعة.';
    v_url := '/workspace/admin/vehicle-reviews#admin-vehicles';
    v_type := 'promotion';
    v_actor := new.created_by;
  elsif tg_table_name = 'company_subscriptions' then
    v_is_pending := new.status = 'pending' or new.payment_status = 'pending';
    v_title := 'اشتراك شركة يحتاج المراجعة';
    v_body := 'تم إرسال اشتراك أو بيانات دفع جديدة من شركة وتحتاج إلى مراجعة.';
    v_type := 'subscription';
    v_actor := new.created_by;
  end if;

  if v_is_pending then
    insert into public.platform_notifications(user_id, title, body, notification_type, action_url, created_by)
    select a.user_id, v_title, v_body, v_type, v_url, v_actor
    from public.platform_admins a;
  end if;

  return new;
end;
$function$;
