import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, BadgeCheck, Building2, CheckCircle2, ChevronDown, ExternalLink, FileCheck2, Globe2, Mail, MapPin, Phone, ShieldCheck, Wrench } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

const categories = [
  { value: 'maintenance', label: 'مراكز الصيانة والخدمة' },
  { value: 'insurance', label: 'شركات ووسطاء تأمين السيارات' },
  { value: 'spare_parts', label: 'قطع الغيار ومراكز التوزيع' },
  { value: 'fleet_services', label: 'خدمات الأساطيل والشركات' },
  { value: 'roadside', label: 'المساعدة على الطريق' },
  { value: 'inspection', label: 'الفحص الفني وتجهيز السيارات' },
  { value: 'other', label: 'خدمات سيارات أخرى' }
]
const cities = ['الإسكندرية','القاهرة','الجيزة','القليوبية','البحيرة','مطروح','الشرقية','الغربية','الدقهلية','المنوفية','كفر الشيخ','دمياط','بورسعيد','الإسماعيلية','السويس','الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد','شمال سيناء','جنوب سيناء']
const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
const initial = { provider_name:'', category:'maintenance', governorate:'الإسكندرية', address:'', contact_name:'', phone:'', email:'', website_url:'', official_source_url:'', description:'' }

export default function ServiceProviderRegistrationPage() {
  const [form,setForm] = useState(initial)
  const [submitting,setSubmitting] = useState(false)
  const [submitted,setSubmitted] = useState(false)
  const [error,setError] = useState('')
  const change = (key: keyof typeof initial, value: string) => setForm(current=>({...current,[key]:value}))
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!supabase) { setError('تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى لاحقًا.'); return }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('service_provider_submissions').insert({
        ...form,
        email: form.email.trim() || null,
        website_url: form.website_url.trim() || null,
        official_source_url: form.official_source_url.trim() || null,
        description: form.description.trim() || null,
        submitted_by: user?.id ?? null,
        status: 'pending_review'
      })
      if (insertError) throw insertError
      setSubmitted(true)
    } catch (err) {
      console.error('Service provider submission failed',err)
      setError('لم نتمكن من إرسال البيانات. راجع البيانات وحاول مرة أخرى.')
    } finally { setSubmitting(false) }
  }
  if (submitted) return <main dir="rtl" className="grid min-h-screen place-items-center bg-[linear-gradient(145deg,#eff6ff,#f8fafc_55%,#eaf2ff)] px-4 py-10 text-slate-900"><section className="w-full max-w-xl rounded-[30px] border border-blue-100 bg-white p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-10"><span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={42}/></span><h1 className="mt-6 text-2xl font-black">تم استلام طلب تسجيل مقدم الخدمة</h1><p className="mt-3 leading-8 text-slate-600">شكرًا لاهتمامك بالانضمام إلى دليل خدمات My Car. ستتم مراجعة بيانات الجهة ومصدرها الرسمي قبل اتخاذ قرار النشر، وإرسال أي متابعة إلى بيانات التواصل التي قدمتها.</p><div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-900">حالة الطلب الآن: <strong>قيد المراجعة</strong>. إرسال الطلب لا يعني اعتماد مقدم الخدمة أو ضمان جودة خدماته.</div><a href="/services" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white"><ArrowRight size={17}/> العودة إلى دليل الخدمات</a></section></main>
  return <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#f7faff_0%,#edf4fc_55%,#f8fafc_100%)] text-slate-900">
    <header className="border-b border-slate-200 bg-white/95"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><PlatformBrand/><a href="/services" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><ArrowRight size={16}/> العودة للخدمات</a></div></header>
    <section className="relative overflow-hidden bg-[#071d38] text-white"><div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(37,99,235,.38),transparent_35%),radial-gradient(circle_at_85%_85%,rgba(14,165,233,.2),transparent_32%)]"/><div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14"><div className="flex items-center gap-2 text-sm font-bold text-blue-200"><Building2 size={17}/> شركاء خدمات السيارات</div><h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">سجّل مقدم الخدمة للانضمام إلى دليل My Car</h1><p className="mt-4 max-w-3xl text-sm leading-8 text-blue-100 sm:text-base">أرسل بيانات منشأتك ومعلومات التواصل والمصدر الرسمي، وسيقوم فريق المنصة بمراجعتها قبل نشرها ضمن دليل خدمات السيارات.</p><div className="mt-7 flex flex-wrap gap-3 text-xs font-bold"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2"><ShieldCheck size={15}/> مراجعة قبل النشر</span><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2"><FileCheck2 size={15}/> بيانات موثقة</span><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2"><BadgeCheck size={15}/> اعتماد بعد التحقق</span></div></div></section>
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-10">
      <form onSubmit={submit} className="rounded-[28px] border border-white bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8">
        <div className="border-b border-slate-100 pb-5"><h2 className="text-xl font-black">بيانات مقدم الخدمة</h2><p className="mt-2 text-sm leading-7 text-slate-500">يرجى إدخال بيانات صحيحة ومحدثة. الحقول المميزة بعلامة * إلزامية.</p></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-bold text-slate-700">اسم الشركة أو مركز الخدمة *<input required minLength={2} maxLength={180} value={form.provider_name} onChange={e=>change('provider_name',e.target.value)} className={inputClass} placeholder="مثال: مركز ... لخدمات السيارات"/></label>
          <label className="text-sm font-bold text-slate-700">نوع الخدمة *<span className="relative mt-2 block"><select required value={form.category} onChange={e=>change('category',e.target.value)} className={inputClass+' mt-0 appearance-none'}>{categories.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute left-4 top-4 text-slate-400"/></span></label>
          <label className="text-sm font-bold text-slate-700">المحافظة *<span className="relative mt-2 block"><select required value={form.governorate} onChange={e=>change('governorate',e.target.value)} className={inputClass+' mt-0 appearance-none'}>{cities.map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute left-4 top-4 text-slate-400"/></span></label>
          <label className="sm:col-span-2 text-sm font-bold text-slate-700">العنوان بالتفصيل *<input required minLength={5} maxLength={500} value={form.address} onChange={e=>change('address',e.target.value)} className={inputClass} placeholder="المنطقة، الشارع، رقم المبنى، أقرب علامة مميزة"/></label>
        </div>
        <div className="mt-8 border-b border-slate-100 pb-4"><h3 className="font-extrabold">بيانات مسؤول التواصل</h3><p className="mt-1 text-sm text-slate-500">للتواصل بشأن مراجعة الطلب واستكمال البيانات عند الحاجة.</p></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">اسم مسؤول التواصل *<input required minLength={2} maxLength={120} value={form.contact_name} onChange={e=>change('contact_name',e.target.value)} className={inputClass} placeholder="الاسم بالكامل"/></label>
          <label className="text-sm font-bold text-slate-700">رقم الهاتف *<input required type="tel" minLength={7} maxLength={30} value={form.phone} onChange={e=>change('phone',e.target.value)} className={inputClass} placeholder="01xxxxxxxxx"/></label>
          <label className="text-sm font-bold text-slate-700">البريد الإلكتروني<input type="email" maxLength={254} value={form.email} onChange={e=>change('email',e.target.value)} className={inputClass} placeholder="name@company.com"/></label>
          <label className="text-sm font-bold text-slate-700">الموقع الإلكتروني أو صفحة الشركة<input type="url" maxLength={500} value={form.website_url} onChange={e=>change('website_url',e.target.value)} className={inputClass} placeholder="https://example.com"/></label>
        </div>
        <div className="mt-8 border-b border-slate-100 pb-4"><h3 className="font-extrabold">مصدر التحقق والتفاصيل</h3><p className="mt-1 text-sm text-slate-500">يساعدنا المصدر الرسمي في التحقق من هوية مقدم الخدمة.</p></div>
        <div className="mt-5 grid gap-5">
          <label className="text-sm font-bold text-slate-700">رابط المصدر الرسمي أو صفحة إثبات النشاط<input type="url" maxLength={500} value={form.official_source_url} onChange={e=>change('official_source_url',e.target.value)} className={inputClass} placeholder="رابط الموقع الرسمي أو صفحة موثقة"/></label>
          <label className="text-sm font-bold text-slate-700">نبذة عن الخدمات المقدمة<textarea rows={4} maxLength={2000} value={form.description} onChange={e=>change('description',e.target.value)} className={inputClass+' py-3'} placeholder="اكتب نبذة مختصرة عن الخدمات والتخصصات ونطاق التغطية..."/></label>
        </div>
        {error&&<p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button disabled={submitting} className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-800 to-blue-600 px-6 py-3 font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">{submitting?'جارٍ إرسال طلب التسجيل...':<><BadgeCheck size={18}/> إرسال طلب اعتماد مقدم الخدمة</>}</button>
        <p className="mt-3 text-center text-xs leading-6 text-slate-500">بإرسال الطلب، تقر بأن البيانات المقدمة صحيحة، وتوافق على مراجعتها من إدارة My Car لأغراض التحقق والنشر في دليل الخدمات عند الموافقة.</p>
      </form>
      <aside className="space-y-4">
        <div className="rounded-[26px] bg-gradient-to-br from-[#082b52] via-[#0d4f91] to-[#1679bd] p-6 text-white shadow-xl shadow-blue-950/15"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15"><Wrench size={24}/></span><h2 className="mt-5 text-xl font-black">كيف تتم مراجعة طلبك؟</h2><ol className="mt-5 space-y-4 text-sm leading-7 text-blue-50"><li className="flex gap-3"><b className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15">1</b><span>إرسال بيانات المنشأة ومعلومات التواصل.</span></li><li className="flex gap-3"><b className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15">2</b><span>مراجعة بيانات النشاط والمصدر الرسمي.</span></li><li className="flex gap-3"><b className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15">3</b><span>التواصل لاستكمال أي معلومات مطلوبة ثم اتخاذ قرار النشر.</span></li></ol></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-extrabold text-amber-950"><ShieldCheck size={18}/> تنويه مهم</div><p className="mt-2 text-sm leading-7 text-amber-900">إرسال الطلب لا يعني اعتماد الجهة تلقائيًا. تحتفظ My Car بحق مراجعة البيانات ورفض أو طلب استكمال أي طلب، كما أن إدراج مقدم الخدمة لا يمثل ضمانًا لجودة الخدمة.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 font-extrabold"><Phone size={17} className="text-blue-700"/> بيانات التواصل</div><p className="mt-2 text-sm leading-7 text-slate-500">تأكد من صحة رقم الهاتف والبريد الإلكتروني حتى نتمكن من متابعة الطلب معك.</p></div>
      </aside>
    </section>
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500"><PlatformBrand compact/> · © {new Date().getFullYear()} My Car</footer>
  </main>
}
