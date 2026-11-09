import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'

type Row={id:string;organization_id:string;plan_name:string;billing_cycle:'monthly'|'yearly';amount_egp:number;original_amount_egp:number|null;discount_amount_egp:number|null;coupon_code:string|null;payment_reference:string|null;payment_transfer_date:string|null;payment_status:string;status:string;created_at:string;organizations:{name:string}|{name:string}[]|null}
export default function AdminCompanySubscriptionsPage(){
 const [rows,setRows]=useState<Row[]>([])
 const [authorized,setAuthorized]=useState(false)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function load(){
  if(!supabase){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user){window.location.replace('/?login=1');return}
  const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
  if(adminError||!admin){setError('هذه الصفحة متاحة لمسؤول المنصة فقط.');setLoading(false);return}
  setAuthorized(true)
  const {data,error:queryError}=await supabase.from('company_subscriptions').select('id,organization_id,plan_name,billing_cycle,amount_egp,original_amount_egp,discount_amount_egp,coupon_code,payment_reference,payment_transfer_date,payment_status,status,created_at,organizations(name)').in('payment_status',['submitted','pending']).order('created_at',{ascending:true})
  if(queryError)setError('تعذر تحميل طلبات الاشتراك: '+queryError.message)
  else setRows((data||[]) as unknown as Row[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 async function review(row:Row,approve:boolean){
  if(!supabase||busy)return
  const duration=row.billing_cycle==='yearly'?'سنة كاملة':'30 يومًا'
  const action=approve?`اعتماد التحويل وتفعيل الباقة لمدة ${duration}؟`:'رفض التحويل وإلغاء طلب الاشتراك؟'
  if(!window.confirm(action))return
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return
  setBusy(row.id);setError('');setNotice('')
  const {error:updateError}=await supabase.from('company_subscriptions').update({
   payment_status:approve?'verified':'rejected',status:approve?'active':'cancelled',
   reviewed_by:user.id,reviewed_at:new Date().toISOString(),
   admin_notes:approve?`تم اعتماد التحويل وتفعيل الاشتراك لمدة ${duration}.`:'تم رفض طلب التحويل.'
  }).eq('id',row.id).eq('payment_status','submitted')
  setBusy('')
  if(updateError){setError('تعذر تنفيذ المراجعة: '+updateError.message);return}
  setNotice(approve?`تم اعتماد الدفع. بدأ الاشتراك لمدة ${duration} من وقت الاعتماد.`:'تم رفض طلب الاشتراك.')
  await load()
 }
 const orgName=(v:Row['organizations'])=>Array.isArray(v)?v[0]?.name||'شركة':v?.name||'شركة'
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6"><div className="mx-auto max-w-6xl"><header className="rounded-3xl border bg-white p-5 shadow-sm"><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">مراجعة اشتراكات الشركات</h1><p className="mt-2 text-sm leading-7 text-slate-500">راجع بيانات التحويل. اعتماد الدفع يفعّل الباقة وفق مدة الفوترة المختارة: 30 يومًا أو سنة كاملة.</p></header><AdminPageNavigation/>
 {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
 <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">طلبات بانتظار المراجعة ({rows.length})</h2><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>
 {loading?<p className="py-10 text-center text-slate-500">جارٍ تحميل الطلبات...</p>:!authorized?null:rows.length===0?<p className="py-10 text-center text-slate-500">لا توجد طلبات اشتراك معلقة.</p>:<div className="mt-4 space-y-3">{rows.map(row=><article key={row.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{orgName(row.organizations)}</h3><p className="mt-1 text-sm text-slate-600">{row.plan_name} · {row.billing_cycle==='yearly'?'اشتراك سنوي':'اشتراك شهري'} · المطلوب: {new Intl.NumberFormat('ar-EG',{style:'currency',currency:'EGP',maximumFractionDigits:0}).format(Number(row.amount_egp)||0)}</p>{Number(row.discount_amount_egp||0)>0&&<p className="mt-1 text-xs font-bold text-emerald-700">كود: <bdi>{row.coupon_code}</bdi> · الأصلي: {Number(row.original_amount_egp||0).toLocaleString('ar-EG')} جنيه · الخصم: {Number(row.discount_amount_egp||0).toLocaleString('ar-EG')} جنيه</p>}</div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">بانتظار المراجعة</span></div><div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3"><p>رقم العملية: <strong dir="ltr">{row.payment_reference||'—'}</strong></p><p>تاريخ التحويل: <strong>{row.payment_transfer_date||'—'}</strong></p><p>تاريخ الطلب: <strong>{new Date(row.created_at).toLocaleDateString('ar-EG')}</strong></p></div><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy===row.id} onClick={()=>void review(row,true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-50"><CheckCircle2 size={17}/>{busy===row.id?'جارٍ التنفيذ...':`اعتماد الدفع وتفعيل ${row.billing_cycle==='yearly'?'سنة كاملة':'30 يومًا'}`}</button><button disabled={busy===row.id} onClick={()=>void review(row,false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 font-bold text-red-700 disabled:opacity-50"><XCircle size={17}/> رفض التحويل</button></div></article>)}</div>}</section></div></main>
}
