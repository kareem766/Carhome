import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Mail, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type SupportSettings = { platform_name: string; logo_url: string | null; support_email: string | null }
const initial = { name: '', email: '', subject: '', message: '', website: '' }
const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100'

export default function SupportPage() {
  const [settings, setSettings] = useState<SupportSettings>({ platform_name: 'My Car', logo_url: null, support_email: null })
  const [form, setForm] = useState(initial)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) return
      const { data } = await supabase.from('platform_settings').select('platform_name,logo_url,support_email').eq('id', true).maybeSingle()
      if (active && data) setSettings({ platform_name: data.platform_name || 'My Car', logo_url: data.logo_url || null, support_email: data.support_email || null })
    }
    void load()
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.message.trim().length < 15) { setError('اكتب تفاصيل كافية للمشكلة (15 حرفًا على الأقل).'); return }
    setSending(true)
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), subject: form.subject.trim(), message: form.message.trim(), website: form.website })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'تعذر إرسال الرسالة الآن. حاول مرة أخرى لاحقًا.')
      setForm(initial)
      setSuccess('تم إرسال رسالتك إلى فريق الدعم عبر البريد الإلكتروني بنجاح. احتفظ ببريدك الإلكتروني لمتابعة الرد.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع أثناء الإرسال.')
    } finally { setSending(false) }
  }

  return <main dir="rtl" className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <img src={settings.logo_url || '/mycar-logo.svg'} alt={settings.platform_name} className="h-12 w-12 rounded-xl object-contain"/>
          <div><p className="text-xs font-bold text-blue-700">مركز المساعدة</p><h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">الدعم الفني عبر البريد الإلكتروني</h1></div>
        </div>
        <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowRight size={17}/> العودة للرئيسية</a>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20 text-blue-200"><Mail size={25}/></span>
          <h2 className="mt-5 text-2xl font-black">نحن هنا لمساعدتك</h2>
          <p className="mt-3 leading-8 text-slate-300">أرسل تفاصيل استفسارك أو المشكلة من خلال النموذج، وستصل رسالتك إلى فريق الدعم عبر البريد الإلكتروني دون الحاجة إلى إدخال رقم هاتف أو مشاركة بيانات اتصال إضافية.</p>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <p className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300"/> لا نطلب رقم هاتف للتواصل مع الدعم.</p>
            <p className="flex items-start gap-2"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300"/> استخدم بريدًا إلكترونيًا صحيحًا لاستلام الرد.</p>
          </div>
          {settings.support_email && <p className="mt-8 border-t border-white/10 pt-5 text-sm text-slate-300">بريد الدعم الرسمي: <span dir="ltr" className="mt-1 block font-bold text-white">{settings.support_email}</span></p>}
        </aside>
        <section className="rounded-3xl border border-white bg-white/95 p-5 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.30)] sm:p-8">
          <h2 className="text-xl font-extrabold text-slate-900">إرسال رسالة للدعم</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">املأ البيانات التالية وسيتم إرسال رسالتك من خلال المنصة مباشرة.</p>
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}
          {success && <p role="status" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{success}</p>}
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-bold text-slate-700">الاسم <span className="font-normal text-slate-400">(اختياري)</span><input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} maxLength={100} autoComplete="name" className={inputClass} placeholder="اسمك"/></label>
            <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني للرد عليك *<input required type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} maxLength={254} autoComplete="email" className={inputClass} placeholder="name@example.com" dir="ltr"/></label>
            <label className="block text-sm font-bold text-slate-700">موضوع الرسالة *<select required value={form.subject} onChange={e=>setForm(v=>({...v,subject:e.target.value}))} className={inputClass}><option value="">اختر موضوع الرسالة</option><option value="مشكلة في تسجيل الدخول أو الحساب">مشكلة في تسجيل الدخول أو الحساب</option><option value="السيارات والطلبات والعروض">السيارات والطلبات والعروض</option><option value="الاشتراكات والإعلانات والدفع">الاشتراكات والإعلانات والدفع</option><option value="الإبلاغ عن مشكلة تقنية">الإبلاغ عن مشكلة تقنية</option><option value="استفسار عام">استفسار عام</option><option value="أخرى">أخرى</option></select></label>
            <label className="block text-sm font-bold text-slate-700">تفاصيل الرسالة *<textarea required minLength={15} maxLength={5000} rows={6} value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))} className={inputClass} placeholder="اشرح لنا المشكلة والخطوات التي أدت إليها دون مشاركة كلمات المرور أو بيانات الدفع السرية."/></label>
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label>اترك هذا الحقل فارغًا<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>setForm(v=>({...v,website:e.target.value}))}/></label></div>
            <p className="text-xs leading-6 text-slate-500">لا تكتب كلمة المرور أو بيانات بنكية حساسة داخل الرسالة.</p>
            <button disabled={sending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"><Send size={18}/>{sending ? 'جارٍ إرسال الرسالة...' : 'إرسال إلى فريق الدعم'}</button>
          </form>
        </section>
      </div>
    </div>
  </main>
}
