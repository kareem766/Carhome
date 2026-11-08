UPDATE public.platform_subscription_plans p
SET features = (
  SELECT jsonb_agg(
    CASE WHEN f.value = 'تنبيهات للسيارات والعروض المطابقة'
      THEN to_jsonb('تنبيهات ذكية للسيارات المعتمدة المطابقة لمعايير البحث'::text)
      ELSE to_jsonb(f.value)
    END ORDER BY f.ordinality
  )
  FROM jsonb_array_elements_text(p.features) WITH ORDINALITY AS f(value, ordinality)
), updated_at = now()
WHERE p.slug = 'company-professional';

UPDATE public.platform_subscription_plans p
SET features = (
  SELECT jsonb_agg(
    CASE WHEN f.value = 'تنبيهات ومتابعة موسعة للفرص والعروض'
      THEN to_jsonb('تنبيهات ذكية موسعة للسيارات المعتمدة المطابقة لمعايير الشركة'::text)
      ELSE to_jsonb(f.value)
    END ORDER BY f.ordinality
  )
  FROM jsonb_array_elements_text(p.features) WITH ORDINALITY AS f(value, ordinality)
), updated_at = now()
WHERE p.slug = 'company-enterprise';
