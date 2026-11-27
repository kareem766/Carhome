import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Payment = {
  id:string
  purpose:string
  entity_id:string
  status:string
  amount_due:number
  currency:string
  provider_reference:string|null
  created_at:string
  paid_at:string|null
  updated_at:string
}

const labels:Record<string,{title:string;body:string;icon:typeof CheckCircle2;tone:string}> = {
  paid:{title:'تم تأكيد الدفع الإلكتروني',body:'وصل تأكيد بوابة الدفع بنجاح. تظل الخدمة خاضعة لمراجعة واعتماد إدارة My Car قبل التفعيل.',icon:CheckCircle2,tone:'emerald'},
  pending:{title:'جاري تأكيد عملية الدفع',body:'قد يستغرق وصول تأكيد بوابة الدفع بعض الوقت. لا تعِد الدفع قبل تحديث الحالة لتجنب تكرار العملية.',icon:Clock3,tone:'amber'},
  created:{title:'عملية الدفع قيد التجهيز',body:'تم إنشاء طلب الدفع، وجارٍ تجهيز رابط الدفع أو انتظار رد بوابة الدفع.',icon:Clock3,tone:'blue'},
  failed:{title:'لم تكتمل عملية الدفع',body:'لم يتم تأكيد الدفع. يمكنك المحاولة مرة أخرى من صفحة الخدمة أو استخدام التحويل اليدوي.',icon:XCircle,tone:'rose'},
  expired:{title:'انتهت صلاحية رابط الدفع',body:'انتهت صلاحية رابط الدفع. ارجع إلى صفحة الخدمة لإنشاء محاولة دفع جديدة.',icon:XCircle,tone:'rose'},
  cancelled:{title:'تم إلغاء عملية الدفع',body:'لم يتم تحصيل أي مبلغ من خلال هذه العملية. يمكنك الرجوع إلى الخدمة واختيار طريقة دفع أخرى.',icon:XCircle,tone:'slate'},
}

export default function PaymentResultPage(){
  const paymentId=new URLSearchParams(window.location.search).get('payment_id')||''
  const [payment,setPayment]=useState<Payment|null>(null)
  const [accountRole,setAccountRole]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [refreshing,setRefreshing]=useState(false)
  const load=useCallback(async()=>{
    if(!supabase||!paymentId){setError('رابط متابعة الدفع غير مكتمل.');setLoading(false);return}
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(authError||!user){window.location.replace('/?login=1&redirect='+encodeURIComponent(window.location.pathname+window.location.search));return}
    setAccountRole(String(user.user_metadata?.organization_type||''))
    const {data,error:queryError}=await supabase.from('payments').select('id,purpose,entity_id,status,amount_due,currency,provider_reference,created_at,paid_at,updated_at').eq('id',paymentId).maybeSingle()
    if(queryError){setError('تعذر قراءة حالة الدفع. حدّث الصفحة بعد قليل أو تواصل مع الدعم.');setLoading(false);return}
    if(!data){setError('لم يتم العثور على عملية الدفع لهذا الحساب.');setLoading(false);return}
    setPayment(data as Payment);setError('');setLoading(false)
  },[paymentId])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if(!payment||!['created','pending'].includes(payment.status))return
    const timer=window.setInterval(()=>{void load()},5000)
    return()=>window.clearInterval(timer)
  },[payment?.status,load])
  useEffect(()=>{
    if(payment?.purpose!=='vehicle_registration'||payment.status!=='paid')return
    const destination=accountRole==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'
    const timer=window.setTimeout(()=>window.location.replace(destination),2800)
    return()=>window.clearTimeout(timer)
  },[payment?.purpose,payment?.status,accountRole])
  async function refresh(){setRefreshing(true);await load();setRefreshing(false)}
  const state=payment?(payment.purpose==='vehicle_registration'&&payment.status==='paid'?{...labels.paid,title:'تم تأكيد دفع رسوم تسجيل سيارتك',body:'تم تأكيد الدفع الإلكتروني بنجاح. طلب تسجيل سيارتك الآن ضمن إجراءات مراجعة إدارة My Car، وسيتم تحويلك تلقائيًا إلى صفحة سياراتي.'}:labels[payment.status]||labels.pending):null
  const StateIcon=state?.icon||Clock3
  const amount=payment?new Intl.NumberFormat('ar-EG',{style:'currency',currency:payment.currency||'EGP',maximumFractionDigits:2}).format(Number(payment.amount_due)||0):''
  const backHref=payment?.purpose==='company_subscription'?'/workspace/company/subscriptions':payment?.purpose==='managed_sourcing_request'||payment?.purpose==='managed_sourcing_subscription'?'/workspace/company/managed-sourcing':payment?.purpose==='advertising'||payment?.purpose==='featured_advertising'?'/workspace/advertising-plans':payment?.purpose==='vehicle_registration'?(accountRole==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'):'/'
  const tone=state?.tone||'blue'
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,.12),transparent_35%),linear-gradient(180deg,#f8fafc,#eef4fb)] px-4 py-8 text-slate-900">
    <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_80px_-35px_rgba(15,40,90,.35)]">
      <div className="bg-gradient-to-l from-[#071d38] via-[#123b68] to-[#087eae] p-6 text-white sm:p-8"><PlatformBrand compact/><p className="mt-5 text-xs font-bold text-blue-100">متابعة الدفع الإلكتروني</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">حالة عملية الدفع</h1><p className="mt-2 text-sm leading-7 text-blue-100">تابع تأكيد العملية وحالة مراجعة الخدمة من مكان واحد.</p></div>
      <div className="space-y-5 p-5 sm:p-8">
        {loading?<div className="py-12 text-center text-slate-500"><RefreshCw className="mx-auto mb-3 animate-spin"/>جارٍ تحميل حالة الدفع...</div>:error?<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</div>:payment&&state?<><div className={`rounded-2xl border p-5 ${tone==='emerald'?'border-emerald-200 bg-emerald-50 text-emerald-950':tone==='amber'?'border-amber-200 bg-amber-50 text-amber-950':tone==='rose'?'border-rose-200 bg-rose-50 text-rose-950':tone==='slate'?'border-slate-200 bg-slate-50 text-slate-900':'border-blue-200 bg-blue-50 text-blue-950'}`}><div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/80"><StateIcon size={25}/></span><div><h2 className="text-lg font-black">{state.title}</h2><p className="mt-2 text-sm leading-7">{state.body}</p></div></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">المبلغ</p><p className="mt-1 text-xl font-black text-slate-900">{amount}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">رقم العملية داخل My Car</p><p dir="ltr" className="mt-1 break-all text-sm font-extrabold text-slate-900">{payment.id.slice(0,8).toUpperCase()}</p></div></div><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><div className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18}/> حماية ومراجعة</div><p className="mt-2">لا يتم تفعيل أي اشتراك أو إعلان أو خدمة تسجيل تلقائيًا لمجرد العودة من صفحة الدفع. تأكيد بوابة الدفع يتم التحقق منه على الخادم، ثم تراجع الإدارة استحقاق الخدمة قبل التفعيل.</p></div><p className="text-xs text-slate-500">آخر تحديث: {new Date(payment.updated_at).toLocaleString('ar-EG')}</p></>:null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row"><a href={backHref} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-blue-700 px-5 font-extrabold text-white hover:bg-blue-800">العودة إلى الخدمة</a><button type="button" onClick={()=>void refresh()} disabled={refreshing||loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-bold text-slate-700 disabled:opacity-50"><RefreshCw size={17} className={refreshing?'animate-spin':''}/> تحديث الحالة</button></div>
      </div>
    </section>
  </main>
}
