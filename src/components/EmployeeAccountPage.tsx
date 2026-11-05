import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BadgeCheck, CircleUserRound, LogOut, Save, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

const field = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'

function digits(value: string) {
  return value.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '')
}

export default function EmployeeAccountPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [employmentType, setEmploymentType] = useState('independent')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { window.location.replace('/?login=1'); return }
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!user || authError) { window.location.replace('/?login=1'); return }
      if (user.user_metadata?.organization_type !== 'employee') {
        window.location.replace('/workspace')
        return
      }
      const [{ data: account, error: accountError }, { data: profile }] = await Promise.all([
        supabase.from('employee_accounts').select('employment_type,account_status').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('display_name,phone,contact_email').eq('id', user.id).maybeSingle()
      ])
      if (!active) return
      if (accountError || !account) {
        setError('لم نتمكن من تحميل بيانات حساب الموظف. حدّث الصفحة أو تواصل مع الدعم.')
      } else {
        setEmploymentType(account.employment_type || 'independent')
        setStatus(account.account_status || 'unknown')
      }
      setName(String(profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || ''))
      setPhone(String(profile?.phone || user.user_metadata?.phone || ''))
      setEmail(user.email || profile?.contact_email || '')
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || saving) return
    const cleanName = name.trim()
    const cleanPhone = digits(phone)
    if (cleanName.length < 2) { setError('يرجى إدخال الاسم بالكامل بشكل صحيح.'); return }
    if (cleanPhone.length !== 11) { setError('رقم الموبايل يجب أن يتكون من 11 رقمًا.'); return }
    setSaving(true); setError(''); setNotice('')
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: (await supabase.auth.getUser()).data.user?.id,
      display_name: cleanName,
      phone: cleanPhone,
      contact_email: email || null
    }, { onConflict: 'id' })
    if (profileError) {
      setSaving(false)
      setError('تعذر حفظ بيانات الملف الشخصي: ' + profileError.message)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: cleanName, phone: cleanPhone, email_contact: email }
    })
    setSaving(false)
    if (updateError) setError('تم حفظ بيانات الملف الشخصي، لكن تعذر تحديث بيانات الجلسة: ' + updateError.message)
    else setNotice('تم تحديث بيانات الملف الشخصي بنجاح.')
  }

  async function logout() {
    if (!supabase) return
    const { error: logoutError } = await supabase.auth.signOut()
    if (logoutError) { setError('تعذر تسجيل الخروج: ' + logoutError.message); return }
    window.location.replace('/')
  }

  const statusText = status === 'active' ? 'نشط' : status === 'pending' ? 'قيد المراجعة' : status === 'suspended' ? 'موقوف' : status === 'unknown' ? 'غير محدد' : status || 'غير محدد'

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <a href="/workspace/employee" className="font-black"><PlatformBrand/></a>
        <div className="flex items-center gap-2"><AccountNotifications/><a href="/workspace/employee/messages" className="inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-bold">المراسلات</a><a href="/workspace/employee" className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold"><ArrowRight size={16}/> مساحة الموظف</a></div>
      </div>
    </header>
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-[#102b47] to-[#176b9a] p-6 text-white sm:p-8">
        <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-white/10"><CircleUserRound size={30}/></span><div><p className="text-sm font-bold text-cyan-200">إعدادات حسابك</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">البيانات الشخصية</h1></div></div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">حدّث اسمك ورقم الموبايل المستخدمين في ملف الموظف. بريد الدخول يظل ثابتًا من هذه الصفحة.</p>
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {loading ? <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">جارٍ تحميل بيانات الحساب...</div> : <>
        <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2"><CircleUserRound className="text-blue-700"/><h2 className="text-lg font-black">معلومات التواصل</h2></div>
          <label className="block text-sm font-bold">الاسم بالكامل<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className={field}/></label>
          <label className="block text-sm font-bold">رقم الموبايل<input required type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} className={field}/><span className="mt-1 block text-xs font-normal text-slate-500">أدخل 11 رقمًا.</span></label>
          <label className="block text-sm font-bold">البريد الإلكتروني<input readOnly value={email} dir="ltr" className={field+' bg-slate-50 text-slate-500'}/><span className="mt-1 block text-xs font-normal text-slate-500">لتغيير البريد الإلكتروني، استخدم إعدادات الأمان أو تواصل مع الدعم.</span></label>
          <button disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-black text-white hover:bg-blue-800 disabled:opacity-50"><Save size={18}/>{saving?'جارٍ الحفظ...':'حفظ التعديلات'}</button>
        </form>
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-4"><ShieldCheck className="text-blue-700" size={24}/><div><p className="text-xs text-slate-500">نوع الحساب</p><p className="mt-1 font-extrabold">{employmentType==='independent'?'موظف مستقل':'موظف تابع لشركة'}</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-4"><BadgeCheck className="text-emerald-700" size={24}/><div><p className="text-xs text-slate-500">حالة الحساب</p><p className="mt-1 font-extrabold">{statusText}</p></div></div>
        </section>
        <button type="button" onClick={()=>void logout()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><LogOut size={17}/> تسجيل الخروج</button>
      </>}
    </div>
  </main>
}
