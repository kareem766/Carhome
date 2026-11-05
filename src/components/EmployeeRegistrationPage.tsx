import { useState, type FormEvent } from 'react'
import { ArrowRight, UserRound, ShieldCheck, Sparkles, CarFront, BadgeCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

function normalizePhone(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

export default function EmployeeRegistrationPage() {
  const [name,setName]=useState('')
  const [phone,setPhone]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [accepted,setAccepted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [sent,setSent]=useState(false)
  const [showPassword,setShowPassword]=useState(false)

  async function submit(e:FormEvent){
    e.preventDefault()
    setError('')

    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const phoneDigits = normalizePhone(phone).replace(/\D/g,'')

    if(!cleanName || !phone.trim() || !cleanEmail || !password || !accepted){
      setError('من فضلك أكمل جميع الحقول المطلوبة ووافق على شروط الاستخدام وسياسة الخصوصية قبل إنشاء الحساب.')
      return
    }
    if(cleanName.length < 2){
      setError('يرجى إدخال الاسم بالكامل بشكل صحيح.')
      return
    }
    if(phoneDigits.length !== 11){
      setError('رقم الموبايل يجب أن يتكون من 11 رقمًا بالضبط.')
      return
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)){
      setError('يرجى إدخال بريد إلكتروني صحيح.')
      return
    }
    if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password)){
      setError('كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل وحرف كبير وصغير ورقم ورمز خاص.')
      return
    }
    if(!supabase){setError('خدمة الحسابات غير متاحة حاليًا.');return}

    setBusy(true)
    try{
      const {data,error:signupError}=await supabase.auth.signUp({email:cleanEmail,password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`,data:{display_name:cleanName,organization_type:'employee',employment_type:'independent',phone:phoneDigits,email_contact:cleanEmail,legal_acceptance:{terms_version:'2026-10-25',privacy_version:'2026-10-25',accepted_at:new Date().toISOString()}}}})
      if(signupError)throw signupError
      if(data.user?.identities?.length===0)throw new Error('هذا البريد مسجل بالفعل. سجّل الدخول أو استخدم استعادة كلمة المرور.')
      if(data.session){window.location.replace('/auth/callback');return}
      setSent(true)
    }catch(err){setError(err instanceof Error?err.message:'تعذر إنشاء الحساب. حاول مرة أخرى.')}finally{setBusy(false)}
  }

  if(sent)return <main dir="rtl" className="grid min-h-screen place-items-center bg-blue-50 p-4"><section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl"><PlatformBrand/><h1 className="mt-5 text-2xl font-black text-slate-900">أكد بريدك الإلكتروني</h1><p className="mt-3 leading-7 text-slate-600">أرسلنا رابط تأكيد إلى بريدك. بعد التأكيد ستتمكن من إنشاء طلب سيارة شهريًا بسائق.</p><p dir="ltr" className="mt-3 break-all font-bold text-blue-800">{email}</p><a href="/?login=1" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">الانتقال لتسجيل الدخول</a></section></main>

  return <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#eff6ff,#f8fafc)] px-4 py-8">
    <div className="mx-auto mb-4 max-w-2xl"><a href="/register" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 text-sm font-extrabold text-blue-800 shadow-sm"><ArrowRight size={18}/> الرجوع لاختيار نوع الحساب</a></div>
    <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white bg-white shadow-xl">
      <header className="bg-gradient-to-l from-[#102b47] to-[#176b9a] p-7 text-white">
        <div className="flex items-center justify-between"><PlatformBrand/><UserRound size={30}/></div>
        <h1 className="mt-6 text-3xl font-black">حساب الموظفين</h1>
        <p className="mt-2 text-sm leading-7 text-blue-100">اطلب سيارة شهرية بسائق وتابع العروض المقدمة من ملاك السيارات وموردي الأساطيل.</p>
      </header>
      <div className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-l from-amber-50 via-blue-50 to-cyan-50 p-5 sm:p-6">
        <div className="absolute -left-8 -top-10 h-28 w-28 rounded-full bg-amber-300/20 blur-2xl"/>
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-amber-600 shadow-sm"><Sparkles size={22}/></div>
          <div>
            <p className="text-base font-black leading-7 text-[#123b68] sm:text-lg">مشوارك اليومي يستاهل راحة وذكاء في الاختيار!</p>
            <p className="mt-1 text-sm leading-7 text-slate-700">بدل ما تضيع وقتك في البحث، اطلب سيارتك الشهرية بسائق من مكان واحد، واستقبل عروضًا من ملاك السيارات وموردي الأساطيل، وقارن بينها واختار الأنسب لاحتياجاتك وميزانيتك بكل سهولة.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-blue-900"><span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5"><CarFront size={14}/> سيارة بسائق</span><span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5"><BadgeCheck size={14}/> عروض متعددة</span><span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5"><Sparkles size={14}/> اختيار أسهل</span></div>
          </div>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="grid gap-4 p-6 sm:grid-cols-2">
        <label className="text-sm font-bold">الاسم بالكامل <span className="text-red-600">*</span><input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl border px-4"/></label>
        <label className="text-sm font-bold">رقم الموبايل <span className="text-red-600">*</span><input required type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01xxxxxxxxx" className="mt-2 min-h-12 w-full rounded-xl border px-4" dir="ltr" aria-describedby="employee-phone-hint"/><span id="employee-phone-hint" className="mt-1 block text-xs font-normal text-slate-500">أدخل 11 رقمًا على الأقل.</span></label>
        <label className="text-sm font-bold sm:col-span-2">البريد الإلكتروني <span className="text-red-600">*</span><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4" dir="ltr"/></label>
        <div className="sm:col-span-2"><label className="block text-sm font-bold">كلمة المرور <span className="text-red-600">*</span><span className="relative mt-2 block"><input required type={showPassword?'text':'password'} minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="min-h-12 w-full rounded-xl border px-4 pl-12" dir="ltr" placeholder="أنشئ كلمة مرور قوية"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'} className="absolute left-3 top-2.5 rounded-lg p-2 text-slate-500 hover:bg-slate-100">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label><div className="mt-3 grid gap-2 rounded-xl border border-blue-100 bg-gradient-to-l from-blue-50 to-white p-4 text-xs sm:grid-cols-2">{[['8 أحرف على الأقل',password.length>=8],['حرف كبير وحرف صغير (A-Z / a-z)',/[A-Z]/.test(password)&&/[a-z]/.test(password)],['رقم واحد على الأقل (0-9)',/[0-9]/.test(password)],['رمز خاص مثل ! @ # $ %',/[^A-Za-z0-9]/.test(password)]].map(([label,valid])=><span key={String(label)} className={'flex items-center gap-2 '+(valid?'font-bold text-emerald-700':'text-slate-600')}><CheckCircle2 size={16} className={valid?'text-emerald-600':'text-slate-300'}/>{label}</span>)}</div><p className="mt-2 text-xs leading-6 text-slate-500">اختر كلمة مرور يصعب تخمينها، ولا تستخدم كلمة مرور حساب آخر. لن يُقبل التسجيل قبل استيفاء الشروط الأربعة.</p></div>
        <div className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-blue-950 sm:col-span-2"><ShieldCheck size={18} className="mb-1"/> حساب الموظف المستقل لا يحتاج إلى ربط بشركة. ويمكن ربط حساب موظف بالشركة من خلال إدارة فريق الشركة وصلاحياتها.</div>
        <label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-5 w-5"/><span>أوافق على <a href="/terms" target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">شروط الاستخدام</a> و<a href="/privacy" target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">سياسة الخصوصية</a>. <span className="text-red-600">*</span></span></label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
        <button disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50 sm:col-span-2">{busy?'جارٍ إنشاء الحساب...':'إنشاء حساب الموظف'}<ArrowRight size={18}/></button>
        <a href="/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 sm:col-span-2"><ArrowRight size={17}/> الرجوع لاختيار نوع الحساب</a>
      </form>
    </section>
  </main>
}
