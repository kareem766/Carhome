import { useState, type FormEvent } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Role = 'individual_owner' | 'company' | 'fleet_supplier' | 'employee'
const governorates = ['القاهرة','الجيزة','الإسكندرية','القليوبية','البحيرة','مطروح','المنوفية','الغربية','كفر الشيخ','الدقهلية','دمياط','الشرقية','بورسعيد','الإسماعيلية','السويس','شمال سيناء','جنوب سيناء','بني سويف','الفيوم','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد']
const companyTypes = ['عقارات','بترول وطاقة','نقل ولوجستيات','تجارة وتوزيع','صناعة','مقاولات','خدمات','سياحة وفنادق','رعاية صحية','تقنية واتصالات','أخرى']

export default function GoogleProfileCompletionPage() {
  const role = new URLSearchParams(window.location.search).get('role') as Role | null
  const validRole = role === 'individual_owner' || role === 'company' || role === 'fleet_supplier' || role === 'employee'
  const [name, setName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [phone, setPhone] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [address, setAddress] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [fleetCount, setFleetCount] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!validRole) { setError('نوع الحساب غير صالح. ارجع إلى صفحة التسجيل واختر نوع الحساب.'); return }
    if (!accepted) { setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية.'); return }
    const normalizedPhone = phone.replace(/\D/g, '')
    if (!/^01[0-9]{9}$/.test(normalizedPhone)) { setError('أدخل رقم موبايل مصري صحيحًا مكوّنًا من 11 رقمًا ويبدأ بـ 01.'); return }
    if (role === 'company' && !companyType) { setError('اختر نشاط الشركة.'); return }
    if (role === 'fleet_supplier' && (!Number.isInteger(Number(fleetCount)) || Number(fleetCount) < 1)) { setError('أدخل عدد سيارات صحيحًا لا يقل عن سيارة واحدة.'); return }
    if (!supabase) { setError('خدمة الحسابات غير متاحة حاليًا.'); return }
    setBusy(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData.session?.user) throw new Error('انتهت جلسة Google. سجّل الدخول مرة أخرى.')
      const email = sessionData.session.user.email || ''
      const workspaceName = role === 'company' || role === 'fleet_supplier' ? organizationName.trim() : name.trim()
      if (!name.trim()) throw new Error('أدخل الاسم بالكامل.')
      if (role !== 'employee' && (!workspaceName || !governorate || !address.trim())) throw new Error('أكمل جميع البيانات المطلوبة.')
      const metadata = {
        display_name: name.trim(),
        organization_name: role === 'employee' ? null : workspaceName,
        organization_type: role,
        employment_type: role === 'employee' ? 'independent' : null,
        phone: normalizedPhone,
        email_contact: email,
        governorate: role === 'employee' ? null : governorate,
        address: role === 'employee' ? null : address.trim(),
        company_type: role === 'company' ? companyType : null,
        fleet_vehicle_count: role === 'fleet_supplier' ? Number(fleetCount) : null,
        onboarding_version: 2,
        legal_acceptance: { terms_version: '2026-10-25', privacy_version: '2026-10-25', accepted_at: new Date().toISOString() }
      }
      const { error: updateError } = await supabase.auth.updateUser({ data: metadata })
      if (updateError) throw updateError
      window.location.replace('/auth/callback')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر حفظ بيانات الحساب.')
      setBusy(false)
    }
  }

  if (!validRole) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="max-w-lg rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-black text-slate-900">نوع الحساب غير محدد</h1><p className="mt-3 text-sm leading-7 text-slate-600">ارجع إلى صفحة التسجيل واختر نوع الحساب قبل المتابعة باستخدام Google.</p><a href="/register" className="mt-5 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">اختيار نوع الحساب</a></section></main>

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#eff6ff,#f8fafc)] p-4">
    <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white bg-white shadow-xl">
      <header className="bg-[#142D4E] p-6 text-white sm:p-8"><div className="inline-flex rounded-xl border border-white/15 bg-white/10 p-3"><PlatformBrand/></div><p className="mt-6 text-sm font-bold text-blue-200">خطوة أخيرة</p><h1 className="mt-2 text-2xl font-black">استكمال بيانات حسابك</h1><p className="mt-3 text-sm leading-7 text-blue-100">تم التحقق من حساب Google. أكمل البيانات المطلوبة لإنشاء مساحة عملك على My Car عربيتي.</p></header>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
        <label className="text-sm font-bold text-slate-700">الاسم بالكامل *<input required value={name} onChange={e=>setName(e.target.value)} className={fieldClass} autoComplete="name"/></label>
        {(role === 'company' || role === 'fleet_supplier') && <label className="text-sm font-bold text-slate-700">{role === 'company' ? 'اسم الشركة *' : 'اسم المكتب / الشركة *'}<input required value={organizationName} onChange={e=>setOrganizationName(e.target.value)} className={fieldClass}/></label>}
        <label className="text-sm font-bold text-slate-700">رقم الموبايل *<input required type="tel" inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value)} className={fieldClass} placeholder="01xxxxxxxxx" dir="ltr"/></label>
        {role !== 'employee' && <label className="text-sm font-bold text-slate-700">المحافظة *<select required value={governorate} onChange={e=>setGovernorate(e.target.value)} className={fieldClass}><option value="">اختر المحافظة</option>{governorates.map(x=><option key={x}>{x}</option>)}</select></label>}
        {role === 'company' && <label className="text-sm font-bold text-slate-700">نشاط الشركة *<select required value={companyType} onChange={e=>setCompanyType(e.target.value)} className={fieldClass}><option value="">اختر النشاط</option>{companyTypes.map(x=><option key={x}>{x}</option>)}</select></label>}
        {role === 'fleet_supplier' && <label className="text-sm font-bold text-slate-700">عدد سيارات الأسطول *<input required type="number" min="1" step="1" value={fleetCount} onChange={e=>setFleetCount(e.target.value)} className={fieldClass}/></label>}
        {role !== 'employee' && <label className="text-sm font-bold text-slate-700 sm:col-span-2">العنوان بالتفصيل *<input required value={address} onChange={e=>setAddress(e.target.value)} className={fieldClass} placeholder="المنطقة / الشارع / رقم العقار"/></label>}
        {role === 'employee' && <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-900 sm:col-span-2">حساب الموظف مستقل ويمكن ربطه بشركة لاحقًا من خلال مسؤول الشركة، ولا يحتاج إلى إنشاء مؤسسة مستقلة.</p>}
        <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-slate-700 sm:col-span-2"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-700"/><span>أوافق على <a href="/terms" target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">شروط الاستخدام</a> و<a href="/privacy" target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">سياسة الخصوصية</a>.</span></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 sm:col-span-2">{error}</p>}
        <button type="submit" disabled={busy || !accepted} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 font-extrabold text-white disabled:opacity-60 sm:col-span-2">{busy ? 'جارٍ حفظ البيانات...' : 'حفظ البيانات وفتح حسابي'} <CheckCircle2 size={18}/></button>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 sm:col-span-2"><ShieldCheck size={15}/> لا نطلب كلمة مرور Google ولا نخزنها.</p>
      </form>
    </section>
  </main>
}
