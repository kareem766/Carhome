import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Users, UserPlus, ShieldCheck, Copy, RefreshCw, Trash2, Mail, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type Member = { user_id:string; role:'owner'|'manager'|'member'; created_at:string; profiles:{display_name:string;contact_email:string|null}|null }
type Invite = { id:string; email:string; role:'manager'|'member'; status:string; created_at:string; expires_at:string }

const roleLabel:Record<string,string>={owner:'مالك الشركة',manager:'مدير',member:'موظف'}
const field='mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
const btn='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white disabled:opacity-50'

export default function CompanyTeamPage(){
 const [members,setMembers]=useState<Member[]>([])
 const [invites,setInvites]=useState<Invite[]>([])
 const [orgId,setOrgId]=useState('')
 const [myRole,setMyRole]=useState('')
 const [email,setEmail]=useState('')
 const [role,setRole]=useState<'member'|'manager'>('member')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [inviteUrl,setInviteUrl]=useState('')
 const [refresh,setRefresh]=useState(0)

 const load=useCallback(async()=>{
  if(!supabase){setError('تعذر الاتصال بالمنصة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:{user},error:userError}=await supabase.auth.getUser()
  if(userError||!user){window.location.replace('/?login=1');return}
  const {data:membership,error:memberError}=await supabase.from('organization_memberships').select('organization_id,role,organizations!inner(organization_type)').eq('user_id',user.id).eq('organizations.organization_type','company').limit(1).maybeSingle()
  if(memberError||!membership?.organization_id){setError('لم نتمكن من تحديد الشركة المرتبطة بحسابك.');setLoading(false);return}
  setOrgId(membership.organization_id);setMyRole(membership.role)
  const [membersResult,invitesResult]=await Promise.all([
   supabase.from('organization_memberships').select('user_id,role,created_at,profiles(display_name,contact_email)').eq('organization_id',membership.organization_id).order('created_at'),
   supabase.from('organization_invitations').select('id,email,role,status,created_at,expires_at').eq('organization_id',membership.organization_id).order('created_at',{ascending:false})
  ])
  if(membersResult.error)setError('تعذر تحميل أعضاء الشركة: '+membersResult.error.message)
  else setMembers((membersResult.data||[]) as unknown as Member[])
  if(invitesResult.error)setError(v=>v||'تعذر تحميل الدعوات: '+invitesResult.error!.message)
  else setInvites((invitesResult.data||[]) as Invite[])
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load,refresh])

 async function invite(e:FormEvent){
  e.preventDefault();if(!supabase)return
  setSaving(true);setError('');setNotice('');setInviteUrl('')
  const {data,error:rpcError}=await supabase.rpc('company_invite_member',{p_email:email.trim().toLowerCase(),p_role:role})
  if(rpcError){setError(rpcError.message);setSaving(false);return}
  const url=new URL('/workspace/company/team',window.location.origin);url.searchParams.set('invitation',String(data))
  setInviteUrl(url.toString());setNotice('تم إنشاء الدعوة. شارك الرابط مع الموظف، ويجب أن يسجل أو يدخل بالبريد نفسه.')
  setEmail('');setSaving(false);setRefresh(v=>v+1)
 }
 async function runRpc(name:string,args:Record<string,unknown>,success:string){
  if(!supabase)return
  setError('');setNotice('')
  const {error:rpcError}=await supabase.rpc(name,args)
  if(rpcError){setError(rpcError.message);return}
  setNotice(success);setRefresh(v=>v+1)
 }
 async function accept(id:string){
  if(!supabase)return
  setSaving(true);await runRpc('company_accept_invitation',{p_invitation_id:id},'تم قبول الدعوة وإضافتك إلى الشركة بنجاح.');setSaving(false)
  const url=new URL(window.location.href);url.searchParams.delete('invitation');window.history.replaceState({},'',url.toString())
 }
 async function copy(){if(inviteUrl){await navigator.clipboard.writeText(inviteUrl);setNotice('تم نسخ رابط الدعوة.')}}
 const incomingId=new URLSearchParams(window.location.search).get('invitation')
 const incoming=invites.find(i=>i.id===incomingId&&i.status==='pending')
 return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
  <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3"><a href="/workspace/company" className="flex items-center gap-2 text-sm font-extrabold text-slate-700"><ArrowRight size={18}/> مساحة الشركة</a><div className="flex items-center gap-3"><PlatformBrand/><AccountNotifications/></div></div></header>
  <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
   <div><p className="text-sm font-bold text-blue-700">إدارة الفريق</p><h1 className="mt-1 text-3xl font-black">موظفو الشركة وصلاحياتهم</h1><p className="mt-2 text-sm text-slate-500">أضف أعضاء فريقك وحدد صلاحياتهم داخل مساحة الشركة.</p></div>
   {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
   {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
   {incomingId&&!incoming&&<section className="rounded-2xl border bg-white p-5"><p className="font-bold">جارٍ التحقق من الدعوة أو أنها غير متاحة لهذا الحساب.</p><p className="mt-2 text-sm text-slate-500">تأكد من تسجيل الدخول بالبريد الإلكتروني الذي استقبل الدعوة وأنها لم تنتهِ أو تُلغَ.</p></section>}
   {incoming&&<section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-black">لديك دعوة للانضمام إلى فريق شركة</h2><p className="mt-2 text-sm">البريد: {incoming.email} · الصلاحية: {roleLabel[incoming.role]}</p><button className={btn+' mt-4'} disabled={saving} onClick={()=>void accept(incoming.id)}>قبول الدعوة والانضمام</button></section>}
   {myRole==='owner'||myRole==='manager'?<section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
    <form onSubmit={invite} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserPlus/></span><div><h2 className="font-black">دعوة موظف جديد</h2><p className="text-xs text-slate-500">الدعوة مرتبطة بالبريد الإلكتروني المحدد وتنتهي خلال 7 أيام.</p></div></div><label className="mt-5 block text-sm font-bold">البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@company.com" className={field}/></label><label className="mt-4 block text-sm font-bold">الصلاحية<select value={role} onChange={e=>setRole(e.target.value as 'member'|'manager')} className={field}><option value="member">موظف</option>{myRole==='owner'&&<option value="manager">مدير</option>}</select></label><button disabled={saving} className={btn+' mt-5 w-full'}><Mail size={17}/>{saving?'جارٍ إنشاء الدعوة...':'إنشاء رابط الدعوة'}</button>{inviteUrl&&<div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="break-all text-xs text-slate-600">{inviteUrl}</p><button type="button" onClick={()=>void copy()} className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700"><Copy size={16}/> نسخ الرابط</button></div>}</form>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">قواعد الصلاحيات</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600"><li><b className="text-slate-900">مالك الشركة:</b> إدارة الفريق وتعيين المديرين والموظفين.</li><li><b className="text-slate-900">المدير:</b> دعوة الموظفين وإزالة الموظف، دون ترقية مدير أو تعديل صلاحياته.</li><li><b className="text-slate-900">الموظف:</b> استخدام مساحة الشركة وفق صلاحيات العضوية.</li><li>لا يمكن إزالة مالك الشركة أو تغيير دوره.</li></ul></div>
   </section>:null}
   <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div className="flex items-center gap-2"><Users className="text-blue-700"/><h2 className="font-black">أعضاء الفريق</h2></div><button onClick={()=>setRefresh(v=>v+1)} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"><RefreshCw size={16}/> تحديث</button></div>{loading?<p className="p-8 text-center text-slate-500">جارٍ تحميل الفريق...</p>:members.length===0?<p className="p-8 text-center text-slate-500">لا يوجد أعضاء لعرضهم.</p>:<div className="divide-y">{members.map(m=><div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{(m.profiles?.display_name||'ع').slice(0,1)}</span><div className="min-w-0"><p className="truncate font-bold">{m.profiles?.display_name||'عضو فريق'}</p><p className="truncate text-xs text-slate-500">{m.profiles?.contact_email||'البريد غير متاح في الملف الشخصي'}</p></div></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{roleLabel[m.role]||m.role}</span>{myRole==='owner'&&m.role!=='owner'&&<select aria-label="تغيير صلاحية العضو" value={m.role} onChange={e=>void runRpc('company_change_member_role',{p_user_id:m.user_id,p_role:e.target.value},'تم تحديث صلاحية العضو.')} className="min-h-9 rounded-lg border px-2 text-xs"><option value="member">موظف</option><option value="manager">مدير</option></select>}{(myRole==='owner'||(myRole==='manager'&&m.role==='member'))&&m.role!=='owner'&&<button aria-label="إزالة العضو" onClick={()=>{if(window.confirm('هل تريد إزالة هذا العضو من الشركة؟'))void runRpc('company_remove_member',{p_user_id:m.user_id},'تمت إزالة العضو من الشركة.')}} className="grid h-9 w-9 place-items-center rounded-lg border text-red-600"><Trash2 size={16}/></button>}</div></div>)}</div>}</section>
   <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b p-5"><Clock3 className="text-blue-700"/><h2 className="font-black">الدعوات</h2></div>{invites.length===0?<p className="p-8 text-center text-sm text-slate-500">لا توجد دعوات حتى الآن.</p>:<div className="divide-y">{invites.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-bold">{i.email}</p><p className="mt-1 text-xs text-slate-500">{roleLabel[i.role]} · تنتهي {new Date(i.expires_at).toLocaleDateString('ar-EG')}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{i.status==='pending'?'بانتظار القبول':i.status==='accepted'?'مقبولة':i.status==='revoked'?'ملغاة':'منتهية'}</span>{i.status==='pending'&&(myRole==='owner'||myRole==='manager')&&<button onClick={()=>void runRpc('company_revoke_invitation',{p_invitation_id:i.id},'تم إلغاء الدعوة.')} className="text-xs font-bold text-red-600">إلغاء</button>}</div></div>)}</div>}</section>
   <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={16}/> الدعوات مرتبطة بالبريد ولا يمكن قبولها من حساب آخر. إدارة الصلاحيات تتم من قاعدة البيانات بصلاحيات مقيدة.</p>
  </div>
 </main>
}
