import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Save, ShieldCheck, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Role = 'company' | 'owner' | 'supplier'
const governors = ['القاهرة','الجيزة','الإسكندرية','القليوبية','البحيرة','مطروح','المنوفية','الغربية','كفر الشيخ','الدقهلية','دمياط','الشرقية','بورسعيد','الإسماعيلية','السويس','شمال سيناء','جنوب سيناء','بني سويف','الفيوم','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد']
const field = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
export default function AccountProfilePage({ role }: { role: Role }) {
  const [values, setValues] = useState({ displayName:'', organizationName:'', phone:'', emailContact:'', governorate:'', address:'', companyType:'' })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) { setError('خدمة الحسابات غير متاحة حاليًا.'); setLoading(false); return }
      const { data, error: authError } = await supabase.auth.getUser()
      if (!alive) return
      if (authError || !data.user) { window.location.replace('/?login=1'); return }
      const m = data.user.user_metadata || {}
      setValues({ displayName:String(m.display_name || ''), organizationName:String(m.organization_name || ''), phone:String(m.phone || ''), emailContact:String(m.email_contact || data.user.email || ''), governorate:String(m.governorate || ''), address:String(m.address || ''), companyType:String(m.company_type || '') })
      setLoading(false)
    }
    void load()
    return () => { alive = false }
  }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const phone = values.phone.replace(/\D/g, '')
    if (phone && !/^01[0-9]{9}$/.test(phone)) { setError('رقم الموبايل يجب أن يكون رقمًا مصريًا صحيحًا مكوّنًا من 11 رقمًا.'); setBusy(false); return }
    const { error: saveError } = await supabase.auth.updateUser({ data: { display_name:values.displayName.trim(), organization_name:values.organizationName.trim(), phone, email_contact:values.emailContact.trim().toLowerCase(), governorate:values.governorate, address:values.address.trim(), company_type:values.companyType } })
    if (saveError) setError(saveError.message)
    else setNotice('تم حفظ بيانات الحساب بنجاح.')
    setBusy(false)
  }
  const update = (key: keyof typeof values, value: string) => setValues(v => ({...v,[key]:value}))
  if (loading) return <div className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">جارٍ تحميل بيانات الحساب...</div>
  return <section className="mt-6 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
    <div className="bg-gradient-to-l from-[#0b2545] via-[#123b68] to-[#1676ad] p-6 text-white sm:p-8"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><UserRound size={15}/> إعدادات الحساب</span><h2 className="mt-3 text-2xl font-black">بيانات حسابك</h2><p className="mt-2 text-sm leading-7 text-blue-100">راجع بياناتك الأساسية وحدّث معلومات التواصل والعنوان في أي وقت.</p></div>
    <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
      <label className="text-sm font-bold text-slate-700">الاسم بالكامل / اسم المفوض<input required maxLength={120} value={values.displayName} onChange={e=>update('displayName',e.target.value)} className={field}/></label>
      <label className="text-sm font-bold text-slate-700">{role==='company'?'اسم الشركة':'اسم المكتب / النشاط'}<input maxLength={160} value={values.organizationName} onChange={e=>update('organizationName',e.target.value)} className={field}/></label>
      <label className="text-sm font-bold text-slate-700">رقم الموبايل<input dir="ltr" inputMode="tel" maxLength={11} value={values.phone} onChange={e=>update('phone',e.target.value)} className={field}/></label>
      <label className="text-sm font-bold text-slate-700">البريد الإلكتروني للتواصل<input dir="ltr" type="email" value={values.emailContact} onChange={e=>update('emailContact',e.target.value)} className={field}/></label>
      <label className="text-sm font-bold text-slate-700">المحافظة<select value={values.governorate} onChange={e=>update('governorate',e.target.value)} className={field}><option value="">اختر المحافظة</option>{governors.map(g=><option key={g}>{g}</option>)}</select></label>
      {role==='company' && <label className="text-sm font-bold text-slate-700">نشاط الشركة<input value={values.companyType} onChange={e=>update('companyType',e.target.value)} className={field}/></label>}
      <label className="text-sm font-bold text-slate-700 sm:col-span-2">العنوان التفصيلي<textarea rows={3} maxLength={300} value={values.address} onChange={e=>update('address',e.target.value)} className={field}/></label>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950 sm:col-span-2"><ShieldCheck size={18} className="mb-1 inline"/> البريد المسجل للدخول وكلمة المرور لا يتغيران من هذه الصفحة. البريد أعلاه مخصص للتواصل فقط، ويمكن استخدام استعادة كلمة المرور لتغيير كلمة المرور.</div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 sm:col-span-2">{notice}</p>}
      <button disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white hover:bg-blue-800 disabled:opacity-50 sm:col-span-2">{busy?'جارٍ حفظ التعديلات...':'حفظ بيانات الحساب'} <Save size={18}/></button>
      <a href={role==='company'?'/workspace/company':role==='supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-blue-700 sm:col-span-2"><ArrowRight size={16}/> العودة لمساحة العمل</a>
    </form>
  </section>
}
