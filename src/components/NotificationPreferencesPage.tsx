import { useEffect, useState } from 'react'
import { Bell, Mail, Smartphone, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

const toggleClass = 'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300'

export default function NotificationPreferencesPage() {
  const [push, setPush] = useState(true)
  const [email, setEmail] = useState(true)
  const [marketing, setMarketing] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('الخدمة غير متاحة حاليًا.'); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/?login=1'); return }
      const { data, error: loadError } = await supabase.from('platform_notification_preferences').select('push_enabled,email_enabled,marketing_enabled').eq('user_id', user.id).maybeSingle()
      if (!active) return
      if (loadError) setError('تعذر تحميل إعدادات الإشعارات. يرجى المحاولة لاحقًا.')
      else if (data) { setPush(data.push_enabled); setEmail(data.email_enabled); setMarketing(data.marketing_enabled) }
      else {
        const { error: insertError } = await supabase.from('platform_notification_preferences').upsert({ user_id: user.id, push_enabled: true, email_enabled: true, marketing_enabled: true }, { onConflict: 'user_id' })
        if (insertError) setError('تعذر تهيئة إعدادات الإشعارات.')
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function save() {
    if (!supabase || saving) return
    setSaving(true); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setError('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.'); return }
    const { error: saveError } = await supabase.from('platform_notification_preferences').upsert({ user_id: user.id, push_enabled: push, email_enabled: email, marketing_enabled: marketing }, { onConflict: 'user_id' })
    setSaving(false)
    if (saveError) setError('تعذر حفظ الإعدادات. حاول مرة أخرى.')
    else setMessage('تم حفظ تفضيلات الإشعارات.')
  }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)} className={toggleClass + (value ? ' bg-blue-700' : ' bg-slate-300')}><span className={'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' + (value ? '-translate-x-6' : '-translate-x-1')}/></button>
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-l from-[#09233e] to-[#126b9c] p-6 text-white sm:p-8"><div className="flex items-center gap-3"><Bell size={28}/><div><p className="text-sm text-cyan-200">My Car عربيتي</p><h1 className="text-2xl font-black">إعدادات الإشعارات</h1></div></div><p className="mt-3 text-sm leading-7 text-blue-100">الإشعارات التشغيلية مفعّلة افتراضيًا لتصلك تحديثات حسابك وطلباتك وعروضك. يمكنك إيقاف أي قناة في أي وقت.</p></header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        {loading ? <p className="py-8 text-center text-slate-500">جارٍ تحميل الإعدادات...</p> : <>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5"><div className="flex items-start gap-3"><Smartphone className="mt-1 text-blue-700"/><div><h2 className="font-extrabold">إشعارات الهاتف</h2><p className="mt-1 text-sm leading-6 text-slate-500">تنبيهات على الهاتف حتى عندما لا تكون المنصة مفتوحة. يتطلب ذلك دعم المتصفح وموافقتك على إذن الإشعارات.</p></div></div><Toggle value={push} onChange={setPush} label="إشعارات الهاتف"/></div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5"><div className="flex items-start gap-3"><Mail className="mt-1 text-blue-700"/><div><h2 className="font-extrabold">إشعارات البريد الإلكتروني</h2><p className="mt-1 text-sm leading-6 text-slate-500">إرسال تحديثات الحساب والطلبات والعروض إلى البريد المسجل.</p></div></div><Toggle value={email} onChange={setEmail} label="إشعارات البريد الإلكتروني"/></div>
          <div className="flex items-center justify-between gap-4"><div><h2 className="font-extrabold">العروض والأخبار التسويقية</h2><p className="mt-1 text-sm leading-6 text-slate-500">رسائل العروض والتحديثات الترويجية اختيارية ومتوقفة افتراضيًا.</p></div><Toggle value={marketing} onChange={setMarketing} label="العروض والأخبار التسويقية"/></div>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-black text-white hover:bg-blue-800 disabled:opacity-50"><Save size={18}/>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
        </>}
      </section>
      <p className="text-xs leading-6 text-slate-500">ملاحظة: تفعيل إشعارات الهاتف من هنا لا يتجاوز إذن نظام الهاتف أو المتصفح. إذا لم تسمح بالإشعارات على جهازك، فلن تظهر التنبيهات عليه.</p>
    </div>
  </main>
}
