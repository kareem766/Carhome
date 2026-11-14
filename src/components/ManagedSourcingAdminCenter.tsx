import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, CheckCircle2, ClipboardList, Download, RefreshCw, Search, Send, ShieldCheck, Users, CarFront } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import AdminPageNavigation from './AdminPageNavigation'

type Row = Record<string, any>
const statusLabels: Record<string,string> = {new:'طلب جديد',under_review:'مراجعة الإدارة',quote_ready:'عرض السعر جاهز',awaiting_company_approval:'بانتظار موافقة الشركة',awaiting_payment:'بانتظار السداد',searching:'جاري البحث',gathering_offers:'تجميع العروض',results_ready:'النتائج جاهزة',awaiting_company_choice:'بانتظار اختيار الشركة',completed:'مكتمل',unable_to_fulfill:'تعذر توفير المطلوب',cancelled:'ملغي'}
const availabilityLabels: Record<string,string> = {available:'متاحة',limited:'متاحة بشروط',awaiting_confirmation:'بانتظار التأكيد',unavailable:'غير متاحة'}
const inviteLabels: Record<string,string> = {sent:'تم الإرسال',viewed:'تمت المشاهدة',responded:'تم تقديم عرض',expired:'منتهية',withdrawn:'ملغاة'}
const money = (value:any) => value == null ? '—' : Number(value).toLocaleString('ar-EG')+' ج.م'

