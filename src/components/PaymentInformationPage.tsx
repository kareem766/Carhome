import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CreditCard, LoaderCircle, Save, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'

export default function PaymentInformationPage(){
  const [instapay,setInstapay]=useState('01208987035')
  const [vodafone,setVodafone]=useState('01096656281')
  const [loading,setLoading]=useState(true)
  const [authorized,setAuthorized]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  useEffect(()=>{let active=true;async function load(){
    if(!supabase){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false);return}
    const {data:auth,error:authError}=await supabase.auth.getUser()
    if(authError||!auth.user){window.location.replace('/?login=1');return}
    const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
    if(!active)return
    if(adminError||!admin){setError(adminError?.message||'هذه الصفحة متاحة لصاحب المنصة فقط.');setLoading(false);return}
    setAuthorized(true)
    const {data,error:settingsError}=await supabase.from('platform_settings').select('instapay_number,vodafone_cash_number').eq('id',true).maybeSingle()
    if(!active)return
    if(settingsError)setError('تعذر تحميل معلومات الدفع: '+settingsError.message)
    else if(data){setInstapay(data.instapay_number||'');setVodafone(data.vodafone_cash_number||'')}
    setLoading(false)
  }void load();return()=>{active=false}},[])
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!supabase||!authorized)return
    const clean=(v:string)=>v.replace(/[\s-]/g,'')
    if(!/^01\d{9}$/.test(clean(instapay))||!/^01\d{9}$/.test(clean(vodafone))){setError('أدخل رقم موبايل مصري صحيح مكوّن من 11 رقمًا لكل وسيلة دفع.');return}
    setSaving(true);setError('');setNotice('')
    const {data:auth}=await supabase.auth.getUser()
    const {error:saveError}=await supabase.from('platform_settings').update({instapay_number:clean(instapay),vodafone_cash_number:clean(vodafone),updated_at:new Date().toISOString(),updated_by:auth.user?.id||null}).eq('id',true)
    setSaving(false)
    if(saveError){setError('تعذر حفظ معلومات الدفع: '+saveError.message);return}
    setInstapay(clean(instapay));setVodafone(clean(vodafone))
    window.dispatchEvent(new Event('platform-settings-updated'))
    setNotice('تم حفظ معلومات الدفع. ستظهر الأرقام الجديدة تلقائيًا في صفحة باقات الإعلانات وأي صفحة دفع مرتبطة بإعدادات المنصة.')
  }
  const field='mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-left text-lg font-extrabold tracking-wider outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
  return <main dir="rtl" className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,.10),transparent_35%),linear-gradient(180deg,#f8fafc,#eef2ff)] px-3 py-5 sm:px-6 sm:py-8"><div className="mx-auto max-w-5xl">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white bg-white/95 p-5 shadow-md"><div><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">معلومات الدفع على المنصة</h1><p className="mt-2 text-sm leading-7 text-slate-500">إدارة أرقام التحويل الرسمية التي تظهر للمستخدمين قبل إرسال طلبات الدفع.</p></div><a href="/workspace/admin" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><ArrowRight size={17}/> العودة للإدارة</a></header>
    <AdminPageNavigation/>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading?<div className="py-16 text-center text-slate-500"><LoaderCircle className="mx-auto animate-spin"/> جارٍ تحميل معلومات الدفع...</div>:authorized&&<form onSubmit={save} className="mt-6 space-y-5">
      <section className="rounded-3xl border border-white bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><CreditCard/></span><div><h2 className="text-lg font-extrabold">وسائل التحويل المعتمدة</h2><p className="text-sm text-slate-500">أي تعديل هنا ينعكس على معلومات الدفع التي يراها المستخدم.</p></div></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="block text-sm font-extrabold">رقم InstaPay<input dir="ltr" inputMode="numeric" autoComplete="off" required maxLength={16} value={instapay} onChange={e=>setInstapay(e.target.value)} className={field}/><span className="mt-2 block text-xs font-normal text-slate-500">يظهر عند اختيار InstaPay في خطوة الدفع.</span></label><label className="block text-sm font-extrabold">رقم Vodafone Cash<input dir="ltr" inputMode="numeric" autoComplete="off" required maxLength={16} value={vodafone} onChange={e=>setVodafone(e.target.value)} className={field}/><span className="mt-2 block text-xs font-normal text-slate-500">يظهر عند اختيار Vodafone Cash في خطوة الدفع.</span></label></div>
      </section>
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950"><ShieldCheck className="mt-1 shrink-0"/><p>تأكد من ملكية الأرقام وصحتها قبل الحفظ. تغيير الأرقام لا يحذف طلبات الدفع السابقة ولا يعدّل بيانات التحويل المسجلة بالفعل في الطلبات القديمة؛ الطلبات الجديدة فقط ستعرض المعلومات الحالية.</p></div>
      <div className="sticky bottom-3 flex justify-end rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><button disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-50"><Save size={18}/>{saving?'جارٍ الحفظ...':'حفظ معلومات الدفع'}</button></div>
    </form>}
  </div></main>
}
