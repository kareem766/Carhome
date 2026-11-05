import { useState, type FormEvent } from 'react'
import { ArrowRight, UserRound, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

export default function EmployeeRegistrationPage() {
  const [name,setName]=useState('')
  const [phone,setPhone]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [accepted,setAccepted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [sent,setSent]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault();setError('')
    if(!accepted){setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية.');return}
    if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password)){setError('كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل وحرف كبير وصغير ورقم ورمز خاص.');return}
    if(!supabase){setError('خدمة الحسابات غير متاحة حاليًا.');return}
    setBusy(true)
    try{
      const {data,error:signupError}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`,data:{display_name:name.trim(),organization_type:'employee',employment_type:'independent',phone:phone.replace(/\\D/g,''),email_contact:email.trim().toLowerCase(),legal_acceptance:{terms_version:'2026-10-25',privacy_version:'2026-10-25',accepted_at:new Date().toISOString()}}}})
      if(signupError)throw signupError
      if(data.user?.identities?.length===0)throw new Error('هذا البريد مسجل بالفعل. سجّل الدخول أو استخدم استعادة كلمة المرور.')
      if(data.session){window.location.replace('/auth/callback');return}
      setSent(true)
    }catch(err){setError(err instanceof Error?err.message:'تعذر إنشاء الحساب. حاول مرة أخرى.')}finally{setBusy(false)}
  }
  if(sent)return <main dir="rtl" className="grid min-h-screen place-items-center bg-blue-50 p-4"><section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl"><PlatformBrand/><h1 className="mt-5 text-2xl font-black text-slate-900">أكد بريدك الإلكتروني</h1><p className="mt-3 leading-7 text-slate-600">أرسلنا رابط تأكيد إلى بريدك. بعد التأكيد ستتمكن من إنشاء طلب سيارة شهريًا بسائق.</p><p dir="ltr" className="mt-3 break-all font-bold text-blue-800">{email}</p><a href="/?login=1" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">الانتقال لتسجيل الدخول</a></section></main>
  return <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#eff6ff,#f8fafc)] px-4 py-8"><section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white bg-white shadow-xl"><header className="bg-gradient-to-l from-[#102b47] to-[#176b9a] p-7 text-white"><div className="flex items-center justify-between"><PlatformBrand/><UserRound size={30}/></div><h1 className="mt-6 text-3xl font-black">حساب الموظفين</h1><p className="mt-2 text-sm leading-7 text-blue-100">اطلب سيارة شهرية بسائق وتابع العروض المقدمة من ملاك السيارات وموردي الأساطيل.</p></header><form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2"><label className="text-sm font-bold">الاسم بالكامل<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4"/></label><label className="text-sm font-bold">رقم الموبايل<input required inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01xxxxxxxxx" className="mt-2 min-h-12 w-full rounded-xl border px-4" dir="ltr"/></label><label className="text-sm font-bold sm:col-span-2">البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4" dir="ltr"/></label><label className="text-sm font-bold sm:col-span-2">كلمة المرور<input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4" dir="ltr"/></label><div className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-blue-950 sm:col-span-2"><ShieldCheck size={18} className="mb-1"/> حساب الموظف المستقل لا يحتاج إلى ربط بشركة. ويمكن ربط حساب موظف بالشركة من خلال إدارة فريق الشركة وصلاحياتها.</div><label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-5 w-5"/><span>أوافق على <a href="/terms" target="_blank" className="font-bold text-blue-700 underline">شروط الاستخدام</a> و<a href="/privacy" target="_blank" className="font-bold text-blue-700 underline">سياسة الخصوصية</a>.</span></label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}<button disabled={busy||!accepted} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50 sm:col-span-2">{busy?'جارٍ إنشاء الحساب...':'إنشاء حساب الموظف'}<ArrowRight size={18}/></button><a href="/register" className="text-center text-sm font-bold text-slate-500 sm:col-span-2">العودة لاختيار نوع الحساب</a></form></section></main>
}