export default function ManagedSourcingAdminCenter() {
 const [requests,setRequests]=useState<Row[]>([])
 const [offers,setOffers]=useState<Row[]>([])
 const [invites,setInvites]=useState<Row[]>([])
 const [selected,setSelected]=useState('')
 const [selectedOfferIds,setSelectedOfferIds]=useState<string[]>([])
 const [search,setSearch]=useState('')
 const [statusFilter,setStatusFilter]=useState('all')
 const [offerSearch,setOfferSearch]=useState('')
 const [availabilityFilter,setAvailabilityFilter]=useState('all')
 const [governorateFilter,setGovernorateFilter]=useState('all')
 const [maxMonthlyPrice,setMaxMonthlyPrice]=useState('')
 const [sortMode,setSortMode]=useState('score')
 const [companyMessage,setCompanyMessage]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')

 const loadRequests=useCallback(async()=>{
  if(!supabase){window.location.replace('/?login=1');return}
  setLoading(true);setError('')
  const {data:{user:u},error:authError}=await supabase.auth.getUser()
  if(authError||!u){window.location.replace('/?login=1');return}
  const {data:admin}=await supabase.from('platform_admins').select('user_id').eq('user_id',u.id).maybeSingle()
  if(!admin){setError('غير مصرح لك بإدارة تفويضات البحث.');setLoading(false);return}
  const {data,error:loadError}=await supabase.from('managed_sourcing_requests').select('*,organizations!managed_sourcing_requests_company_organization_id_fkey(name)').order('created_at',{ascending:false})
  if(loadError){setError(loadError.message);setLoading(false);return}
  const rows=(data||[]) as Row[]
  setRequests(rows)
  if(!selected&&rows[0]?.id)setSelected(rows[0].id)
  setLoading(false)
 },[selected])

 const loadDetails=useCallback(async()=>{
  if(!supabase||!selected)return
  const [o,i]=await Promise.all([
   supabase.from('managed_sourcing_offers').select('*,organizations!managed_sourcing_offers_supplier_organization_id_fkey(name,organization_type)').eq('request_id',selected).order('created_at',{ascending:false}),
   supabase.from('managed_sourcing_invites').select('*,organizations!managed_sourcing_invites_organization_id_fkey(name,organization_type),vehicles!managed_sourcing_invites_vehicle_id_fkey(make,model,model_year,governorate)').eq('request_id',selected).order('sent_at',{ascending:false})
  ])
  if(o.error||i.error){setError(o.error?.message||i.error?.message||'تعذر تحميل تفاصيل التفويض');return}
  const offerRows=(o.data||[]) as Row[]
  setOffers(offerRows);setInvites((i.data||[]) as Row[])
  setSelectedOfferIds(offerRows.filter(x=>x.company_decision==='selected').map(x=>x.id))
 },[selected])

 useEffect(()=>{void loadRequests()},[loadRequests])
 useEffect(()=>{void loadDetails()},[loadDetails])

 const current=requests.find(x=>x.id===selected)
 const canStartSubscription=!!current&&current.payment_model==='subscription'&&['new','under_review'].includes(current.status)&&current.payment_status==='not_required'
 const canVerifyPayment=!!current&&current.payment_model==='per_request'&&current.status==='awaiting_payment'&&['awaiting_payment','payment_submitted','rejected'].includes(current.payment_status)&&!!current.company_approved_at&&!!current.payment_reference&&!!current.payment_submitted_at
 const filteredRequests=useMemo(()=>requests.filter(r=>{
  const q=search.trim().toLocaleLowerCase('ar')
  const org=Array.isArray(r.organizations)?r.organizations[0]:r.organizations
  const textMatch=!q||[r.title,r.vehicle_type,org?.name,(r.governorates||[]).join(' '),r.id].some(x=>String(x||'').toLocaleLowerCase('ar').includes(q))
  return textMatch&&(statusFilter==='all'||r.status===statusFilter)
 }),[requests,search,statusFilter])
 const filteredOffers=useMemo(()=>offers.filter(o=>{
  const q=offerSearch.trim().toLocaleLowerCase('ar')
  const textMatch=!q||[o.make,o.model,o.governorate,o.vehicle_type].some(x=>String(x||'').toLocaleLowerCase('ar').includes(q))
  const availabilityMatch=availabilityFilter==='all'||o.availability_status===availabilityFilter
  const governorateMatch=governorateFilter==='all'||o.governorate===governorateFilter
  const priceMatch=!maxMonthlyPrice||Number(o.monthly_price_egp||0)<=Number(maxMonthlyPrice)
  return textMatch&&availabilityMatch&&governorateMatch&&priceMatch
 }).sort((a,b)=>{
  if(sortMode==='price')return Number(a.monthly_price_egp??Number.MAX_SAFE_INTEGER)-Number(b.monthly_price_egp??Number.MAX_SAFE_INTEGER)
  if(sortMode==='score')return Number(invites.find(i=>i.id===b.invite_id)?.match_score||0)-Number(invites.find(i=>i.id===a.invite_id)?.match_score||0)
  return Number(a.recommendation_rank||999)-Number(b.recommendation_rank||999)
 }),[offers,offerSearch,availabilityFilter,governorateFilter,maxMonthlyPrice,sortMode,invites])
 const invitedUsers=new Set(invites.map(x=>x.user_id)).size
 const responded=invites.filter(x=>x.status==='responded').length
 const matched=offers.filter(x=>x.availability_status!=='unavailable').length

 async function startSearch(){
  if(!supabase||!selected||!current)return
  setSaving(true);setError('');setNotice('')
  const isSubscription=current.payment_model==='subscription'
  const result=isSubscription
   ? await supabase.rpc('managed_sourcing_admin_start_search',{p_request_id:selected})
   : await supabase.rpc('managed_sourcing_admin_verify_payment',{p_request_id:selected,p_verified:true})
  setSaving(false)
  if(result.error){setError(result.error.message);return}
  setNotice(isSubscription?'تم اعتماد طلب البحث ضمن اشتراك الشركة وبدأ التنفيذ.':'تم تأكيد التحويل واعتماد بدء البحث.')
  await loadRequests();await loadDetails()
 }

 async function dispatch(){
  if(!supabase||!selected)return
  setSaving(true);setError('');setNotice('')
  const {data,error:e}=await supabase.rpc('dispatch_managed_sourcing_request',{p_request_id:selected})
  setSaving(false)
  if(e){setError(e.message);return}
  setNotice('تم إرسال التفويض بنجاح إلى '+Number(data?.invited_users||0).toLocaleString('ar-EG')+' مستخدم مؤهل عبر '+Number(data?.invited_vehicles||0).toLocaleString('ar-EG')+' سيارة.')
  await loadRequests();await loadDetails()
 }

 async function publish(){
  if(!supabase||!selected||!selectedOfferIds.length)return
  setSaving(true);setError('');setNotice('')
  const {data,error:e}=await supabase.rpc('publish_managed_sourcing_results',{p_request_id:selected,p_offer_ids:selectedOfferIds,p_company_message:companyMessage})
  setSaving(false)
  if(e){setError(e.message);return}
  setNotice('تم إرسال نتيجة البحث للشركة بنجاح. عدد العروض المنشورة: '+Number(data?.published_offers||0).toLocaleString('ar-EG')+'.')
  await loadRequests();await loadDetails()
 }

 function toggleOffer(id:string){setSelectedOfferIds(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id])}
 function printReport(){window.print()}

 return <main dir="rtl" className="min-h-screen bg-[#f3f7fc] text-slate-900">
  <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><PlatformBrand/><div className="flex items-center gap-2"><a href="/workspace/admin/managed-sourcing" className="rounded-xl border px-3 py-2 text-sm font-bold">إدارة خدمة البحث الحالية</a><AccountNotifications/></div></header>
   <AdminPageNavigation/>
   <section className="mt-5 rounded-3xl bg-gradient-to-l from-[#0b2340] via-[#123a61] to-[#1768a6] p-6 text-white shadow-lg sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold"><ShieldCheck size={15}/> مركز تشغيل التفويضات</span><h1 className="mt-3 text-2xl font-black sm:text-3xl">إدارة البحث والتواصل مع المؤهلين</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-blue-100">إرسال موجه للملاك وموردي الأساطيل، متابعة الاستجابة، فرز العروض، ثم نشر تقرير النتائج للشركة.</p></div><button onClick={()=>{void loadRequests();void loadDetails()}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 font-bold hover:bg-white/15"><RefreshCw size={16}/> تحديث البيانات</button></div>
   </section>
   {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
   {notice&&<div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
   <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(300px,.78fr)_minmax(0,1.5fr)]">
    <section className="space-y-3">
     <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><label className="relative"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم الشركة أو التفويض" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none focus:border-blue-500"/></label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
     </div>
     {loading?<div className="rounded-2xl border bg-white p-8 text-center text-slate-500">جارٍ تحميل التفويضات...</div>:filteredRequests.map(r=>{const org=Array.isArray(r.organizations)?r.organizations[0]:r.organizations;return <button key={r.id} onClick={()=>{setSelected(r.id);setCompanyMessage('');setSelectedOfferIds([])}} className={'w-full rounded-2xl border p-4 text-right shadow-sm transition '+(selected===r.id?'border-blue-400 bg-blue-50':'border-slate-200 bg-white hover:border-blue-300')}><div className="flex items-start justify-between gap-2"><b className="text-sm">{r.title}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold">{statusLabels[r.status]||r.status}</span></div><p className="mt-2 text-xs text-slate-500">{org?.name||'شركة'} · {r.quantity} سيارة · {(r.governorates||[]).join('، ')||'كل المحافظات'}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(r.created_at).toLocaleDateString('ar-EG')} · {r.id.slice(0,8)}</p></button>})}
     {!loading&&!filteredRequests.length&&<div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">لا توجد تفويضات مطابقة للفلاتر.</div>}
    </section>
    <section className="min-w-0 space-y-4">
     {!current?<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">اختر تفويضًا لعرض تفاصيله وإدارته.</div>:<>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
       <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-700">تفويض رقم {current.id.slice(0,8)}</p><h2 className="mt-1 text-xl font-black">{current.title}</h2><p className="mt-1 text-sm text-slate-500">{(Array.isArray(current.organizations)?current.organizations[0]:current.organizations)?.name||'الشركة'} · {current.quantity} مركبة · {current.vehicle_type}</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-800">{statusLabels[current.status]||current.status}</span></div>
       <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[{n:invites.length,l:'دعوات المركبات',i:CarFront},{n:invitedUsers,l:'مستخدمون مؤهلون',i:Users},{n:responded,l:'ردود مستلمة',i:BellRing},{n:matched,l:'عروض قابلة للفرز',i:ClipboardList}].map(x=><div key={x.l} className="rounded-xl bg-slate-50 p-3"><x.i size={17} className="text-blue-700"/><b className="mt-2 block text-2xl">{x.n.toLocaleString('ar-EG')}</b><span className="text-[11px] text-slate-500">{x.l}</span></div>)}
       </div>
       <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><b>المناطق:</b> {(current.governorates||[]).join('، ')||'كل المحافظات'}</p><p><b>المدة:</b> {current.duration_months} شهر</p><p><b>الميزانية للسيارة:</b> {money(current.budget_per_vehicle_egp)}</p><p><b>حالة السداد:</b> {current.payment_status}</p><p><b>مرجع التحويل:</b> {current.payment_reference||'—'}</p><p><b>تاريخ التحويل:</b> {current.payment_transfer_date?new Date(current.payment_transfer_date+'T00:00:00').toLocaleDateString('ar-EG'):'—'}</p></div>
       {current.requirements&&<p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-600">{current.requirements}</p>}
       <div className="mt-4 flex flex-wrap gap-2">{(canStartSubscription||canVerifyPayment)&&<button disabled={saving} onClick={()=>void startSearch()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-40"><CheckCircle2 size={16}/>{canStartSubscription?'بدء البحث ضمن الاشتراك':'تأكيد التحويل وبدء البحث'}</button>}<button disabled={saving||!['searching','gathering_offers'].includes(current.status)||!['verified','not_required'].includes(current.payment_status)} onClick={()=>void dispatch()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white hover:bg-blue-800 disabled:opacity-40"><Send size={16}/> إرسال للمؤهلين بضغطة واحدة</button><button onClick={()=>void loadDetails()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold text-slate-700"><RefreshCw size={15}/> تحديث الردود</button></div>
       <p className="mt-2 text-xs leading-6 text-slate-400">الإرسال متاح بعد اعتماد التفويض وتأكيد رسوم الخدمة. يعيد النظام إرسال الدعوات الجديدة فقط دون تكرار الإشعارات للمستلمين السابقين.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
       <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-black">العروض المستلمة</h3><p className="text-xs text-slate-500">فلتر وقارن العروض وحدد الخيارات التي ستظهر للشركة.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{offers.length} عرض</span></div>
       <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><label className="relative"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={offerSearch} onChange={e=>setOfferSearch(e.target.value)} placeholder="بحث بالماركة أو الموديل" className="min-h-11 w-full rounded-xl border border-slate-200 pr-9 pl-3 text-sm"/></label><select value={availabilityFilter} onChange={e=>setAvailabilityFilter(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">كل حالات التوافر</option>{Object.entries(availabilityLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={governorateFilter} onChange={e=>setGovernorateFilter(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">كل المحافظات</option>{[...new Set(offers.map(o=>o.governorate).filter(Boolean))].map(g=><option key={g} value={g}>{g}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="number" min="0" value={maxMonthlyPrice} onChange={e=>setMaxMonthlyPrice(e.target.value)} placeholder="أقصى سعر شهري" className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-3 text-sm"/><select value={sortMode} onChange={e=>setSortMode(e.target.value)} className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm"><option value="score">الأعلى مطابقة</option><option value="price">الأقل سعرًا</option><option value="rank">الترتيب الإداري</option></select></div></div>
       <div className="mt-4 space-y-3">{filteredOffers.map(o=>{const org=Array.isArray(o.organizations)?o.organizations[0]:o.organizations;const score=invites.find(i=>i.id===o.invite_id)?.match_score;return <label key={o.id} className={'block rounded-2xl border p-4 '+(selectedOfferIds.includes(o.id)?'border-blue-400 bg-blue-50/60':'border-slate-200 bg-white')}><div className="flex items-start gap-3"><input type="checkbox" checked={selectedOfferIds.includes(o.id)} onChange={()=>toggleOffer(o.id)} className="mt-1 h-4 w-4 accent-blue-700"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><b>{o.make} {o.model} {o.model_year||''}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold">{availabilityLabels[o.availability_status]||o.availability_status}</span></div><p className="mt-1 text-xs text-slate-500">{org?.name||'مقدم عرض'} · {org?.organization_type==='fleet_supplier'?'مورد أسطول':'مالك سيارة'} · {o.governorate} · {o.seats||'—'} مقاعد</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span>شهري: <b>{money(o.monthly_price_egp)}</b></span><span>سنوي: <b>{money(o.yearly_price_egp)}</b></span><span>المطابقة: <b>{score==null?'—':score+'%'}</b></span><span>الحالة: <b>{o.company_decision==='selected'?'مرشح للشركة':o.company_decision==='rejected'?'مستبعد':'قيد الفرز'}</b></span></div>{o.terms&&<p className="mt-2 text-xs leading-6 text-slate-500">{o.terms}</p>}{o.notes&&<p className="mt-1 text-xs leading-6 text-slate-500">{o.notes}</p>}</div></div></label>})}
        {!filteredOffers.length&&<div className="rounded-xl border border-dashed p-7 text-center text-sm text-slate-500">لا توجد عروض مطابقة للفلاتر حتى الآن.</div>}</div>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
       <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-black">سجل المستلمين وحالة الاستجابة</h3><span className="text-xs text-slate-500">{invites.length} دعوة</span></div>
       <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-right text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">المستلم</th><th className="p-2">السيارة</th><th className="p-2">المطابقة</th><th className="p-2">الحالة</th><th className="p-2">تاريخ الإرسال</th></tr></thead><tbody>{invites.map(i=>{const org=Array.isArray(i.organizations)?i.organizations[0]:i.organizations;const v=Array.isArray(i.vehicles)?i.vehicles[0]:i.vehicles;return <tr key={i.id} className="border-b last:border-0"><td className="p-2"><b>{org?.name||'مقدم خدمة'}</b><span className="block text-[11px] text-slate-400">{org?.organization_type==='fleet_supplier'?'مورد أسطول':'مالك سيارة'} · {String(i.user_id).slice(0,8)}</span></td><td className="p-2">{[v?.make,v?.model,v?.model_year].filter(Boolean).join(' ')||'سيارة مسجلة'}</td><td className="p-2 font-bold">{i.match_score}%</td><td className="p-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold">{inviteLabels[i.status]||i.status}</span></td><td className="p-2 text-xs text-slate-500">{new Date(i.sent_at).toLocaleDateString('ar-EG')}</td></tr>})}</tbody></table></div>
       {!invites.length&&<p className="mt-3 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">لم يتم إرسال التفويض بعد.</p>}
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
       <div className="flex items-center gap-2"><CheckCircle2 className="text-emerald-600"/><h3 className="text-lg font-black">إرسال نتيجة البحث للشركة</h3></div>
       <p className="mt-1 text-sm leading-6 text-slate-500">اختر العروض المرشحة فقط، واكتب ملخصًا أو توصية تظهر للشركة مع النتيجة.</p>
       <label className="mt-4 block text-sm font-bold">رسالة فريق البحث<textarea value={companyMessage} onChange={e=>setCompanyMessage(e.target.value)} rows={3} maxLength={2000} placeholder="مثال: نوصي بالخيار الأول لأنه الأقرب للمواصفات والميزانية..." className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"/></label>
       <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-500">العروض المحددة: <b className="text-slate-900">{selectedOfferIds.length}</b></span><div className="flex flex-wrap gap-2"><button onClick={printReport} disabled={!selectedOfferIds.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold disabled:opacity-40"><Download size={16}/> معاينة / طباعة التقرير</button><button onClick={()=>void publish()} disabled={saving||!selectedOfferIds.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-40"><Send size={16}/> إرسال نتيجة البحث للشركة</button></div></div>
       {current.results_published_at&&<p className="mt-3 text-xs text-emerald-700">آخر إرسال للنتيجة: {new Date(current.results_published_at).toLocaleString('ar-EG')}</p>}
      </article>
      <div id="managed-sourcing-report" className="hidden print:block">
       <div className="border-b-2 border-blue-900 pb-4 text-right">
        <div className="text-sm font-black text-blue-900">MY CAR · عربيتي</div>
        <h1 className="mt-3 text-2xl font-black">تقرير نتيجة البحث والتوفير</h1>
        <p className="mt-1 text-sm text-slate-600">رقم التفويض: {current.id.slice(0,8)} · تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
        <p className="mt-1 text-sm">الشركة: {(Array.isArray(current.organizations)?current.organizations[0]:current.organizations)?.name||'الشركة'}</p>
       </div>
       <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p><b>الاحتياج:</b> {current.title}</p><p><b>العدد:</b> {current.quantity} مركبة</p><p><b>النوع:</b> {current.vehicle_type}</p><p><b>المناطق:</b> {(current.governorates||[]).join('، ')||'كل المحافظات'}</p><p><b>المدة:</b> {current.duration_months} شهر</p><p><b>الميزانية:</b> {money(current.budget_per_vehicle_egp)}</p></div>
       <h2 className="mt-6 border-b pb-2 text-lg font-black">العروض المرشحة</h2>
       <div className="mt-3 space-y-3">{offers.filter(o=>selectedOfferIds.includes(o.id)).map((o,index)=><div key={o.id} className="break-inside-avoid rounded-xl border border-slate-300 p-4"><div className="flex justify-between gap-3"><b>{index+1}. {o.make} {o.model} {o.model_year||''}</b><b>{money(o.monthly_price_egp)} شهريًا</b></div><p className="mt-1 text-sm text-slate-600">{o.governorate} · {o.seats||'—'} مقاعد · {availabilityLabels[o.availability_status]||o.availability_status}</p>{o.yearly_price_egp!=null&&<p className="mt-1 text-sm">السعر السنوي: {money(o.yearly_price_egp)}</p>}{o.terms&&<p className="mt-2 text-sm">{o.terms}</p>}{o.notes&&<p className="mt-1 text-sm text-slate-600">{o.notes}</p>}</div>)}</div>
       {companyMessage&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><b>رسالة فريق البحث:</b><p className="mt-2">{companyMessage}</p></div>}
       <p className="mt-8 border-t pt-3 text-xs leading-6 text-slate-500">هذا التقرير يعرض البيانات والعروض المقدمة من أصحاب المركبات وموردي الأساطيل وقت إعداده. يظل التحقق النهائي والتعاقد والتشغيل بين الشركة ومقدم الخدمة، ولا يمثل التقرير ضمانًا لتوافر المركبة أو تنفيذ التعاقد.</p>
      </div>
      <style>{'@media print { body * { visibility: hidden !important; } #managed-sourcing-report, #managed-sourcing-report * { visibility: visible !important; } #managed-sourcing-report { display: block !important; position: absolute; inset: 0; width: 100%; padding: 24px; background: white; color: #111827; } }'}</style>
     </>}
    </section>
   </div>
  </div>
 </main>
}
