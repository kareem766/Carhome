import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, CheckCircle2, CreditCard, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import CompanyPageSidebar from './CompanyPageSidebar'

type Plan = { id:string; name:string; slug:string; description:string|null; monthly_price:number; currency:string; features:string[]; limits:Record<string,unknown>; is_popular:boolean }
type Subscription = { id:string; plan_name:string; amount_egp:number; status:string; payment_status:string; payment_reference:string|null; payment_transfer_date:string|null; starts_at:string|null; ends_at:string|null; created_at:string }
type PaymentDetails = { instapay_number?:string|null; vodafone_cash_number?:string|null }
type CouponPreview = { code:string; original_amount_egp:number; discount_amount_egp:number; final_amount_egp:number }

const money=(n:number,c='EGP')=>new Intl.NumberFormat('ar-EG',{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(n)||0)
const statusLabel:Record<string,string>={pending:'بانتظار مراجعة التحويل',active:'اشتراك نشط',expired:'منتهي',cancelled:'ملغي'}
const paymentLabel:Record<string,string>={submitted:'تم إرسال التحويل',verified:'تم اعتماد الدفع',rejected:'التحويل مرفوض',pending:'لم يتم إرسال التحويل',waived:'معفى من الدفع'}

export default function CompanySubscriptionsPage(){
 const [organizationId,setOrganizationId]=useState('')
 const [plans,setPlans]=useState<Plan[]>([])
 const [history,setHistory]=useState<Subscription[]>([])
 const [payment,setPayment]=useState<PaymentDetails>({})
 const [selected,setSelected]=useState('')
 const [reference,setReference]=useState('')
 const [transferDate,setTransferDate]=useState(new Date().toISOString().slice(0,10))
 const [method,setMethod]=useState<'instapay'|'vodafone'>('instapay')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [couponCode,setCouponCode]=useState('')
 const [couponPreview,setCouponPreview]=useState<CouponPreview|null>(null)
 const [couponLoading,setCouponLoading]=useState(false)

 async function load(){
  if(!supabase){setError('إعدادات الاتصال غير مكتملة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user){window.location.replace('/?login=1');return}
  const {data:membership,error:membershipError}=await supabase.from('organization_memberships').select('organization_id,role,organizations!inner(organization_type,approval_status)').eq('user_id',user.id).eq('organizations.organization_type','company').limit(1).maybeSingle()
  if(membershipError||!membership?.organization_id){setError('لم نتمكن من تحديد شركة مرتبطة بحسابك.');setLoading(false);return}
  setOrganizationId(membership.organization_id)
  const [{data:planRows,error:planError},{data:subRows,error:subError},{data:payRows,error:payError}]=await Promise.all([
   supabase.from('platform_subscription_plans').select('id,name,slug,description,monthly_price,currency,features,limits,is_popular').eq('is_active',true).order('display_order'),
   supabase.from('company_subscriptions').select('id,plan_name,amount_egp,status,payment_status,payment_reference,payment_transfer_date,starts_at,ends_at,created_at').eq('organization_id',membership.organization_id).order('created_at',{ascending:false}),
   supabase.rpc('get_public_payment_details')
  ])
  if(planError)setError('تعذر تحميل الباقات: '+planError.message)
  else {setPlans((planRows||[]) as Plan[]);if(planRows?.length)setSelected(planRows[0].id)}
  if(subError)setError('تعذر تحميل سجل الاشتراكات: '+subError.message)
  else setHistory((subRows||[]) as Subscription[])
  if(!payError&&payRows){const d=Array.isArray(payRows)?payRows[0]:payRows;setPayment((d||{}) as PaymentDetails)}
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 const current=history.find(s=>s.status==='active'&&s.payment_status==='verified'&&s.ends_at&&new Date(s.ends_at)>new Date())
 const pending=history.find(s=>s.status==='pending'&&(s.payment_status==='submitted'||s.payment_status==='pending'))
 const chosen=useMemo(()=>plans.find(p=>p.id===selected),[plans,selected])
 async function previewCoupon(){
  if(!supabase||!chosen||!couponCode.trim())return
  setCouponLoading(true);setError('');setCouponPreview(null)
  const {data,error:previewError}=await supabase.rpc('preview_discount_code',{p_code:couponCode.trim().toUpperCase(),p_service:'company_subscription',p_reference_id:chosen.id,p_period:'monthly'})
  setCouponLoading(false)
  if(previewError){setError(previewError.message||'كود الخصم غير صالح أو لا ينطبق على هذه الباقة.');return}
  setCouponPreview(data as CouponPreview)
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(!supabase||!organizationId||!chosen||saving)return
  const clean=reference.trim()
  if(clean.length<3||clean.length>100){setError('أدخل رقم عملية تحويل صحيحًا.');return}
  if(!transferDate){setError('حدد تاريخ التحويل.');return}
  if(couponCode.trim()&&!couponPreview){setError('تحقق من كود الخصم أولًا أو احذف الكود قبل إرسال الطلب.');return}
  if(pending){setError('لديك طلب اشتراك قيد المراجعة بالفعل.');return}
  setSaving(true);setError('');setNotice('')
  const {data:{user}}=await supabase.auth.getUser()
  const {error:insertError}=await supabase.from('company_subscriptions').insert({
   organization_id:organizationId,plan_id:chosen.id,plan_name:chosen.name,billing_cycle:'monthly',
   amount_egp:Number(couponPreview?.final_amount_egp??chosen.monthly_price),status:'pending',payment_status:'submitted',
   coupon_code:couponPreview?.code||null,original_amount_egp:Number(chosen.monthly_price),discount_amount_egp:Number(couponPreview?.discount_amount_egp||0),final_amount_egp:Number(couponPreview?.final_amount_egp??chosen.monthly_price),
   payment_reference:clean,payment_transfer_date:transferDate,payment_method:method,payment_submitted_at:new Date().toISOString(),created_by:user?.id
  })
  setSaving(false)
  if(insertError){setError('تعذر إرسال طلب الاشتراك: '+insertError.message);return}
  setNotice('تم إرسال بيانات التحويل بنجاح. ستبدأ مدة الثلاثين يومًا بعد اعتماد الإدارة للدفع.')
  setReference('');setCouponCode('');setCouponPreview(null);await load()
 }
 return <><CompanyPageSidebar active="subscriptions"/><main dir="rtl" className="mc-company-page-with-sidebar min-h-screen bg-[linear-gradient(180deg,#f4f8ff_0%,#f8fbff_42%,#eef4fc_100%)] px-4 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
  <header className="rounded-3xl border border-white bg-white/95 p-5 shadow-sm"><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">اشتراك الشركة والباقات</h1><p className="mt-2 text-sm leading-7 text-slate-500">اختر الباقة المناسبة واستفد من مميزاتها لمدة 30 يومًا من تاريخ اعتماد الدفع. اشتراك المنصة منفصل تمامًا عن أي مبالغ تخص تأجير السيارات.</p></header>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
  {loading?<div className="py-16 text-center text-slate-500">جارٍ تحميل بيانات الاشتراك...</div>:<>
   {current&&<section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2 font-extrabold text-emerald-900"><CheckCircle2/> اشتراكك الحالي: {current.plan_name}</div><p className="mt-2 text-sm text-emerald-900">ينتهي في {new Date(current.ends_at!).toLocaleString('ar-EG')}</p></section>}
   {pending&&<section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-extrabold text-amber-900">طلب الاشتراك قيد المراجعة</p><p className="mt-2 text-sm text-amber-900">الباقة: {pending.plan_name} · {money(pending.amount_egp)}</p><p className="mt-1 text-sm text-amber-900">رقم العملية: {pending.payment_reference||'—'} · تاريخ التحويل: {pending.payment_transfer_date||'—'}</p></section>}
   <section className="mt-6 grid gap-4 lg:grid-cols-3">{plans.map(p=><article key={p.id} className={'rounded-3xl border bg-white p-5 shadow-sm '+(p.is_popular?'border-blue-400 ring-2 ring-blue-100':'border-slate-200')}><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-black">{p.name}</h2>{p.is_popular&&<span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">الأكثر شيوعًا</span>}</div><p className="mt-3 text-2xl font-black text-blue-700">{money(p.monthly_price,p.currency)}<span className="text-sm font-medium text-slate-500"> / 30 يومًا</span></p><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{p.description}</p><ul className="mt-4 space-y-2 text-sm">{(p.features||[]).map((f,i)=><li key={i} className="flex gap-2"><CheckCircle2 size={16} className="shrink-0 text-emerald-600"/>{f}</li>)}</ul><button type="button" disabled={Boolean(pending)} onClick={()=>{setSelected(p.id);setCouponPreview(null)}} className={'mt-5 min-h-11 w-full rounded-xl px-4 font-bold '+(selected===p.id?'bg-blue-700 text-white':'border border-slate-200 text-slate-700')}>{selected===p.id?'تم اختيار الباقة':'اختيار هذه الباقة'}</button></article>)}</section>
   <form onSubmit={e=>void submit(e)} className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><CreditCard/></span><div><h2 className="text-xl font-black">إرسال بيانات التحويل</h2><p className="text-sm text-slate-500">الباقة المختارة: {chosen?.name||'—'} · {chosen?money(couponPreview?.final_amount_egp??chosen.monthly_price,chosen.currency):'—'}</p></div></div>
    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><label className="block text-sm font-extrabold text-slate-800">كود الخصم (اختياري)<input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCouponPreview(null)}} maxLength={40} dir="ltr" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-left" placeholder="MYCAR2026"/></label><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={couponLoading||!couponCode.trim()||!chosen} onClick={()=>void previewCoupon()} className="min-h-10 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white disabled:opacity-50">{couponLoading?"جارٍ التحقق...":"تطبيق كود الخصم"}</button>{couponPreview&&<span className="text-sm font-bold text-emerald-700">تم تطبيق الكود بنجاح</span>}</div>{couponPreview&&<div className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-sm sm:grid-cols-3"><p>السعر الأصلي: <strong>{money(couponPreview.original_amount_egp)}</strong></p><p className="text-emerald-700">الخصم: <strong>{money(couponPreview.discount_amount_egp)}</strong></p><p>المطلوب دفعه: <strong className="text-blue-800">{money(couponPreview.final_amount_egp)}</strong></p></div>}<p className="mt-2 text-xs leading-6 text-slate-500">سيتم التحقق من صلاحية الكود مرة أخرى عند إرسال الطلب، ويُحتسب استخدامه بعد اعتماد الدفع فقط.</p></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">طريقة التحويل<select value={method} onChange={e=>setMethod(e.target.value as 'instapay'|'vodafone')} className="mt-2 min-h-12 w-full rounded-xl border px-3"><option value="instapay">InstaPay</option><option value="vodafone">Vodafone Cash</option></select></label><div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">رقم التحويل الرسمي</p><p dir="ltr" className="mt-1 text-lg font-black tracking-wider">{method==='instapay'?payment.instapay_number||'غير متاح':payment.vodafone_cash_number||'غير متاح'}</p></div>
     <label className="text-sm font-bold sm:col-span-2">رقم العملية / مرجع التحويل<input required minLength={3} maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4" placeholder="أدخل رقم العملية كما يظهر في إيصال التحويل"/></label>
     <label className="text-sm font-bold">تاريخ التحويل<input required type="date" max={new Date().toISOString().slice(0,10)} value={transferDate} onChange={e=>setTransferDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4"/></label>
    </div>
    <div className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm leading-7 text-blue-900"><ShieldCheck className="mt-1 shrink-0"/><p>لا يتم تفعيل أي ميزة مدفوعة قبل مراجعة التحويل واعتماده. مدة الاشتراك 30 يومًا تبدأ من لحظة الاعتماد، وليست من تاريخ إرسال الطلب.</p></div>
    <button disabled={saving||!chosen||Boolean(pending)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-50"><CalendarClock size={18}/>{saving?'جارٍ إرسال الطلب...':'إرسال طلب الاشتراك'}</button>
   </form>
   <section className="mt-6 rounded-3xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-black">سجل الاشتراكات</h2><button type="button" onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>{history.length===0?<p className="py-8 text-center text-sm text-slate-500">لا يوجد سجل اشتراكات حتى الآن.</p>:<div className="mt-4 space-y-3">{history.map(s=><article key={s.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{s.plan_name}</strong><span className="text-sm font-bold">{statusLabel[s.status]||s.status}</span></div><p className="mt-1 text-sm text-slate-500">{money(s.amount_egp)} · {paymentLabel[s.payment_status]||s.payment_status}</p><p className="mt-1 text-xs text-slate-500">تاريخ الطلب: {new Date(s.created_at).toLocaleDateString('ar-EG')} {s.ends_at?'· ينتهي: '+new Date(s.ends_at).toLocaleDateString('ar-EG'):''}</p></article>)}</div>}</section>
  </>}
 </div></main></>
}
