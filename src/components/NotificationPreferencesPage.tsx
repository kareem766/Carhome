import { useEffect, useState } from 'react'
import { Bell, Mail, Smartphone, Save, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

const toggleClass = 'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

export default function NotificationPreferencesPage() {
  const [push, setPush] = useState(true)
  const [email, setEmail] = useState(true)
  const [marketing, setMarketing] = useState(true)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enablingPush, setEnablingPush] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('الخدمة غير متاحة حاليًا.'); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/?login=1'); return }
      const { data, error: loadError } = await supabase.from('platform_notification_preferences')
        .select('push_enabled,email_enabled,marketing_enabled').eq('user_id', user.id).maybeSingle()
      if (!active) return
      if (loadError) setError('تعذر تحميل إعدادات الإشعارات. يرجى المحاولة لاحقًا.')
      else if (data) {
        setPush(data.push_enabled)
        setEmail(data.email_enabled)
        setMarketing(data.marketing_enabled)
      } else {
        const { error: insertError } = await supabase.from('platform_notification_preferences').upsert({
          user_id: user.id, push_enabled: true, email_enabled: true, marketing_enabled: true
        }, { onConflict: 'user_id' })
        if (insertError) setError('تعذر تهيئة إعدادات الإشعارات.')
      }
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/push/')
        if (active && registration) setPushSubscribed(Boolean(await registration.pushManager.getSubscription()))
      }
      if (active) setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function enablePushForThisDevice() {
    if (!supabase || enablingPush) return
    setEnablingPush(true); setError(''); setMessage('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('المتصفح أو الجهاز لا يدعم إشعارات الويب. على iPhone استخدم المنصة من الشاشة الرئيسية بعد إضافتها إلى Home Screen.')
      }
      if (!publicVapidKey) throw new Error('إعداد مفتاح إشعارات الهاتف لم يكتمل بعد. يرجى المحاولة لاحقًا.')
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('لم يتم منح إذن الإشعارات من إعدادات الجهاز أو المتصفح.')
      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/push/' })
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        })
      }
      const payload = subscription.toJSON()
      if (!payload.keys?.p256dh || !payload.keys?.auth) throw new Error('تعذر قراءة بيانات اشتراك الإشعارات من الجهاز.')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.')
      const { error: saveError } = await supabase.from('platform_push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: payload.keys.p256dh,
        auth_key: payload.keys.auth,
        user_agent: navigator.userAgent
      }, { onConflict: 'user_id,endpoint' })
      if (saveError) throw saveError
      const { error: preferenceError } = await supabase.from('platform_notification_preferences').upsert({
        user_id: user.id, push_enabled: true, email_enabled: email, marketing_enabled: marketing
      }, { onConflict: 'user_id' })
      if (preferenceError) throw preferenceError
      setPush(true); setPushSubscribed(true)
      setMessage('تم تفعيل إشعارات الهاتف على هذا الجهاز وحفظ تفضيله بنجاح.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تفعيل إشعارات الهاتف.')
    } finally {
      setEnablingPush(false)
    }
  }

  async function save() {
    if (!supabase || saving) return
    setSaving(true); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setError('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.'); return }
    const { error: saveError } = await supabase.from('platform_notification_preferences').upsert({
      user_id: user.id, push_enabled: push, email_enabled: email, marketing_enabled: marketing
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (saveError) setError('تعذر حفظ الإعدادات. حاول مرة أخرى.')
    else setMessage('تم حفظ تفضيلات الإشعارات.')
  }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}
      className={toggleClass + (value ? ' bg-blue-700' : ' bg-slate-300')}>
      <span className={'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' + (value ? '-translate-x-6' : '-translate-x-1')}/>
    </button>
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-l from-[#09233e] to-[#126b9c] p-6 text-white sm:p-8">
        <div className="flex items-center gap-3"><Bell size={28}/><div><p className="text-sm text-cyan-200">My Car عربيتي</p><h1 className="text-2xl font-black">إعدادات الإشعارات</h1></div></div>
        <p className="mt-3 text-sm leading-7 text-blue-100">إشعارات الحساب والطلبات والعروض مفعّلة افتراضيًا على الهاتف والبريد الإلكتروني، وكذلك رسائل العروض التسويقية. يمكنك إيقاف أي خيار في أي وقت.</p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        {loading ? <p className="py-8 text-center text-slate-500">جارٍ تحميل الإعدادات...</p> : <>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-3"><Smartphone className="mt-1 shrink-0 text-blue-700"/><div><h2 className="font-extrabold">إشعارات الهاتف</h2><p className="mt-1 text-sm leading-6 text-slate-500">تنبيهات على الهاتف حتى عندما لا تكون المنصة مفتوحة. يتطلب ذلك تفعيل إذن الإشعارات على كل جهاز.</p></div></div>
            <Toggle value={push} onChange={setPush} label="إشعارات الهاتف"/>
          </div>
          {push && <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-900"><ShieldCheck size={17}/>{pushSubscribed ? 'هذا الجهاز مشترك في الإشعارات' : 'فعّل استقبال الإشعارات على هذا الجهاز'}</div>
            {!pushSubscribed && <button type="button" disabled={enablingPush} onClick={() => void enablePushForThisDevice()} className="mt-3 min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">{enablingPush ? 'جارٍ التفعيل...' : 'تفعيل الإشعارات على هذا الجهاز'}</button>}
            <p className="mt-2 text-xs leading-5 text-slate-600">على iPhone وiPad يلزم iOS/iPadOS 16.4 أو أحدث وإضافة My Car إلى الشاشة الرئيسية أولًا، ثم السماح بالإشعارات. ويمكن تفعيل كل جهاز على حدة.</p>
          </div>}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-3"><Mail className="mt-1 shrink-0 text-blue-700"/><div><h2 className="font-extrabold">إشعارات البريد الإلكتروني</h2><p className="mt-1 text-sm leading-6 text-slate-500">إرسال تحديثات الحساب والطلبات والعروض إلى البريد الإلكتروني المسجل في حسابك.</p></div></div>
            <Toggle value={email} onChange={setEmail} label="إشعارات البريد الإلكتروني"/>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-extrabold">العروض والأخبار التسويقية</h2><p className="mt-1 text-sm leading-6 text-slate-500">رسائل العروض والتحديثات الترويجية مفعّلة افتراضيًا، ويمكنك إيقافها بشكل مستقل عن إشعارات الخدمة.</p></div>
            <Toggle value={marketing} onChange={setMarketing} label="العروض والأخبار التسويقية"/>
          </div>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-black text-white hover:bg-blue-800 disabled:opacity-50"><Save size={18}/>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
        </>}
      </section>
      <p className="text-xs leading-6 text-slate-500">إيقاف قناة من هنا يمنع الإرسال عبرها مستقبلًا، لكنه لا يلغي إشعارات النظام أو أذونات الجهاز التي تتحكم فيها إعدادات الهاتف والمتصفح.</p>
    </div>
  </main>
}
