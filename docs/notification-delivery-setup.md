# إعداد الإشعارات الفعلية — My Car عربيتي

هذا الإعداد يخص مشروع Supabase الخاص بـ My Car فقط. لا تضع أي مفاتيح سرية داخل GitHub أو ملفات الواجهة.

## المتغيرات السرية في Supabase Edge Functions

من Supabase Dashboard → Project Settings → Edge Functions → Secrets، أضف:

- `NOTIFICATION_DISPATCH_SECRET`: قيمة عشوائية طويلة (32 بايت أو أكثر).
- `VAPID_PUBLIC_KEY`: المفتاح العام الناتج من توليد VAPID.
- `VAPID_PRIVATE_KEY`: المفتاح الخاص الناتج من توليد VAPID — لا تشاركه.
- `VAPID_SUBJECT`: عنوان تواصل بصيغة `mailto:...`.
- `BREVO_API_KEY`: مفتاح API الخاص بحساب Brevo.
- `BREVO_SENDER_EMAIL`: بريد مرسل تابع لنطاق موثّق في Brevo.
- `BREVO_SENDER_NAME`: `My Car عربيتي`.
- `APP_BASE_URL`: رابط الإنتاج الحالي للمنصة، من دون / في النهاية.

لتوليد مفاتيح VAPID على جهازك بعد تثبيت Node.js:
```bash
npx web-push generate-vapid-keys
```
انسخ المفتاحين العام والخاص إلى أسرار Supabase فقط. أضف المفتاح العام نفسه إلى Vercel باسم `VITE_VAPID_PUBLIC_KEY` في Production وPreview عند الحاجة؛ المفتاح العام ليس سرًا، أما الخاص فلا يوضع في Vercel أو الواجهة.

لتوليد رمز الاستدعاء:
```bash
openssl rand -hex 32
```
استخدم القيمة نفسها في `NOTIFICATION_DISPATCH_SECRET` وفي Vault بالخطوة التالية.

## إعداد Vault والجدولة

بعد نشر Migration المرحلة على مشروع Supabase، افتح SQL Editor ونفّذ الأمر التالي بعد استبدال القيمة فقط بالرمز الذي أنشأته:

```sql
select vault.create_secret('PASTE_THE_SAME_NOTIFICATION_DISPATCH_SECRET_HERE', 'mycar_notification_dispatch_secret');
```

ثم أنشئ مهمة تشغيل عامل الإرسال كل دقيقة:

```sql
select cron.schedule(
  'mycar-notification-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bxmfykzckjoecvpoqlag.supabase.co/functions/v1/notification-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mycar_notification_dispatch_secret'
        order by created_at desc
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

## التحقق

- تأكد من وجود مهمة `mycar-notification-dispatch` في `cron.job`.
- راجع `cron.job_run_details` للتأكد من نجاح التشغيل.
- راجع `notification_delivery_outbox`؛ يجب أن تتحول القنوات إلى `sent` أو `skipped` أو `failed` مع سبب واضح.
- اختبر أولًا بحساب تجريبي تملكه، وليس بإرسال جماعي إلى العملاء.
- iPhone/iPad: يلزم iOS/iPadOS 16.4 أو أحدث، تثبيت الموقع على الشاشة الرئيسية، ثم منح إذن الإشعارات. Android والمتصفحات الأخرى تعتمد على دعم المتصفح وإذن النظام.

## البريد الإلكتروني

Brevo يرسل عبر واجهة Transactional SMTP API. لا يبدأ الإرسال قبل ضبط `BREVO_API_KEY` ومرسل موثّق. حالة المرسل النشط وحدها لا تكفي؛ يجب توثيق نطاق الإرسال وإعداد SPF/DKIM (ويُفضّل DMARC) قبل رسائل العملاء.

## الخصوصية والتصنيف

- كل إشعار داخل المنصة يُضاف تلقائيًا إلى طابور التسليم الخارجي.
- إشعارات الخدمة والطلبات والحسابات تصنّف تشغيلية.
- بث الإدارة يمكن تصنيفه تسويقيًا أو تشغيليًا؛ اختيار التسويق يحترم إيقاف التسويق قبل الإرسال عبر الهاتف والبريد.
- لا تُرسل القنوات الخارجية للمستخدم الذي أوقف القناة المقابلة.
- الاشتراكات المنتهية/المرفوضة (HTTP 404/410) تُحذف من قائمة الأجهزة تلقائيًا.
- توجد إعادة محاولة بحد أقصى 8 محاولات مع تأخير تصاعدي. لا تُرسل إشعارات تاريخية عند إنشاء الطابور؛ يبدأ الالتقاط مع الإشعارات الجديدة بعد تطبيق Migration.
