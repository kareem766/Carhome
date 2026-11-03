import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Users, UserPlus, ShieldCheck, Copy, RefreshCw, Trash2, KeyRound, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type Member = { user_id:string; role:'owner'|'manager'|'member'; created_at:string; email:string|null }
const roleLabel:Record<string,string>={owner:'مالك الشركة',manager:'مدير',member:'موظف'}
const field='mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
const btn='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white disabled:opacity-50'

export default function CompanyTeamPage(){
 const [members,setMembers]=useState<Member[]>([])
 const [myRole,setMyRole]=useState('')
 const [displayName,setDisplayName]=useState('')
 const [email,setEmail]=useState('')
 const [role,setRole]=useState<'member'|'manager'>('member')
 const [temporaryPassword,setTemporaryPassword]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [refresh,setRefresh]=useState(0)

 const load=useCallback(async()=>{
  if(!supabase){setError('تعذر الاتصال بالمنصة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:{user},error:userError}=await supabase.auth.getUser()
  if(userError||!user){window.location.replace('/?login=1');return}
  const {data:membership,error:memberError}=await supabase.from('organization_memberships').select('organization_id,role,organizations!inner(organization_type)').eq('user_id',user.id).eq('organizations.organization_type','company').limit(1).maybeSingle()
  if(memberError||!membership?.organization_id){setError('لم نتمكن من تحديد الشركة المرتبطة بحسابك.');setLoading(false);return}
  setMyRole(membership.role)
  const result=await supabase.rpc('company_list_members')
  if(result.error)setError('تعذر تحميل أعضاء الشركة: '+result.error.message)
  else setMembers((result.data||[]) as Member[])
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load,refresh])

 async function createEmployee(e:FormEvent){
  e.preventDefault();if(!supabase||saving)return
  setSaving(true);setError('');setNotice('');setTemporaryPassword('')
  const {data,error:invokeError}=await supabase.functions.invoke('admin-managed-accounts',{body:{action:'create_company_member',display_name:displayName.trim(),email:email.trim().toLowerCase(),role}})
  if(invokeError||data?.error){setError(data?.error||invokeError?.message||'تعذر إنشاء حساب الموظف.');setSaving(false);return}
  setTemporaryPassword(String(data.temporary_password||''))
  setNotice('تم إنشاء حساب الموظف وربطه بالشركة. انسخ كلمة المرور المؤقتة وشاركها معه؛ لن تظهر مرة أخرى بعد مغادرة هذه الصفحة.')
  setDisplayName('');setEmail('');setRole('member');setSaving(false);setRefresh(v=>v+1)
 }
 async function copyPassword(){
  if(!temporaryPassword)return
  try{await navigator.clipboard.writeText(temporaryPassword);setNotice('تم نسخ كلمة المرور المؤقتة. شاركها مع الموظف عبر قناة آمنة.')}
  catch{setError('تعذر النسخ التلقائي. يمكنك تحديد كلمة المرور ونسخها يدويًا.')}
 }
 async function runRpc(name:string,args:Record<string,unknown>,success:string){
  if(!supabase)return
  setError('');setNotice('')
  const {data,error:rpcError}=await supabase.rpc(name,args)
  if(rpcError){setError(rpcError.message);return}
  if(data===false){setError('لم يتم تنفيذ الإجراء؛ تحقق من صلاحيات الحساب.');return}
  setNotice(success);setRefresh(v=>v+1)
 }
 return <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#f4f8ff_0%,#f8fbff_42%,#eef4fc_100%)] text-slate-900">
  <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(20,55,95,.06)] backdrop-blur-xl">
   <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
    <div className="flex min-w-0 items-center justify-between gap-3">
     <a href="/workspace/company" aria-label="العودة لمساحة الشركة" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 shadow-sm sm:text-sm"><ArrowRight size={17}/> <span>مساحة الشركة</span></a>
     <div className="min-w-0"><PlatformBrand/></div>
    </div>
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0"><span className="hidden text-xs font-bold text-slate-400 sm:inline">حسابك وإشعاراتك</span><AccountNotifications/></div>
   </div>
  </header>
  <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-9">
   <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-l from-[#0b2545] via-[#123b68] to-[#176b9a] px-5 py-7 text-white shadow-[0_22px_55px_-30px_rgba(10,45,85,.55)] sm:px-8 sm:py-9">
    <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full border-[26px] border-cyan-300/10"></div>
    <p className="relative text-sm font-extrabold text-cyan-200">إدارة الفريق</p>
    <h1 className="relative mt-2 text-3xl font-black leading-tight sm:text-4xl">موظفو الشركة وصلاحياتهم</h1>
    <p className="relative mt-3 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">أنشئ حساب الموظف بنفسك، وحدد دوره، وسلّمه كلمة مرور مؤقتة ليغيّرها عند أول دخول.</p>
   </section>
   {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
   {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">{notice}</div>}
   {myRole==='owner'&&<section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
    <form onSubmit={createEmployee} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
     <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserPlus/></span><div><h2 className="font-black">إنشاء حساب موظف</h2><p className="text-xs text-slate-500">لن يحتاج الموظف إلى رابط دعوة أو إنشاء حساب بنفسه.</p></div></div>
     <label className="mt-5 block text-sm font-bold">اسم الموظف<input required minLength={2} maxLength={120} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="الاسم بالكامل" className={field}/></label>
     <label className="mt-4 block text-sm font-bold">البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@company.com" className={field} dir="ltr"/></label>
     <label className="mt-4 block text-sm font-bold">الدور والصلاحيات<select value={role} onChange={e=>setRole(e.target.value as 'member'|'manager')} className={field}><option value="member">موظف</option><option value="manager">مدير</option></select></label>
     <button disabled={saving} className={btn+' mt-5 w-full'}><UserPlus size={17}/>{saving?'جارٍ إنشاء الحساب...':'إنشاء حساب الموظف'}</button>
     {temporaryPassword&&<div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center gap-2 text-sm font-black text-blue-950"><KeyRound size={18}/> كلمة المرور المؤقتة</div>
      <p className="mt-2 text-xs leading-6 text-blue-900">انسخها وشاركها مع الموظف الآن. لن نعرضها مرة أخرى بعد مغادرة الصفحة، وسيُطلب منه تغييرها عند أول تسجيل دخول.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><code dir="ltr" className="min-w-0 flex-1 select-all break-all rounded-xl border border-blue-200 bg-white px-3 py-3 text-center text-base font-black tracking-wider text-slate-900">{temporaryPassword}</code><button type="button" onClick={()=>void copyPassword()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white"><Copy size={16}/> نسخ</button></div>
     </div>}
    </form>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">كيف يعمل الحساب؟</h2><div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
     <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700">1</span><p><b className="text-slate-900">المالك ينشئ الحساب</b><br/>يسجل الاسم والبريد ويختار موظفًا أو مديرًا.</p></div>
     <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700">2</span><p><b className="text-slate-900">الموظف يسجل الدخول</b><br/>باستخدام بريده وكلمة المرور المؤقتة التي استلمها.</p></div>
     <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700">3</span><p><b className="text-slate-900">تأمين الحساب</b><br/>تظهر شاشة ترحيب لأول مرة ويختار الموظف كلمة مرور دائمة قبل الدخول.</p></div>
    </div><div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600"><ShieldCheck size={16} className="mb-1 text-blue-700"/> المالك وحده يستطيع إنشاء حسابات الفريق وتحديد دور المدير. لا تظهر كلمة المرور المؤقتة إلا بعد الإنشاء مباشرة.</div></div>
   </section>}
   {myRole!=='owner'&&myRole!==''&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">إضافة الحسابات وتحديد الأدوار متاحان لمالك الشركة فقط. يمكنك الاطلاع على أعضاء الفريق.</div>}
   <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b p-5"><div className="flex items-center gap-2"><Users className="text-blue-700"/><h2 className="font-black">أعضاء الفريق</h2></div><button onClick={()=>setRefresh(v=>v+1)} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"><RefreshCw size={16}/> تحديث</button></div>
    {loading?<p className="p-8 text-center text-slate-500">جارٍ تحميل الفريق...</p>:members.length===0?<p className="p-8 text-center text-slate-500">لا يوجد أعضاء لعرضهم.</p>:<div className="divide-y">{members.map(m=><div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{(m.email||'م').slice(0,1).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold">{m.email||'عضو فريق'}</p><p className="truncate text-xs text-slate-500">عضو في مساحة الشركة</p></div></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{roleLabel[m.role]||m.role}</span>{myRole==='owner'&&m.role!=='owner'&&<select aria-label="تغيير صلاحية العضو" value={m.role} onChange={e=>void runRpc('company_change_member_role',{p_user_id:m.user_id,p_role:e.target.value},'تم تحديث صلاحية العضو.')} className="min-h-9 rounded-lg border px-2 text-xs"><option value="member">موظف</option><option value="manager">مدير</option></select>}{(myRole==='owner'||(myRole==='manager'&&m.role==='member'))&&m.role!=='owner'&&<button aria-label="إزالة العضو" onClick={()=>{if(window.confirm('هل تريد إزالة هذا العضو من الشركة؟'))void runRpc('company_remove_member',{p_user_id:m.user_id},'تمت إزالة العضو من الشركة.')}} className="grid h-9 w-9 place-items-center rounded-lg border text-red-600"><Trash2 size={16}/></button>}</div></div>)}</div>}
   </section>
   <p className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={16}/> بيانات الدخول تُنشأ من الخادم، ولا يتم تخزين كلمة المرور المؤقتة كنص مكشوف في قاعدة البيانات.</p>
  </div>
 </main>
}
