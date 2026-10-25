import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Check, CircleDollarSign, Clock3, LoaderCircle, Megaphone, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Plan = { id:string; name:string; description:string; duration_days:number; price_egp:number; features:string[]; display_order:number }
type Vehicle = { id:string; make:string; model:string; model_year:number }
const money=(value:number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(value)

export default function AdvertisingPlansPage(){
  const [plans,setPlans]=useState<Plan[]>([])
  const [vehicles,setVehicles]=useState<Vehicle[]>([])
  const [selectedPlan,setSelectedPlan]=useState<Plan|null>(null)
  const [vehicleId,setVehicleId]=useState('')
  const [userId,setUserId]=useState('')
  const [orgId,setOrgId]=useState('')
  const [loading,setLoading]=useState(true)
  const [sending,setSending]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{let active=true;async function load(){
    if(!supabase){if(active){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false)}return}
    const [{data:planRows,error:planError},{data:auth}]=await Promise.all([
      supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features,display_order').eq('is_active',true).order('display_order').order('created_at'),
      supabase.auth.getUser()
    ])
    if(!active)return
    if(planError)setError('تعذر تحميل الباقات: '+planError.message)
    setPlans((planRows||[]) as Plan[])
    if(auth.user){
      setUserId(auth.user.id)
      const {data:membership}=await supabase.from('organization_memberships').select('organization_id,organizations(organization_type)').eq('user_id',auth.user.id).limit(1).maybeSingle()
      if(active&&membership?.organization_id){
        const orgType=(membership as any).organizations?.organization_type
        if(['individual_owner','fleet_supplier'].includes(String(orgType))){
          setOrgId(membership.organization_id)
          const {data:owned}=await supabase.from('vehicles').select('id,make,model,model_year').eq('organization_id',membership.organization_id).eq('review_status','approved').order('created_at',{ascending:false})
          if(active)setVehicles((owned||[]) as Vehicle[])
        }
      }
    }
    if(active)setLoading(false)
  }void load();return()=>{active=false}},[])

  async function submitRequest(){
    if(!supabase||!selectedPlan||!userId||!orgId||!vehicleId)return
    setSending(true);setError('');setNotice('')
    const {error:e}=await supabase.from('vehicle_promotions').insert({vehicle_id:vehicleId,organization_id:orgId,advertising_plan_id:selectedPlan.id,created_by:userId,status:'pending_review',payment_status:'pending'})
    setSending(false)
    if(e){setError('تعذر إرسال طلب الترويج: '+e.message);return}
    setNotice('تم إرسال طلبك بنجاح. ستراجع الإدارة الطلب، ولن يتم تفعيل الإعلان قبل اعتماد الطلب والتحقق من الدفع.')
    setSelectedPlan(null);setVehicleId('')
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><PlatformBrand/><a href="/workspace/catalog" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50"><ArrowRight size={17}/> العودة للكتالوج</a></div></header>
    <section className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,.4),transparent_35%),radial-gradient(circle_at_85%_90%,rgba(245,158,11,.18),transparent_35%)]"/><div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-blue-100"><Sparkles size={15}/> حلول ظهور مرنة لسياراتك</span><h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">خلّي سيارتك <span className="text-blue-300">أقرب لاهتمام الشركات.</span></h1><p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">اختار باقة تناسب هدفك ومدة ظهورك. الباقات وأسعارها قابلة للتحديث من لوحة تحكم إدارة Carhome.</p><div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Megaphone className="text-blue-300"/><p className="mt-3 font-extrabold">ظهور أوضح</p><p className="mt-1 text-xs leading-6 text-slate-300">تمييز السيارات المروّج لها داخل الكتالوج.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Clock3 className="text-blue-300"/><p className="mt-3 font-extrabold">مدة محددة</p><p className="mt-1 text-xs leading-6 text-slate-300">اختيار مدة تناسب احتياجك.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="text-blue-300"/><p className="mt-3 font-extrabold">مراجعة إدارية</p><p className="mt-1 text-xs leading-6 text-slate-300">التفعيل بعد اعتماد الطلب والتحقق من الدفع.</p></div></div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-extrabold text-blue-700">اختار الأنسب لك</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">باقات الإعلانات</h2><p className="mt-2 text-sm leading-7 text-slate-500">الأسعار المعروضة بالجنيه المصري، ويمكن لإدارة المنصة تعديلها في أي وقت.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200"><CircleDollarSign size={17}/> {plans.length} باقات متاحة</span></div>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
      {loading?<div className="py-16 text-center text-slate-500"><LoaderCircle className="mx-auto animate-spin"/> جارٍ تحميل الباقات...</div>:plans.length===0?<div className="mt-6 rounded-3xl border border-dashed bg-white p-10 text-center"><Megaphone className="mx-auto text-slate-300" size={38}/><h3 className="mt-4 font-extrabold">الباقات قيد التجهيز</h3><p className="mt-2 text-sm text-slate-500">لم يتم نشر باقات إعلانية بعد. يمكنك العودة لاحقًا.</p></div>:<div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map((p,i)=><article key={p.id} className={'relative flex flex-col overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl '+(i===1?'border-blue-500 ring-2 ring-blue-100':'border-slate-200')}><div className="flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Megaphone size={23}/></span>{i===1&&<span className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white">الأكثر اختيارًا</span>}</div><h3 className="mt-5 text-xl font-black">{p.name}</h3><p className="mt-2 min-h-14 text-sm leading-7 text-slate-500">{p.description}</p><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">السعر</p><p className="mt-1 text-3xl font-black text-blue-800">{money(Number(p.price_egp))}<span className="mr-2 text-sm font-bold text-slate-500">ج.م</span></p><p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-slate-600"><Clock3 size={15}/> مدة الإعلان {p.duration_days} يوم</p></div><ul className="mt-5 flex-1 space-y-3">{(p.features||[]).map(f=><li key={f} className="flex items-start gap-2 text-sm leading-6 text-slate-700"><Check size={17} className="mt-1 shrink-0 text-emerald-600"/><span>{f}</span></li>)}</ul><button onClick={()=>{setSelectedPlan(p);setVehicleId('');setError('')}} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 font-extrabold text-white hover:bg-blue-700"><BadgeCheck size={17}/> اختر هذه الباقة</button>{selectedPlan?.id===p.id&&<div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="font-extrabold">تحديد السيارة المراد ترويجها</p>{!userId?<a href="/?login=1" className="mt-3 block rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white">سجّل الدخول للمتابعة</a>:!orgId?<p className="mt-3 text-sm leading-7 text-slate-600">طلب الترويج متاح لحسابات ملاك السيارات وموردي الأساطيل المرتبطة بمؤسسة.</p>:vehicles.length===0?<p className="mt-3 text-sm leading-7 text-slate-600">لا توجد سيارة معتمدة في حسابك. أضف سيارة وانتظر اعتمادها قبل طلب الترويج.</p>:<><label className="mt-3 block text-sm font-bold">السيارة<select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="">اختر سيارة معتمدة</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.model_year}</option>)}</select></label><button disabled={!vehicleId||sending} onClick={()=>void submitRequest()} className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 px-4 font-extrabold text-white disabled:opacity-50">{sending?'جارٍ إرسال الطلب...':'إرسال طلب الترويج'}</button></>}</div>}</article>)}</div>}
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-extrabold text-amber-950">معلومة مهمة عن الدفع</p><p className="mt-2 text-sm leading-7 text-amber-900">طلب الباقة لا يعني تفعيل الإعلان تلقائيًا. الإدارة تراجع الطلب وتؤكد الدفع يدويًا بعد التحقق من التحويل، ولا يتم تحصيل أي مبلغ إلكترونيًا من هذه الصفحة.</p></div>
    </section>
  </main>
}
