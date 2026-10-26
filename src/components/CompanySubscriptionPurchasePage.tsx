import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BadgeCheck, CreditCard, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Plan = { id:string; name:string; description:string; monthly_price:number; yearly_price:number; currency:string; features:string[]; is_popular:boolean }
type Subscription = { id:string; plan_name:string; billing_cycle:'monthly'|'yearly'; amount_egp:number; status:string; payment_status:string; starts_at:string|null; ends_at:string|null; created_at:string }
const money=(v:number,currency='EGP')=>new Intl.NumberFormat('ar-EG',{style:'currency',currency,maximumFractionDigits:2}).format(Number(v)||0)
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('ar-EG'):'—'
const field='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
export default function CompanySubscriptionPurchasePage(){
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState('')
 const [orgId,setOrgId]=useState(''),[orgStatus,setOrgStatus]=useState(''),[plans,setPlans]=useState<Plan[]>([])
 const [rows,setRows]=useState<Subscription[]>([])
 const [vodafone,setVodafone]=useState(''),[instapay,setInstapay]=useState('')
 const [planId,setPlanId]=useState(''),[cycle,setCycle]=useState<'monthly'|'yearly'>('monthly'),[reference,setReference]=useState('')
 async function load(){
  if(!supabase){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:auth,error:authError}=await supabase.auth.getUser()
  if(authError||!auth.user){window.location.replace('/?login=1');return}
  const {data:org,error:orgError}=await supabase.from('organizations').select('id,organization_type,approval_status').eq('created_by',auth.user.id).eq('organization_type','company').maybeSingle()
  if(orgError){setError('تعذر تحميل حساب الشركة: '+orgError.message);setLoading(false);return}
  if(!org){setError('لم نعثر على حساب شركة مرتبط بهذا المستخدم.');setLoading(false);return}
  setOrgId(org.id);setOrgStatus(org.approval_status)
  const [p,s,settings]=await Promise.all([
   supabase.from('platform_subscription_plans').select('id,name,description,monthly_price,yearly_price,currency,features,is_popular').eq('is_active',true).order('display_order'),
   supabase.from('company_subscriptions').select('id,plan_name,billing_cycle,amount_egp,status,payment_status,starts_at,ends_at,created_at').eq('organization_id',org.id).order('created_at',{ascending:false}),
   supabase.from('platform_settings').select('vodafone_cash_number,instapay_number').eq('id',true).maybeSingle()
  ])
  const failed=p.error||s.error||settings.error
  if(failed)setError('تعذر تحميل بيانات الاشتراك: '+failed.message)
  setPlans((p.data||[]) as Plan[]);setRows((s.data||[]) as Subscription[])
  setVodafone(String(settings.data?.vodafone_cash_number||''));setInstapay(String(settings.data?.instapay_number||''))
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||!orgId)return
  const plan=plans.find(p=>p.id===planId)
  if(!plan){setError('اختر باقة اشتراك متاحة.');return}
  if(orgStatus!=='approved'){setError('يجب اعتماد حساب الشركة من الإدارة قبل طلب الاشتراك.');return}
  if(!reference.trim()){setError('أدخل رقم مرجع التحويل بعد إتمامه.');return}
  const amount=Number(cycle==='monthly'?plan.monthly_price:plan.yearly_price)
  if(!Number.isFinite(amount)||amount<=0){setError('سعر هذه الباقة غير مضبوط. تواصل مع الإدارة بدلًا من إرسال طلب بسعر غير صحيح.');return}
  setSaving(true);setError('');setNotice('')
  const {data:auth}=await supabase.auth.getUser()
  const {error:e}=await supabase.from('company_subscriptions').insert({
   organization_id:orgId,plan_id:plan.id,plan_name:plan.name,billing_cycle:cycle,amount_egp:amount,
   status:'pending',payment_status:'submitted',payment_reference:reference.trim(),
   starts_at:null,ends_at:null,created_by:auth.user?.id||null
  })
  setSaving(false)
  if(e){setError('تعذر إرسال طلب الاشتراك: '+e.message);return}
  setNotice('تم إرسال طلب الاشتراك ومرجع التحويل. لن يتفعّل الاشتراك إلا بعد مراجعة الإدارة وتأكيد الدفع.')
  setReference('');await load()
 }
 const active=rows.find(r=>r.status==='active'&&r.payment_status==='verified'&&r.ends_at&&new Date(r.ends_at).getTime()>Date.now())
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6"><div className="mx-auto max-w-5xl">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">اشتراك شركتك في My Car</h1><p className="mt-1 text-sm leading-7 text-slate-500">اختر الباقة الشهرية أو السنوية وأرسل مرجع التحويل للمراجعة الإدارية.</p></div><a href="/workspace/company" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><ArrowRight size={17}/> مساحة الشركة</a></header>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
  {loading?<p className="mt-5 rounded-2xl border bg-white p-6">جارٍ تحميل الباقات...</p>:<>
   {orgStatus!=='approved'&&<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">حساب شركتك ما زال قيد المراجعة. سيصبح طلب الاشتراك متاحًا بعد اعتماد الحساب.</div>}
   {active&&<div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><BadgeCheck className="text-emerald-700"/><div><strong>اشتراك نشط: {active.plan_name}</strong><p className="text-sm">ينتهي في {date(active.ends_at)}.</p></div></div>}
   <section className="mt-5 grid gap-4 md:grid-cols-2">{plans.map(p=><article key={p.id} className={'rounded-2xl border bg-white p-5 '+(p.is_popular?'border-blue-400 ring-1 ring-blue-100':'border-slate-200')}><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-extrabold">{p.name}</h2>{p.is_popular&&<span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">الأكثر تميزًا</span>}</div><p className="mt-2 text-sm leading-6 text-slate-600">{p.description}</p><p className="mt-4 text-sm">شهريًا: <strong>{money(p.monthly_price,p.currency)}</strong></p><p className="mt-1 text-sm">سنويًا: <strong>{money(p.yearly_price,p.currency)}</strong></p>{Array.isArray(p.features)&&p.features.length>0&&<ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">{p.features.map((f,i)=><li key={i}>{f}</li>)}</ul>}</article>)}</section>
   {plans.length===0&&<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">لا توجد باقات اشتراك منشورة حاليًا. يجب على صاحب المنصة إضافة الأسعار الشهرية والسنوية وتفعيل الباقة من لوحة التحكم قبل بدء الاختبارات التجارية.</div>}
   <form onSubmit={e=>void submit(e)} className="mt-5 rounded-2xl border bg-white p-5 sm:p-7"><h2 className="text-lg font-extrabold">طلب اشتراك جديد</h2><p className="mt-1 text-sm leading-6 text-slate-500">لا تتم أي عملية سحب أموال داخل المنصة. أتم التحويل بنفسك إلى وسيلة الدفع التي تعرضها الإدارة ثم أدخل مرجع العملية.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">الباقة *<select required value={planId} onChange={e=>setPlanId(e.target.value)} className={field}><option value="">اختر الباقة</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-sm font-bold">دورة الاشتراك *<select value={cycle} onChange={e=>setCycle(e.target.value as 'monthly'|'yearly')} className={field}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></label>
    <label className="text-sm font-bold sm:col-span-2">مرجع التحويل *<input required minLength={3} maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} className={field} placeholder="رقم العملية كما يظهر في تطبيق الدفع"/></label></div>
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7"><h3 className="font-extrabold">وسائل التحويل</h3>{vodafone&&<p>Vodafone Cash: <strong dir="ltr">{vodafone}</strong></p>}{instapay&&<p>InstaPay: <strong dir="ltr">{instapay}</strong></p>}{!vodafone&&!instapay&&<p className="text-amber-800">لم تُضف الإدارة وسائل تحويل بعد. تواصل مع الدعم قبل الدفع.</p>}<p className="mt-2 text-xs text-slate-600">بعد الإرسال، تراجع الإدارة التحويل وتفعّل الاشتراك يدويًا. مدة الاشتراك تبدأ من وقت الاعتماد.</p></div>
    <button disabled={saving||plans.length===0||orgStatus!=='approved'} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white disabled:opacity-50"><CreditCard size={17}/>{saving?'جارٍ الإرسال...':'إرسال طلب الاشتراك'}</button>
   </form>
   <section className="mt-6 rounded-2xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">سجل الاشتراكات</h2><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>{rows.length===0?<p className="mt-3 text-sm text-slate-500">لا توجد طلبات اشتراك بعد.</p>:<div className="mt-3 space-y-3">{rows.map(r=><article key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{r.plan_name} · {r.billing_cycle==='monthly'?'شهري':'سنوي'}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{r.payment_status==='verified'?'تم تأكيد الدفع':r.payment_status==='rejected'?'مرفوض':r.payment_status==='submitted'?'بانتظار المراجعة':'معلّق'}</span></div><p className="mt-2 text-sm">{money(r.amount_egp)} · تاريخ الطلب: {date(r.created_at)}</p>{r.ends_at&&<p className="mt-1 text-xs text-slate-500">تاريخ الانتهاء: {date(r.ends_at)}</p>}</article>)}</div>}</section>
  </>}
 </div></main>
}
