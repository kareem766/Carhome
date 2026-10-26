import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BadgeCheck, CalendarClock, LoaderCircle, Plus, RefreshCw, Save, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Organization = { id:string; name:string; organization_type:string; approval_status:string }
type Plan = { id:string; name:string; monthly_price:number; yearly_price:number; currency:string; is_active:boolean }
type Subscription = { id:string; organization_id:string; plan_id:string|null; plan_name:string; billing_cycle:'monthly'|'yearly'; amount_egp:number; status:string; payment_status:string; payment_reference:string|null; starts_at:string|null; ends_at:string|null; admin_notes:string|null; created_at:string }
const field='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600'
const label='block text-sm font-bold text-slate-700'
const money=(v:number)=>new Intl.NumberFormat('ar-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(Number(v)||0)
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('ar-EG'):'—'
export default function CompanySubscriptionsPage(){
 const [authorized,setAuthorized]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState('')
 const [rows,setRows]=useState<Subscription[]>([]),[orgs,setOrgs]=useState<Organization[]>([]),[plans,setPlans]=useState<Plan[]>([])
 const [orgId,setOrgId]=useState(''),[planId,setPlanId]=useState(''),[cycle,setCycle]=useState<'monthly'|'yearly'>('monthly'),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[notes,setNotes]=useState('')
 const [filter,setFilter]=useState('all')
 async function load(){
  if(!supabase){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false);return}
  setLoading(true);setError('')
  const [s,o,p]=await Promise.all([
   supabase.from('company_subscriptions').select('*').order('created_at',{ascending:false}).limit(500),
   supabase.from('organizations').select('id,name,organization_type,approval_status').eq('organization_type','company').order('name'),
   supabase.from('platform_subscription_plans').select('id,name,monthly_price,yearly_price,currency,is_active').order('display_order')
  ])
  const failed=s.error||o.error||p.error
  if(failed)setError('تعذر تحميل بيانات الاشتراكات: '+failed.message)
  setRows((s.data||[]) as Subscription[]);setOrgs((o.data||[]) as Organization[]);setPlans((p.data||[]) as Plan[])
  setLoading(false)
 }
 useEffect(()=>{let active=true;async function init(){if(!supabase){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false);return}
  const {data:auth}=await supabase.auth.getUser();if(!auth.user){window.location.replace('/?login=1');return}
  const {data:admin,error:e}=await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
  if(!active)return;if(e||!admin){setError('هذه الصفحة متاحة لصاحب المنصة فقط.');setLoading(false);return}
  setAuthorized(true);await load()
 }void init();return()=>{active=false}},[])
 useEffect(()=>{const p=plans.find(x=>x.id===planId);if(p)setAmount(String(cycle==='monthly'?p.monthly_price:p.yearly_price))},[planId,cycle,plans])
 async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!authorized)return
  const org=orgs.find(x=>x.id===orgId),plan=plans.find(x=>x.id===planId)
  if(!org){setError('اختر الشركة أولًا.');return}
  if(!plan&&!amount.trim()){setError('اختر باقة أو أدخل قيمة الاشتراك.');return}
  const parsed=Number(amount);if(!Number.isFinite(parsed)||parsed<0){setError('قيمة الاشتراك غير صحيحة.');return}
  setSaving(true);setError('');setNotice('')
  const {data:auth}=await supabase.auth.getUser()
  const result=await supabase.from('company_subscriptions').insert({organization_id:orgId,plan_id:plan?.id||null,plan_name:plan?.name||'اشتراك مخصص',billing_cycle:cycle,amount_egp:parsed,status:'pending',payment_status:reference.trim()?'submitted':'pending',payment_reference:reference.trim()||null,admin_notes:notes.trim()||null,created_by:auth.user?.id||null})
  setSaving(false);if(result.error){setError('تعذر إنشاء سجل الاشتراك: '+result.error.message);return}
  setNotice('تم إنشاء سجل الاشتراك. لا يصبح نشطًا قبل تأكيد الدفع.');setOrgId('');setPlanId('');setAmount('');setReference('');setNotes('');await load()
 }
 async function update(row:Subscription, action:'verify'|'reject'|'cancel'){
  if(!supabase)return
  if(action==='verify'&&!row.payment_reference?.trim()){setError('لا يمكن تأكيد الدفع دون رقم مرجعي للتحويل.');return}
  if(action==='verify'&&!window.confirm('هل راجعت التحويل فعليًا وتؤكد استلام رسوم الاشتراك؟'))return
  if(action==='cancel'&&!window.confirm('تأكيد إلغاء الاشتراك؟'))return
  setError('');setNotice('')
  const {data:auth}=await supabase.auth.getUser()
  const now=new Date(),end=new Date(now);if(row.billing_cycle==='monthly')end.setMonth(end.getMonth()+1);else end.setFullYear(end.getFullYear()+1)
  const payload=action==='verify'?{payment_status:'verified',status:'active',starts_at:now.toISOString(),ends_at:end.toISOString(),reviewed_at:now.toISOString(),reviewed_by:auth.user?.id||null,updated_at:now.toISOString()}
   :action==='reject'?{payment_status:'rejected',status:'pending',reviewed_at:now.toISOString(),reviewed_by:auth.user?.id||null,updated_at:now.toISOString()}
   :{status:'cancelled',updated_at:now.toISOString()}
  const {error:e}=await supabase.from('company_subscriptions').update(payload).eq('id',row.id)
  if(e){setError('تعذر تحديث الاشتراك: '+e.message);return}
  setNotice(action==='verify'?'تم تأكيد الدفع وتفعيل الاشتراك وبدء مدته من الآن.':action==='reject'?'تم رفض إثبات الدفع.':'تم إلغاء الاشتراك.')
  await load()
 }
 const visible=rows.filter(r=>filter==='all'||(filter==='pending'&&r.payment_status!=='verified'&&r.status!=='cancelled')||(filter==='active'&&r.status==='active')||(filter==='expired'&&['expired','cancelled'].includes(r.status)))
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6"><div className="mx-auto max-w-7xl">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">إدارة اشتراكات الشركات</h1><p className="mt-1 text-sm leading-6 text-slate-500">إنشاء سجلات الاشتراك ومتابعة التحويلات وتفعيل المدة بعد مراجعة الدفع فقط.</p></div><a href="/workspace/admin/dashboard" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><ArrowRight size={17}/> لوحة التحكم</a></header>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm">{notice}</p>}
  {authorized&&<form onSubmit={e=>void create(e)} className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-lg font-extrabold">تسجيل اشتراك جديد</h2><p className="mt-1 text-sm text-slate-500">هذا يسجل الاشتراك يدويًا للإدارة ولا يسحب أموالًا ولا يفعّل الاشتراك تلقائيًا.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   <label className={label}>الشركة *<select required value={orgId} onChange={e=>setOrgId(e.target.value)} className={field}><option value="">اختر الشركة</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name} — {o.approval_status}</option>)}</select></label>
   <label className={label}>باقة الاشتراك<select value={planId} onChange={e=>setPlanId(e.target.value)} className={field}><option value="">اشتراك مخصص</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}{!p.is_active?' (موقوفة)':''}</option>)}</select></label>
   <label className={label}>دورة الفوترة<select value={cycle} onChange={e=>setCycle(e.target.value as 'monthly'|'yearly')} className={field}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></label>
   <label className={label}>قيمة الاشتراك بالجنيه *<input required type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={field}/></label>
   <label className={label}>مرجع التحويل (إن وجد)<input maxLength={200} value={reference} onChange={e=>setReference(e.target.value)} className={field} placeholder="رقم العملية أو مرجع التحويل"/></label>
   <label className={label}>ملاحظات الإدارة<input maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} className={field}/></label>
  </div><div className="mt-4 flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50"><Plus size={17}/>{saving?'جارٍ الحفظ...':'إنشاء سجل الاشتراك'}</button></div></form>}
  <section className="mt-6 rounded-2xl border bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">سجلات الاشتراك ({visible.length})</h2><div className="flex gap-2"><select aria-label="تصفية الاشتراكات" value={filter} onChange={e=>setFilter(e.target.value)} className={field+' mt-0 w-auto'}><option value="all">كل الاشتراكات</option><option value="pending">تنتظر الدفع/المراجعة</option><option value="active">نشطة</option><option value="expired">منتهية/ملغاة</option></select><button onClick={()=>void load()} type="button" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div></div>
   {loading?<div className="flex justify-center py-10 text-slate-500"><LoaderCircle className="animate-spin"/> جارٍ التحميل...</div>:visible.length===0?<div className="py-12 text-center text-sm text-slate-500">لا توجد سجلات في هذا التصنيف. لا يتم إنشاء بيانات تجريبية تلقائيًا.</div>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{visible.map(r=><article key={r.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{orgs.find(o=>o.id===r.organization_id)?.name||'شركة غير معروفة'}</h3><p className="mt-1 text-sm text-slate-500">{r.plan_name} · {r.billing_cycle==='monthly'?'شهري':'سنوي'}</p></div><span className={'rounded-full px-3 py-1 text-xs font-bold '+(r.status==='active'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-800')}>{r.status==='active'?'نشط':r.status==='cancelled'?'ملغي':r.status==='expired'?'منتهي':'معلق'}</span></div><p className="mt-3 text-xl font-black text-blue-700">{money(r.amount_egp)}</p><p className="mt-1 text-xs text-slate-500">الدفع: {r.payment_status==='verified'?'مؤكد':r.payment_status==='submitted'?'تم تقديم المرجع':r.payment_status==='rejected'?'مرفوض':r.payment_status==='waived'?'معفى':'بانتظار الدفع'} · البداية: {date(r.starts_at)} · النهاية: {date(r.ends_at)}</p>{r.payment_reference&&<p className="mt-2 break-words text-sm">مرجع التحويل: {r.payment_reference}</p>}{r.admin_notes&&<p className="mt-2 text-sm text-slate-600">ملاحظات: {r.admin_notes}</p>}
   {r.status!=='cancelled'&&r.status!=='expired'&&<div className="mt-4 flex flex-wrap gap-2">{r.payment_status!=='verified'&&<button onClick={()=>void update(r,'verify')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><BadgeCheck size={15}/> تأكيد الدفع وتفعيل الاشتراك</button>}{r.payment_status!=='rejected'&&r.payment_status!=='verified'&&<button onClick={()=>void update(r,'reject')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><XCircle size={15}/> رفض الدفع</button>}<button onClick={()=>void update(r,'cancel')} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><CalendarClock size={15}/> إلغاء الاشتراك</button></div>}</article>)}</div>}
  </section>
  <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-900">مهم: التفعيل هنا يسجل حالة الاشتراك ومدته فقط. ربط صلاحيات المنتج تلقائيًا بالاشتراك، وتجديد الاشتراك من واجهة الشركة، واستقبال إيصالات الدفع من العميل ما زالت تحتاج تكاملًا منفصلًا قبل اعتبار الفوترة آلية بالكامل.</p>
 </div></main>
}
