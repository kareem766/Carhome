-- Notify the vehicle owner when an administrator removes a published advertisement.
CREATE OR REPLACE FUNCTION public.notify_vehicle_promotion_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'تم اعتماد باقة الإعلان',
        'تم اعتماد طلب الترويج وستظهر السيارة ضمن نتائج الترويج وفق مدة الباقة.',
        'promotion', '/workspace/catalog'
      );
    ELSIF NEW.status IN ('rejected', 'declined') THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'لم تتم الموافقة على الإعلان',
        'لم تتم الموافقة على طلب الترويج. يرجى مراجعة الملاحظات في حسابك.',
        'promotion', '/workspace/catalog'
      );
    ELSIF NEW.status = 'expired' THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'انتهت باقة إعلان سيارتك',
        'انتهت مدة باقة الإعلان. يمكنك اختيار باقة جديدة لتجديد الترويج.',
        'promotion_expired', '/workspace/catalog'
      );
    ELSIF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'تم حذف إعلان سيارتك من الكتالوج',
        'قامت إدارة My Car بإيقاف ظهور الإعلان وحفظ سجل الدفع والمراجعة. راجع ملاحظات الإدارة من حسابك عند الحاجة.',
        'promotion_removed_by_admin', '/workspace/owner/vehicles', NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
