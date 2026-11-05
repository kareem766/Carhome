import { useEffect, useState } from 'react'
import { ArrowRight, ClipboardList, MessageCircle, RefreshCw, CheckCircle2, XCircle, CarFront } from 'lucide-react'
import EmployeeWorkspaceHeader from './EmployeeWorkspaceHeader'
import { supabase } from '../lib/supabase'

type RequestRow = { id:string; title:string; vehicle_type:string; governorate:string; duration_months:number; start_date:string; status:string; created_at:string; pickup_address?:string; details?:string|null; seats?:number; work_days_per_week?:number; daily_hours?:number; budget_min_egp?:number|null; budget_max_egp?:number|null }
type OfferRow = { id:string; request_id:string; monthly_price_egp:number; status:string; message:string|null; created_at?:string; organizations:{name:string}|{name:string}[]|null; vehicles:{make:string;model:string;model_year:number}|{make:string;model:string;model_year:number}[]|null }
const requestLabels:Record<string,string> = {pending_review:'قيد مراجعة الإدارة',open:'منشور ويستقبل العروض',rejected:'مرفوض',closed:'مغلق',cancelled:'ملغي'}
const offerLabels:Record<string,string> = {submitted:'عرض جديد',accepted:'تم اختيار العرض',rejected:'مرفوض',withdrawn:'مسحوب'}
const pill = 'rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800'
export default function EmployeeRequestsOffersPage(){
 const [requests,setRequests]=useState<RequestRow[]>([])
 const [offers,setOffers]=useState<OfferRow[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function load(){
  if(!supabase){setError('تعذر الاتصال بالخدمة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user){window.location.replace('/?login=1');return}
  if(user.user_metadata?.organization_type!=='employee'){window.location.replace('/workspace');return}
  const account=await supabase.from('employee_accounts').select('account_status').eq('user_id',user.id).maybeSingle()
  if(account.error||!account.data||account.data.account_status!=='active'){setError('حساب الموظف غير نشط أو غير معتمد. يرجى التواصل مع الدعم.');setLoading(false);return}
  const [requestResult,offerResult]=await Promise.all([
   supabase.from('employee_rental_requests').select('id,title,vehicle_type,governorate,duration_months,start_date,status,created_at,pickup_address,details,seats,work_days_per_week,daily_hours,budget_min_egp,budget_max_egp').eq('employee_user_id',user.id).order('created_at',{ascending:false}),
   supabase.from('employee_rental_offers').select('id,request_id,monthly_price_egp,status,message,created_at,organizations(name),vehicles(make,model,model_year)').order('created_at',{ascending:false})
  ])
  if(requestResult.error)setError('تعذر تحميل طلباتك: '+requestResult.error.message)
  else setRequests((requestResult.data||[]) as RequestRow[])
  if(offerResult.error)setError('تعذر تحميل العروض: '+offerResult.error.message)
  else setOffers((offerResult.data||[]) as unknown as OfferRow[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 async function respond(id:string,accept:boolean){
  if(!supabase)return
  setBusy(id);setError('');setNotice('')
  const {error:e}=await supabase.rpc('employee_respond_to_offer',{p_offer_id:id,p_accept:accept})
  if(e)setError('تعذر تحديث العرض: '+e.message)
  else{setNotice(accept?'تم اختيار العرض وتحديث حالة الطلب.':'تم رفض العرض.');await load()}
  setBusy('')
 }
 async function cancel(id:string){
  if(!supabase||!window.confirm('هل تريد إلغاء هذا الطلب؟ لن يتمكن مقدمو السيارات من إرسال عروض جديدة عليه.'))return
  setBusy(id);setError('');setNotice('')
  const {data:{user}}=await supabase.auth.getUser()
  const {data,error:e}=await supabase.from('employee_rental_requests').update({status:'cancelled'}).eq('id',id).eq('employee_user_id',user?.id).in('status',['pending_review','open']).select('id').maybeSingle()
  if(e)setError('تعذر إلغاء الطلب: '+e.message)
  else if(!data)setError('لم يعد الطلب قابلًا للإلغاء. حدّث الصفحة للتحقق من حالته.')
  else{setNotice('تم إلغاء الطلب بنجاح.');await load()}
  setBusy('')
 }
 const totalOffers=offers.length
 return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
  <EmployeeWorkspaceHeader active="requests"/>
  <div className="mx-auto max-w-6xl space-y-6 px-4 py-7">
   <section className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#176b9a] p-6 text-white sm:p-8"><a href="/workspace/employee" className="inline-flex items-center gap-2 text-xs font-bold text-blue-100"><ArrowRight size={16}/> العودة لمساحة العمل</a><p className="mt-4 text-sm font-bold text-cyan-200">إدارة طلباتك ومتابعة عروض مقدمي السيارات</p><h1 className="mt-2 text-3xl font-black">طلباتي والعروض المقدمة</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">تابع حالة كل طلب، راجع تفاصيل العروض والأسعار والسيارات المقترحة، اختر العرض المناسب أو ارفضه، وتواصل مع مقدم العرض من داخل المنصة.</p></section>
   <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">إجمالي الطلبات</p><p className="mt-1 text-2xl font-black">{requests.length}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">إجمالي العروض</p><p className="mt-1 text-2xl font-black">{totalOffers}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">عروض جديدة</p><p className="mt-1 text-2xl font-black">{offers.filter(x=>x.status==='submitted').length}</p></div></div>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
   <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-black"><ClipboardList className="text-blue-700"/> طلباتك وعروضها</h2><button onClick={()=>void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold"><RefreshCw size={15}/> تحديث</button></div>
   {loading?<div className="rounded-2xl border bg-white p-8 text-center text-slate-500">جارٍ تحميل الطلبات والعروض...</div>:requests.length===0?<div className="rounded-2xl border bg-white p-8 text-center"><CarFront className="mx-auto text-slate-400" size={34}/><p className="mt-3 font-bold">لم ترسل أي طلبات حتى الآن.</p><a href="/workspace/employee#new-request" className="mt-4 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">إنشاء طلب سيارة</a></div>:<div className="space-y-4">{requests.map(req=>{const related=offers.filter(o=>o.request_id===req.id);return <article key={req.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b bg-slate-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{req.title}</h3><p className="mt-2 text-sm text-slate-600">{req.vehicle_type} · {req.governorate} · {req.duration_months} شهر · {req.seats||'—'} ركاب</p><p className="mt-1 text-xs text-slate-500">بداية التعاقد: {req.start_date} · أُرسل في: {new Date(req.created_at).toLocaleDateString('ar-EG')}</p></div><span className={pill}>{requestLabels[req.status]||req.status}</span></div><div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><p>مكان الاستلام: {req.pickup_address||'غير محدد'}</p><p>أيام العمل: {req.work_days_per_week||'—'} أسبوعيًا</p><p>ساعات العمل: {req.daily_hours||'—'} يوميًا</p><p>الميزانية: {req.budget_min_egp??'—'} إلى {req.budget_max_egp??'—'} جنيه</p></div>{req.details&&<p className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-600">{req.details}</p>}</div>
    <div className="p-5"><div className="mb-3 flex items-center justify-between"><h4 className="font-black">العروض المقدمة</h4><span className="text-xs text-slate-500">{related.length} عرض</span></div>{related.length===0?<p className="rounded-xl border border-dashed p-4 text-center text-sm text-slate-500">لا توجد عروض على هذا الطلب حتى الآن.</p>:<div className="space-y-3">{related.map(offer=>{const org=Array.isArray(offer.organizations)?offer.organizations[0]:offer.organizations;const vehicle=Array.isArray(offer.vehicles)?offer.vehicles[0]:offer.vehicles;return <div key={offer.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold">{org?.name||'مقدم العرض'}</p><p className="mt-1 text-xs text-slate-500">{vehicle?vehicle.make+' '+vehicle.model+' '+vehicle.model_year:'تفاصيل السيارة غير متاحة'}</p></div><span className={pill}>{offerLabels[offer.status]||offer.status}</span></div><p className="mt-3 text-xl font-black text-blue-900">{Number(offer.monthly_price_egp).toLocaleString('ar-EG')} <span className="text-xs font-bold">جنيه شهريًا</span></p>{offer.message&&<p className="mt-2 text-sm leading-6 text-slate-600">{offer.message}</p>}<div className="mt-4 flex flex-wrap gap-2">{['submitted','accepted'].includes(offer.status)&&<a href={'/workspace/employee/messages?offer='+offer.id} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800"><MessageCircle size={15}/> مراسلة مقدم العرض</a>}{req.status==='open'&&offer.status==='submitted'&&<><button disabled={busy===offer.id} onClick={()=>void respond(offer.id,true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 size={15}/> اختيار العرض</button><button disabled={busy===offer.id} onClick={()=>void respond(offer.id,false)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle size={15}/> رفض العرض</button></>}</div></div>})}</div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">رقم الطلب: {req.id.slice(0,8)}</span>{['pending_review','open'].includes(req.status)&&<button disabled={busy===req.id} onClick={()=>void cancel(req.id)} className="min-h-10 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 disabled:opacity-50">إلغاء الطلب</button>}</div></div>
   </article>})}</div>}
  </div>
 </main>
}
