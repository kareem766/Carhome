import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BellRing, CalendarDays, CarFront, CheckCircle2, Clock3, MapPin, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import SupplierNavigation from './SupplierNavigation'

type Row = Record<string, any>
const money = (value:any) => value == null ? 'غير محدد' : Number(value).toLocaleString('ar-EG')+' ج.م'
const statusLabel:Record<string,string>={sent:'دعوة جديدة',viewed:'تمت المشاهدة',responded:'تم تقديم العرض',expired:'انتهت الدعوة',withdrawn:'تم إلغاء الدعوة'}

export default function ManagedSourcingInvitationsPage(){
 const [organizationType,setOrganizationType]=useState('')
 const [invites,setInvites]=useState<Row[]>([])
 const [vehicles,setVehicles]=useState<Record<string,Row>>({})
 const [activeInvite,setActiveInvite]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState('')
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')

 const load=useCallback(async()=>{
  if(!supabase){window.location.replace('/?login=1');return}
  setLoading(true);setError('')
  const {data:{user:u},error:authError}=await supabase.auth.getUser()
  if(authError||!u){window.location.replace('/?login=1');return}
  const {data:members,error:memberError}=await supabase.from('organization_memberships').select('organization_id,organizations!inner(organization_type)').eq('user_id',u.id)
  if(memberError){setError(memberError.message);setLoading(false);return}
  const member=(members||[]).find((m:any)=>['individual_owner','fleet_supplier'].includes((Array.isArray(m.organizations)?m.organizations[0]:m.organizations)?.organization_type))
  const org=Array.isArray(member?.organizations)?member?.organizations[0]:member?.organizations
  if(!member||!org){setError('هذه الصفحة متاحة لملاك السيارات وموردي الأساطيل فقط.');setLoading(false);return}
  setOrganizationType(org.organization_type)
  const {data:rows,error:inviteError}=await supabase.from('managed_sourcing_invites').select('*').eq('user_id',u.id).order('sent_at',{ascending:false})
  if(inviteError){setError(inviteError.message);setLoading(false);return}
  const list=(rows||[]) as Row[]
  setInvites(list)
  const ids=[...new Set(list.map(x=>x.vehicle_id).filter(Boolean))]
  if(ids.length){
   const {data:cars}=await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,yearly_price_egp,seats,with_driver').in('id',ids)
   setVehicles(Object.fromEntries((cars||[]).map((v:any)=>[v.id,v])))
  }else setVehicles({})
  setLoading(false)
 },[])

 useEffect(()=>{void load()},[load])
 const openCount=useMemo(()=>invites.filter(x=>['sent','viewed'].includes(x.status)).length,[invites])
 async function viewInvite(invite:Row){
  setActiveInvite(activeInvite===invite.id?'':invite.id)
  if(invite.status==='sent'&&supabase){
   const {error:e}=await supabase.rpc('mark_managed_sourcing_invite_viewed',{p_invite_id:invite.id})
   if(!e)setInvites(old=>old.map(x=>x.id===invite.id?{...x,status:'viewed',viewed_at:new Date().toISOString()}:x))
  }
 }
 async function submitOffer(e:FormEvent<HTMLFormElement>,invite:Row){
  e.preventDefault();if(!supabase)return
  const f=new FormData(e.currentTarget)
  const monthly=Number(f.get('monthly_price')),yearly=String(f.get('yearly_price')||'').trim()
  if(!Number.isFinite(monthly)||monthly<0){setError('أدخل سعرًا شهريًا صحيحًا.');return}
  setSaving(invite.id);setError('');setNotice('')
  const {error:e1}=await supabase.rpc('submit_managed_sourcing_invite_offer',{
   p_invite_id:invite.id,
   p_monthly_price_egp:monthly,
   p_yearly_price_egp:yearly?Number(yearly):null,
   p_availability_status:String(f.get('availability')),
   p_terms:String(f.get('terms')||''),
   p_notes:String(f.get('notes')||'')
  })
  setSaving('')
  if(e1){setError(e1.message);return}
  setNotice('تم إرسال عرضك بنجاح إلى فريق My Car، وسيظهر بعد المراجعة ضمن نتائج البحث.')
  setActiveInvite('')
  await load()
 }
 const vehicleName=(invite:Row)=>{const v=vehicles[invite.vehicle_id];return v?[v.make,v.model,v.model_year].filter(Boolean).join(' '):'سيارتك المسجلة'}
 return <main dir="rtl" className="min-h-screen bg-[#f3f7fc] text-slate-900">
  <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><PlatformBrand/><div className="flex items-center gap-2"><a href={organizationType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="rounded-xl border px-3 py-2 text-sm font-bold">العودة لمساحة العمل</a><AccountNotifications/></div></header>
   {organizationType==='fleet_supplier'&&<SupplierNavigation/>}
   <section className="mt-5 rounded-3xl bg-gradient-to-l from-[#0b2340] via-[#123a61] to-[#1768a6] p-6 text-white shadow-lg sm:p-8"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold"><Sparkles size={15}/> فرص بحث موجهة حسب أسطولك</span><h1 className="mt-3 text-2xl font-black sm:text-3xl">تفويضات البحث المرسلة إليك</h1><p className="mt-2 text-sm leading-7 text-blue-100">تظهر هنا فقط طلبات البحث التي تم ترشيح سياراتك لها. راجع احتياج الشركة وقدّم عرضًا واضحًا لفريق My Car.</p><div className="mt-4 flex flex-wrap gap-3 text-sm"><span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">دعوات مفتوحة: {openCount.toLocaleString('ar-EG')}</span><span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">إجمالي الدعوات: {invites.length.toLocaleString('ar-EG')}</span></div></section>
   {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
   {notice&&<div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
   {loading?<div className="mt-5 rounded-2xl border bg-white p-10 text-center text-slate-500">جارٍ تحميل الدعوات الموجهة إليك...</div>:<div className="mt-5 space-y-3">
    {invites.map(invite=>{const v=vehicles[invite.vehicle_id];const open=activeInvite===invite.id;return <article key={invite.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
     <button onClick={()=>void viewInvite(invite)} className="w-full p-4 text-right sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><CarFront size={22}/></span><div><h2 className="font-black">{invite.request_title}</h2><p className="mt-1 text-xs text-slate-500">{vehicleName(invite)} · {invite.request_quantity} سيارة مطلوبة</p><p className="mt-1 text-xs text-slate-500">{(invite.request_governorates||[]).join('، ')||'كل المحافظات'} · {invite.request_duration_months} شهر</p></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabel[invite.status]||invite.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span className="rounded-lg bg-slate-50 p-2"><MapPin size={14} className="mb-1 text-blue-700"/> {v?.governorate||'الموقع المسجل'}</span><span className="rounded-lg bg-slate-50 p-2"><CalendarDays size={14} className="mb-1 text-blue-700"/> {invite.request_duration_type==='yearly'?'سنوي':'شهري'} · {invite.request_duration_months} شهر</span><span className="rounded-lg bg-slate-50 p-2"><ShieldCheck size={14} className="mb-1 text-blue-700"/> مطابقة {invite.match_score}%</span><span className="rounded-lg bg-slate-50 p-2"><Clock3 size={14} className="mb-1 text-blue-700"/> {new Date(invite.sent_at).toLocaleDateString('ar-EG')}</span></div></button>
     {open&&<div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-3"><b className="text-sm">مواصفات البحث</b><p className="mt-2 text-sm leading-7 text-slate-600">نوع المركبة: {invite.request_vehicle_type}<br/>الموديلات: {(invite.request_makes_models||[]).join('، ')||'مفتوح'}<br/>سنوات الصنع: {invite.request_model_year_min||'بدون حد أدنى'} – {invite.request_model_year_max||'بدون حد أقصى'}<br/>الميزانية للسيارة: {money(invite.request_budget_per_vehicle_egp)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3"><b className="text-sm">سبب ترشيح سيارتك</b><ul className="mt-2 space-y-1 text-sm text-slate-600">{(invite.match_reasons||[]).map((x:string)=><li key={x}>✓ {x}</li>)}</ul><p className="mt-2 text-xs leading-6 text-slate-500">{invite.request_requirements}</p></div></div>
      {invite.status==='responded'?<div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={18}/> استلمنا عرضك بنجاح. فريق My Car يراجعه الآن.</div>:<form onSubmit={e=>void submitOffer(e,invite)} className="mt-4 rounded-xl border border-blue-100 bg-white p-4"><h3 className="font-black">تقديم عرضك على التفويض</h3><p className="mt-1 text-xs text-slate-500">السيارة المرشحة: {vehicleName(invite)}{v?.with_driver?' · بسائق':''}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">السعر الشهري (ج.م)<input name="monthly_price" type="number" min="0" step="0.01" required defaultValue={v?.monthly_price_egp||''} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"/></label><label className="text-sm font-bold">السعر السنوي (اختياري)<input name="yearly_price" type="number" min="0" step="0.01" defaultValue={v?.yearly_price_egp||''} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"/></label><label className="text-sm font-bold">حالة التوافر<select name="availability" defaultValue="available" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="available">متاحة</option><option value="limited">متاحة بشروط</option><option value="awaiting_confirmation">تحتاج تأكيدًا نهائيًا</option></select></label><label className="text-sm font-bold">الشروط<textarea name="terms" rows={2} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 p-3" placeholder="التأمين، الصيانة، حدود الاستخدام..."/></label><label className="text-sm font-bold sm:col-span-2">ملاحظات إضافية<textarea name="notes" rows={2} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 p-3" placeholder="أي تفاصيل تساعد فريق البحث على تقييم العرض..."/></label></div><button disabled={saving===invite.id} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white hover:bg-blue-800 disabled:opacity-50"><Send size={16}/>{saving===invite.id?'جارٍ إرسال العرض...':'إرسال العرض إلى My Car'}</button></form>}
     </div>}
    </article>})}
    {!invites.length&&<div className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center"><BellRing className="mx-auto text-blue-700" size={30}/><h2 className="mt-3 font-black">لا توجد تفويضات موجهة إليك حاليًا</h2><p className="mt-1 text-sm text-slate-500">عندما تتطابق سياراتك مع طلب شركة وتقوم الإدارة بإرسال التفويض، ستظهر الدعوة هنا.</p><a href={organizationType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">العودة لمساحة العمل <ArrowLeft size={15}/></a></div>}
   </div>}
  </div>
 </main>
}
