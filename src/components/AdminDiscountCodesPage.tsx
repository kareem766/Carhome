import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Plus, RefreshCw, Save, TicketPercent, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'

type DiscountCode={id:string;code:string;name:string;discount_type:'percent'|'fixed';discount_value:number;max_discount_egp:number|null;min_order_egp:number;services:string[];target_roles:string[];starts_at:string;expires_at:string|null;max_redemptions:number|null;max_per_user:number;new_customers_only:boolean;is_active:boolean;created_at:string}
type Redemption={id:string;code:string;service:string;original_amount_egp:number;discount_amount_egp:number;final_amount_egp:number;status:string;created_at:string}
type Draft={code:string;name:string;discount_type:'percent'|'fixed';discount_value:number;max_discount_egp:string;min_order_egp:number;starts_at:string;expires_at:string;max_redemptions:string;max_per_user:number;new_customers_only:boolean;is_active:boolean}
const blank:Draft={code:'',name:'',discount_type:'percent',discount_value:10,max_discount_egp:'',min_order_egp:0,starts_at:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),expires_at:'',max_redemptions:'',max_per_user:1,new_customers_only:false,is_active:true}
const field='mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-600'
const money=(n:number)=>new Intl.NumberFormat('ar-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(Number(n)||0)
export default function AdminDiscountCodesPage(){
 const [rows,setRows]=useState<DiscountCode[]>([])
 const [redemptions,setRedemptions]=useState<Redemption[]>([])
 const [counts,setCounts]=useState<Record<string,number>>({})
 const [draft,setDraft]=useState<Draft>(blank)
 const [editing,setEditing]=useState('')
 const [authorized,setAuthorized]=useState(false)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
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
  const [{data:codes,error:codesError},{data:uses,error:usesError}]=await Promise.all([
   supabase.from('discount_codes').select('*').contains('services',['company_subscription']).order('created_at',{ascending:false}),
   supabase.from('discount_code_redemptions').select('id,code,service,original_amount_egp,discount_amount_egp,final_amount_egp,status,created_at,discount_code_id').eq('service','company_subscription').order('created_at',{ascending:false}).limit(50)
  ])
  if(codesError)setError('تعذر تحميل أكواد الخصم: '+codesError.message)
  else setRows((codes||[]) as DiscountCode[])
  if(usesError)setError(v=>v||'تعذر تحميل سجل استخدام الأكواد: '+usesError.message)
  else{
   const list=(uses||[]) as (Redemption&{discount_code_id:string})[]
   setRedemptions(list)
   setCounts(list.reduce((acc,row)=>({...acc,[row.discount_code_id]:(acc[row.discount_code_id]||0)+1}),{}))
  }
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 function edit(row:DiscountCode){
  setEditing(row.id);setDraft({code:row.code,name:row.name,discount_type:row.discount_type,discount_value:Number(row.discount_value),max_discount_egp:row.max_discount_egp==null?'':String(row.max_discount_egp),min_order_egp:Number(row.min_order_egp),starts_at:new Date(new Date(row.starts_at).getTime()-new Date(row.starts_at).getTimezoneOffset()*60000).toISOString().slice(0,16),expires_at:row.expires_at?new Date(new Date(row.expires_at).getTime()-new Date(row.expires_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'',max_redemptions:row.max_redemptions==null?'':String(row.max_redemptions),max_per_user:row.max_per_user,new_customers_only:row.new_customers_only,is_active:row.is_active})
  setError('');setNotice('');window.scrollTo({top:0,behavior:'smooth'})
 }
 async function save(e:FormEvent){
  e.preventDefault();if(!supabase||!authorized||saving)return
  const code=draft.code.trim().toUpperCase()
  if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)){setError('الكود يجب أن يحتوي على 3 إلى 40 حرفًا إنجليزيًا أو أرقامًا أو شرطة.');return}
  if(draft.discount_value<=0||(draft.discount_type==='percent'&&draft.discount_value>=100)){setError('قيمة الخصم غير صحيحة. النسبة يجب أن تكون أقل من 100%.');return}
  if(draft.expires_at&&new Date(draft.expires_at)<=new Date(draft.starts_at)){setError('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.');return}
  setSaving(true);setError('');setNotice('')
  const {data:{user}}=await supabase.auth.getUser()
  const payload={code,name:draft.name.trim(),discount_type:draft.discount_type,discount_value:Number(draft.discount_value),max_discount_egp:draft.max_discount_egp===''?null:Number(draft.max_discount_egp),min_order_egp:Number(draft.min_order_egp),services:['company_subscription'],target_roles:['company'],starts_at:new Date(draft.starts_at).toISOString(),expires_at:draft.expires_at?new Date(draft.expires_at).toISOString():null,max_redemptions:draft.max_redemptions===''?null:Number(draft.max_redemptions),max_per_user:Number(draft.max_per_user),new_customers_only:draft.new_customers_only,is_active:draft.is_active,created_by:user?.id,updated_at:new Date().toISOString()}
  const result=editing?await supabase.from('discount_codes').update(payload).eq('id',editing):await supabase.from('discount_codes').insert(payload)
  setSaving(false)
  if(result.error){setError('تعذر حفظ الكود: '+result.error.message);return}
  setNotice(editing?'تم تحديث كود الخصم.':'تم إنشاء كود الخصم بنجاح.')
  setDraft(blank);setEditing('');await load()
 }
 async function toggle(row:DiscountCode){
  if(!supabase)return
  const {error:e}=await supabase.from('discount_codes').update({is_active:!row.is_active,updated_at:new Date().toISOString()}).eq('id',row.id)
  if(e){setError('تعذر تحديث حالة الكود: '+e.message);return}
  setNotice(row.is_active?'تم إيقاف الكود.':'تم تفعيل الكود.')
  await load()
 }
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6"><div className="mx-auto max-w-6xl">
  <header className="rounded-3xl border bg-white p-5 shadow-sm"><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">إدارة أكواد الخصم والبروموكود</h1><p className="mt-2 text-sm leading-7 text-slate-500">أنشئ أكوادًا مخصصة لاشتراكات الشركات، وحدد نسبة أو قيمة الخصم، وفترة الصلاحية وعدد مرات الاستخدام.</p></header><AdminPageNavigation/>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
  {authorized&&<form onSubmit={e=>void save(e)} className="mt-5 rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
   <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><TicketPercent/></span><div><h2 className="font-black">{editing?'تعديل كود الخصم':'إنشاء بروموكود جديد'}</h2><p className="text-xs text-slate-500">الأكواد هنا مخصصة لاشتراكات الشركات فقط.</p></div></div>{editing&&<button type="button" onClick={()=>{setEditing('');setDraft(blank)}} className="rounded-lg border px-3 py-2 text-sm font-bold">كود جديد</button>}</div>
   <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-sm font-bold">الكود *<input required value={draft.code} onChange={e=>setDraft(v=>({...v,code:e.target.value.toUpperCase()}))} maxLength={40} dir="ltr" className={field}/></label>
    <label className="text-sm font-bold">اسم الحملة *<input required value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} maxLength={120} className={field}/></label>
    <label className="text-sm font-bold">نوع الخصم<select value={draft.discount_type} onChange={e=>setDraft(v=>({...v,discount_type:e.target.value as 'percent'|'fixed'}))} className={field}><option value="percent">نسبة مئوية %</option><option value="fixed">مبلغ ثابت بالجنيه</option></select></label>
    <label className="text-sm font-bold">قيمة الخصم *<input required type="number" min="0.01" step="0.01" value={draft.discount_value} onChange={e=>setDraft(v=>({...v,discount_value:Number(e.target.value)}))} className={field}/></label>
    <label className="text-sm font-bold">الحد الأقصى للخصم (اختياري)<input type="number" min="0.01" step="0.01" value={draft.max_discount_egp} onChange={e=>setDraft(v=>({...v,max_discount_egp:e.target.value}))} className={field} placeholder="بدون حد أقصى"/></label>
    <label className="text-sm font-bold">الحد الأدنى لقيمة الاشتراك<input type="number" min="0" step="0.01" value={draft.min_order_egp} onChange={e=>setDraft(v=>({...v,min_order_egp:Number(e.target.value)}))} className={field}/></label>
    <label className="text-sm font-bold">يبدأ في *<input required type="datetime-local" value={draft.starts_at} onChange={e=>setDraft(v=>({...v,starts_at:e.target.value}))} className={field}/></label>
    <label className="text-sm font-bold">ينتهي في (اختياري)<input type="datetime-local" value={draft.expires_at} onChange={e=>setDraft(v=>({...v,expires_at:e.target.value}))} className={field}/></label>
    <label className="text-sm font-bold">إجمالي مرات الاستخدام<input type="number" min="1" value={draft.max_redemptions} onChange={e=>setDraft(v=>({...v,max_redemptions:e.target.value}))} className={field} placeholder="غير محدود"/></label>
    <label className="text-sm font-bold">مرات الاستخدام لكل حساب<input required type="number" min="1" value={draft.max_per_user} onChange={e=>setDraft(v=>({...v,max_per_user:Number(e.target.value)}))} className={field}/></label>
    <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-bold"><input type="checkbox" checked={draft.new_customers_only} onChange={e=>setDraft(v=>({...v,new_customers_only:e.target.checked}))}/> للعملاء الجدد فقط</label>
    <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-bold"><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft(v=>({...v,is_active:e.target.checked}))}/> الكود مفعل</label>
   </div>
   <button disabled={saving} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-50"><Save size={17}/>{saving?'جارٍ الحفظ...':editing?'حفظ التعديلات':'إنشاء البروموكود'}</button>
  </form>}
  <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-black">أكواد اشتراكات الشركات ({rows.length})</h2><button onClick={()=>void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>
   {loading?<p className="py-8 text-center text-slate-500">جارٍ تحميل الأكواد...</p>:rows.length===0?<p className="py-8 text-center text-slate-500">لا توجد أكواد مخصصة لاشتراكات الشركات.</p>:<div className="mt-4 grid gap-3 md:grid-cols-2">{rows.map(row=><article key={row.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><strong dir="ltr" className="text-lg tracking-wider">{row.code}</strong><p className="mt-1 text-sm text-slate-500">{row.name}</p></div><span className={'rounded-full px-3 py-1 text-xs font-bold '+(row.is_active?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600')}>{row.is_active?'مفعل':'متوقف'}</span></div><p className="mt-3 text-sm font-bold text-blue-800">{row.discount_type==='percent'?row.discount_value+'%':money(row.discount_value)} خصم</p><p className="mt-1 text-xs text-slate-500">يبدأ: {new Date(row.starts_at).toLocaleString('ar-EG')} · {row.expires_at?'ينتهي: '+new Date(row.expires_at).toLocaleString('ar-EG'):'بدون تاريخ انتهاء'}</p><p className="mt-1 text-xs text-slate-500">عدد مرات الاستخدام المسجلة: {counts[row.id]||0} · لكل حساب: {row.max_per_user}</p><div className="mt-3 flex gap-2"><button onClick={()=>edit(row)} className="min-h-10 flex-1 rounded-xl border text-sm font-bold">تعديل</button><button onClick={()=>void toggle(row)} className="min-h-10 rounded-xl border px-3 text-sm font-bold">{row.is_active?'إيقاف':'تفعيل'}</button></div></article>)}</div>}
  </section>
  <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-black">آخر استخدامات البروموكود</h2>{redemptions.length===0?<p className="py-6 text-center text-sm text-slate-500">لا توجد عمليات استخدام بعد.</p>:<div className="mt-3 divide-y">{redemptions.slice(0,20).map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong dir="ltr">{row.code}</strong><p className="mt-1 text-xs text-slate-500">{new Date(row.created_at).toLocaleString('ar-EG')} · {row.status==='confirmed'?'تم اعتماد الخصم':row.status==='pending'?'بانتظار اعتماد الدفع':'ملغي'}</p></div><div className="text-left"><p>الأصلي: {money(row.original_amount_egp)}</p><p className="text-emerald-700">الخصم: {money(row.discount_amount_egp)} · النهائي: {money(row.final_amount_egp)}</p></div></div>)}</div>}</section>
 </div></main>
}
