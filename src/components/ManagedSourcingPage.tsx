import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, ClipboardList, Plus, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Row = Record<string, any>
const field = 'mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-800 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
const statusNames: Record<string,string> = {new:'طلب جديد',under_review:'قيد المراجعة',quote_ready:'عرض الرسوم جاهز',awaiting_company_approval:'بانتظار موافقة الشركة',awaiting_payment:'بانتظار السداد',searching:'جاري البحث',gathering_offers:'جمع عروض الموردين',results_ready:'النتائج جاهزة',awaiting_company_choice:'بانتظار اختيار الشركة',completed:'مكتمل',unable_to_fulfill:'تعذر التوفير',cancelled:'ملغي'}
const payNames: Record<string,string> = {not_required:'لم تحدد الرسوم',awaiting_payment:'بانتظار السداد',payment_submitted:'بيانات الدفع مرسلة',verified:'تم تأكيد الدفع',rejected:'الدفع يحتاج مراجعة',refunded:'تم رد الرسوم'}
const states = Object.keys(statusNames)
const money = (v:unknown) => v == null || v === '' ? 'يحدد بعد المراجعة' : new Intl.NumberFormat('ar-EG',{style:'currency',currency:'EGP',maximumFractionDigits:0}).format(Number(v))
const date = (v:string) => new Date(v).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'})
const serviceTypes = [{value:'standard',label:'بحث عن سيارات مناسبة'},{value:'fleet',label:'توفير أسطول'},{value:'staff_transport',label:'نقل موظفين'},{value:'delivery',label:'سيارات للتوصيل والتشغيل'},{value:'urgent',label:'طلب عاجل'},{value:'search_and_coordinate',label:'بحث وتنسيق شامل'}]

export default function ManagedSourcingPage() {
  const adminRoute = window.location.pathname.startsWith('/workspace/admin/')
  const [user,setUser] = useState<Row|null>(null)
  const [orgId,setOrgId] = useState('')
  const [authorized,setAuthorized] = useState(false)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [requests,setRequests] = useState<Row[]>([])
  const [offers,setOffers] = useState<Row[]>([])
  const [updates,setUpdates] = useState<Row[]>([])
  const [actions,setActions] = useState<Row[]>([])
  const [pricing,setPricing] = useState<Row[]>([])
  const [packages,setPackages] = useState<Row[]>([])
  const [subscriptions,setSubscriptions] = useState<Row[]>([])
  const [internalNotes,setInternalNotes] = useState<Row[]>([])
  const [expanded,setExpanded] = useState<string|null>(null)
  const [offerFor,setOfferFor] = useState<string|null>(null)
  const [search,setSearch] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('إعدادات قاعدة البيانات غير مكتملة.'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const {data:auth,error:authError} = await supabase.auth.getUser()
      if (authError || !auth.user) { window.location.replace('/?login=1'); return }
      setUser({id:auth.user.id,email:auth.user.email||'',name:String(auth.user.user_metadata?.display_name||auth.user.email||'مستخدم My Car')})
      const {data:adminRow} = await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
      const isAdmin = Boolean(adminRow)
      if (adminRoute && !isAdmin) { setAuthorized(false); setError('هذه الصفحة مخصصة لإدارة منصة My Car.'); setLoading(false); return }
      let companyId = ''
      if (!adminRoute && !isAdmin) {
        const {data:members,error:memberError} = await supabase.from('organization_memberships').select('organization_id,organizations(id,name,organization_type)').eq('user_id',auth.user.id).limit(1)
        if (memberError) throw memberError
        const member = members?.[0] as Row|undefined
        const org = Array.isArray(member?.organizations) ? member?.organizations[0] : member?.organizations
        if (!member?.organization_id || org?.organization_type !== 'company') { setAuthorized(false); setError('خدمة البحث والتوفير المُدار متاحة لحسابات الشركات فقط.'); setLoading(false); return }
        companyId = member.organization_id
        setOrgId(companyId)
      }
      setAuthorized(true)
      const [p,pk] = await Promise.all([supabase.from('managed_sourcing_pricing').select('*').order('display_order'),supabase.from('managed_sourcing_packages').select('*').order('display_order')])
      if (p.error) throw p.error
      if (pk.error) throw pk.error
      setPricing(p.data||[]); setPackages(pk.data||[])
      let subscriptionQuery = supabase.from('managed_sourcing_subscriptions').select('*').order('created_at',{ascending:false}).limit(200)
      if (!adminRoute && !isAdmin) subscriptionQuery = subscriptionQuery.eq('organization_id',companyId)
      const subscriptionResult = await subscriptionQuery
      if (subscriptionResult.error) throw subscriptionResult.error
      setSubscriptions(subscriptionResult.data||[])
      let query = supabase.from('managed_sourcing_requests').select('*').order('created_at',{ascending:false}).limit(250)
      if (!adminRoute && !isAdmin) query = query.eq('company_organization_id',companyId)
      const result = await query
      if (result.error) throw result.error
      const rows = result.data||[]
      setRequests(rows)
      const ids = rows.map((r:Row)=>r.id)
      if (ids.length) {
        const [o,u,a] = await Promise.all([
          supabase.from('managed_sourcing_offers').select('*').in('request_id',ids).order('recommendation_rank'),
          supabase.from('managed_sourcing_updates').select('*').in('request_id',ids).order('created_at',{ascending:false}),
          supabase.from('managed_sourcing_actions').select('*').in('request_id',ids).order('created_at',{ascending:false})
        ])
        if (o.error) throw o.error
        if (u.error) throw u.error
        if (a.error) throw a.error
        setOffers(o.data||[]); setUpdates(u.data||[]); setActions(a.data||[])
        if (adminRoute) {
          const noteResult = await supabase.from('managed_sourcing_internal_notes').select('*').in('request_id',ids).order('created_at',{ascending:false})
          if (noteResult.error) throw noteResult.error
          setInternalNotes(noteResult.data||[])
        } else setInternalNotes([])
      } else { setOffers([]); setUpdates([]); setActions([]); setInternalNotes([]) }
    } catch(e) { setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات خدمة التوفير.') }
    finally { setLoading(false) }
  },[adminRoute])

  useEffect(()=>{void load()},[load])
  const visible = useMemo(()=>requests.filter(r=>!search.trim() || [r.title,r.vehicle_type,r.id,(r.governorates||[]).join(' ')].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))),[requests,search])
  const activePackages = packages.filter(p=>p.is_active && Number(p.monthly_price_egp)>0)

  async function createRequest(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !orgId) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const paymentModel = String(form.get('payment_model')||'per_request')
    const subscriptionId = String(form.get('subscription_id')||'')||null
    const selectedSubscription = subscriptions.find(s=>s.id===subscriptionId && s.status==='active' && s.payment_status==='verified' && s.ends_at && new Date(s.ends_at).getTime()>Date.now() && Number(s.requests_used)<Number(s.requests_included))
    if (paymentModel==='subscription' && !selectedSubscription) { setError('لا يوجد اشتراك شهري نشط به طلبات متاحة. اشترك في باقة من القسم المخصص أولًا.'); return }
    const packageId = paymentModel==='subscription' ? selectedSubscription.package_id : null
    setSaving(true); setError(''); setNotice('')
    const payload = {
      company_organization_id:orgId,created_by:user.id,title:String(form.get('title')||'').trim(),
      service_type:String(form.get('service_type')||'standard'),quantity:Number(form.get('quantity')||1),
      vehicle_type:String(form.get('vehicle_type')||'أي نوع مناسب'),
      makes_models:String(form.get('makes_models')||'').split(/[,،]/).map(s=>s.trim()).filter(Boolean).slice(0,30),
      model_year_min:form.get('model_year_min')?Number(form.get('model_year_min')):null,
      model_year_max:form.get('model_year_max')?Number(form.get('model_year_max')):null,
      governorates:form.getAll('governorates').map(String),duration_type:String(form.get('duration_type')||'monthly'),
      duration_months:Number(form.get('duration_months')||12),start_date:String(form.get('start_date')||'')||null,
      budget_per_vehicle_egp:form.get('budget_per_vehicle_egp')?Number(form.get('budget_per_vehicle_egp')):null,
      total_budget_egp:form.get('total_budget_egp')?Number(form.get('total_budget_egp')):null,
      requirements:String(form.get('requirements')||'').trim(),
      delegation_level:String(form.get('delegation_level')||'full_coordination'),
      urgency:form.get('urgency')==='on'?'urgent':'standard',payment_model:paymentModel,
      package_id:paymentModel==='subscription'?packageId:null,subscription_id:paymentModel==='subscription'?subscriptionId:null,status:'new',payment_status:'not_required'
    }
    const {error:saveError} = await supabase.from('managed_sourcing_requests').insert(payload)
    if (saveError) { setSaving(false); setError('تعذر إرسال الطلب: '+saveError.message); return }
    setSaving(false); setNotice('تم إرسال طلبك. سيراجع فريق My Car الاحتياج ويحدد نطاق الخدمة ورسومها قبل بدء البحث. لا يبدأ العمل قبل موافقتك وسداد الرسوم المتفق عليها.')
    formElement.reset()
    await load()
  }

  async function companyAction(request:Row,type:string,message:string,paymentReference?:string,offerId?:string) {
    if (!supabase || !user) return
    setSaving(true);setError('');setNotice('')
    const result = await supabase.from('managed_sourcing_actions').insert({request_id:request.id,offer_id:offerId||null,created_by:user.id,action_type:type,payment_reference:paymentReference||null,message})
    setSaving(false)
    if(result.error){setError('تعذر تسجيل الإجراء: '+result.error.message);return}
    setNotice('تم إرسال الإجراء للفريق، وسيتم تحديث حالة الطلب بعد مراجعته.')
    await load()
  }

  async function saveAdminRequest(event:FormEvent<HTMLFormElement>,request:Row) {
    event.preventDefault(); if(!supabase||!user)return
    const form=new FormData(event.currentTarget)
    const status=String(form.get('status')||request.status)
    const paymentStatus=String(form.get('payment_status')||request.payment_status)
    const fee=String(form.get('quoted_fee_egp')||'')
    const newInternalNote=String(form.get('internal_note')||'').trim()
    const payload:Row={status,payment_status:paymentStatus,quoted_fee_egp:fee===''?null:Number(fee),assigned_to:String(form.get('assigned_to')||'')||null,updated_at:new Date().toISOString()}
    if(status==='awaiting_payment')payload.payment_status='awaiting_payment'
    if(paymentStatus==='verified')payload.payment_verified_at=new Date().toISOString()
    if(status==='completed')payload.completed_at=new Date().toISOString()
    setSaving(true);setError('');setNotice('')
    if(status!==request.status){
      const activity=await supabase.from('managed_sourcing_updates').insert({request_id:request.id,created_by:user.id,visibility:'company',title:'تحديث حالة الطلب',body:statusNames[status]||status,status_from:request.status,status_to:status})
      if(activity.error){setSaving(false);setError('تعذر حفظ سجل التحديث: '+activity.error.message);return}
    }
    const result=await supabase.from('managed_sourcing_requests').update(payload).eq('id',request.id)
    setSaving(false)
    if(result.error){setError('تعذر حفظ الطلب: '+result.error.message);return}
    if(newInternalNote){const noteResult=await supabase.from('managed_sourcing_internal_notes').insert({request_id:request.id,created_by:user.id,note:newInternalNote});if(noteResult.error){setError('تم حفظ حالة الطلب، لكن تعذر حفظ الملاحظة الداخلية: '+noteResult.error.message);await load();return}}
    setNotice('تم حفظ حالة الطلب والرسوم.')
    await load()
  }

  async function addOffer(event:FormEvent<HTMLFormElement>,request:Row) {
    event.preventDefault();if(!supabase||!user)return
    const f=new FormData(event.currentTarget)
    setSaving(true);setError('');setNotice('')
    const result=await supabase.from('managed_sourcing_offers').insert({
      request_id:request.id,created_by:user.id,make:String(f.get('make')||'').trim(),model:String(f.get('model')||'').trim(),
      model_year:f.get('model_year')?Number(f.get('model_year')):null,vehicle_type:String(f.get('vehicle_type')||''),
      seats:f.get('seats')?Number(f.get('seats')):null,governorate:String(f.get('governorate')||''),
      monthly_price_egp:f.get('monthly_price_egp')?Number(f.get('monthly_price_egp')):null,
      yearly_price_egp:f.get('yearly_price_egp')?Number(f.get('yearly_price_egp')):null,
      availability_status:String(f.get('availability_status')||'awaiting_confirmation'),
      outreach_status:String(f.get('outreach_status')||'contacted'),terms:String(f.get('terms')||'').trim(),
      notes:String(f.get('notes')||'').trim(),recommendation_rank:offers.filter(o=>o.request_id===request.id).length+1
    })
    setSaving(false);if(result.error){setError('تعذر إضافة الخيار: '+result.error.message);return}
    setOfferFor(null);setNotice('تمت إضافة الخيار للطلب.');await load()
  }

  async function savePricing(event:FormEvent<HTMLFormElement>,row:Row) {
    event.preventDefault();if(!supabase)return
    const f=new FormData(event.currentTarget);setSaving(true);setError('');setNotice('')
    const result=await supabase.from('managed_sourcing_pricing').update({name:String(f.get('name')||row.name),min_vehicles:Number(f.get('min_vehicles')||1),max_vehicles:f.get('max_vehicles')?Number(f.get('max_vehicles')):null,service_fee_egp:Number(f.get('service_fee_egp')||0),urgency_multiplier:Number(f.get('urgency_multiplier')||1),description:String(f.get('description')||''),is_active:f.get('is_active')==='on',updated_at:new Date().toISOString()}).eq('id',row.id)
    setSaving(false);if(result.error){setError(result.error.message);return}setNotice('تم حفظ تسعير الخدمة.');await load()
  }
  async function savePackage(event:FormEvent<HTMLFormElement>,row:Row) {
    event.preventDefault();if(!supabase)return
    const f=new FormData(event.currentTarget);setSaving(true);setError('');setNotice('')
    const result=await supabase.from('managed_sourcing_packages').update({name:String(f.get('name')||row.name),description:String(f.get('description')||''),monthly_price_egp:Number(f.get('monthly_price_egp')||0),included_requests:Number(f.get('included_requests')||0),included_vehicles_per_request:f.get('included_vehicles_per_request')?Number(f.get('included_vehicles_per_request')):null,is_active:f.get('is_active')==='on',updated_at:new Date().toISOString()}).eq('id',row.id)
    setSaving(false);if(result.error){setError(result.error.message);return}setNotice('تم حفظ الباقة الشهرية.');await load()
  }

  if(loading)return <main dir="rtl" className="grid min-h-[60vh] place-items-center bg-slate-50 text-slate-600">جارٍ تحميل خدمة التوفير المُدار...</main>
  if(!authorized)return <main dir="rtl" className="mx-auto max-w-3xl p-6"><section className="rounded-2xl border bg-white p-8"><PlatformBrand/><h1 className="mt-4 text-xl font-extrabold">تعذر فتح الخدمة</h1><p className="mt-3 text-sm leading-7 text-rose-700">{error}</p><a className={primary+' mt-5'} href="/">العودة للرئيسية</a></section></main>
  const feedback=<>{error&&<p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}</>
  const renderOffer=(offer:Row,request:Row)=><div key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-extrabold">{offer.make} {offer.model} {offer.model_year||''}</h4><p className="mt-1 text-xs text-slate-500">{offer.governorate||'الموقع غير محدد'} · {offer.vehicle_type||'نوع غير محدد'}{offer.seats?' · '+offer.seats+' مقاعد':''}</p></div><div className="text-left"><strong className="text-lg text-blue-800">{money(offer.monthly_price_egp)}</strong><p className="text-xs text-slate-500">شهريًا</p>{offer.yearly_price_egp!=null&&<p className="text-xs">سنويًا: {money(offer.yearly_price_egp)}</p>}</div></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1">{offer.availability_status==='available'?'التوافر مؤكد':offer.availability_status==='unavailable'?'غير متاحة':offer.availability_status==='limited'?'توافر محدود':'بانتظار تأكيد التوافر'}</span><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">متابعة المورد: {offer.outreach_status}</span></div>{offer.terms&&<p className="mt-3 text-sm leading-6 text-slate-600">{offer.terms}</p>}{offer.notes&&adminRoute&&<p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">ملاحظة الفريق: {offer.notes}</p>}{!adminRoute&&offer.availability_status==='available'&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={saving} className={primary} onClick={()=>void companyAction(request,'select_offer','نرغب في متابعة هذا الخيار.',undefined,offer.id)}><CheckCircle2 size={16}/> اختيار هذا الخيار</button><button disabled={saving} className={secondary} onClick={()=>void companyAction(request,'request_alternatives','نرجو تقديم بدائل لهذا الخيار.',undefined,offer.id)}>طلب بدائل</button></div>}{adminRoute&&<p className="mt-2 text-xs text-slate-500">قرار الشركة: {offer.company_decision}</p>}</div>

  return <main dir="rtl" className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.08),_transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_55%,#f8fafc)] px-3 py-6 sm:px-6"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white bg-white/90 p-5 shadow-sm sm:p-7"><div><PlatformBrand compact/><div className="mt-2 flex items-center gap-2 text-blue-800"><Sparkles size={18}/><span className="text-xs font-extrabold uppercase tracking-wide">Managed Sourcing</span></div><h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{adminRoute?'إدارة خدمة توفير السيارات المُدار':'خدمات My Car للشركات'}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{adminRoute?'إدارة الطلبات والتسعير والخيارات وسير العمل، مع فصل ملاحظات الفريق عن تحديثات الشركة.':'فوض فريق My Car للبحث عن السيارات والتواصل مع الموردين وجمع الأسعار. تظل الموافقة النهائية والتعاقد من اختصاص شركتك.'}</p></div><div className="flex flex-wrap gap-2"><a className={secondary} href={adminRoute?'/workspace/admin/dashboard':'/workspace/company'}>رجوع</a><button className={secondary} onClick={()=>void load()}><RefreshCw size={16}/> تحديث</button></div></header>
    {feedback}
    {!adminRoute&&<section className="mb-6 grid gap-3 sm:grid-cols-3">{[['بحث نيابة عنك','حدد العدد والنوع والمدة والموقع والميزانية، وسنرتب الخيارات حسب ملاءمتها.'],['تنسيق مع الموردين','فريق العمل يتابع التوافر والأسعار والشروط بدلًا من أن تبحث بنفسك.'],['قرارك النهائي محفوظ','لا يتم اختيار سيارة أو توقيع عقد أو الالتزام بإيجار نيابة عن شركتك.']].map(item=><div key={item[0]} className="rounded-2xl border border-blue-100 bg-white p-5"><ShieldCheck className="text-blue-700"/><h3 className="mt-3 font-extrabold">{item[0]}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item[1]}</p></div>)}</section>}
    {!adminRoute&&<section className="mb-8 rounded-3xl border bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-800"><Plus/></span><div><h2 className="text-xl font-extrabold">إنشاء طلب توفير سيارات</h2><p className="mt-1 text-sm leading-6 text-slate-600">أرسل احتياجك مرة واحدة، وسيحدد الفريق نطاق الخدمة والرسوم للموافقة قبل بدء التنفيذ.</p></div></div>
      <form onSubmit={createRequest} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-bold sm:col-span-2 lg:col-span-3">اسم الطلب أو الغرض منه *<input name="title" required minLength={4} maxLength={180} className={field} placeholder="مثال: توفير 12 سيارة لفريق المبيعات"/></label>
        <label className="text-sm font-bold">نوع الخدمة<select name="service_type" className={field}>{serviceTypes.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <label className="text-sm font-bold">عدد السيارات *<input name="quantity" required type="number" min={1} max={1000} defaultValue={1} className={field}/></label>
        <label className="text-sm font-bold">فئة السيارة<select name="vehicle_type" className={field}>{['أي نوع مناسب','سيدان','SUV','فان','ميكروباص','ميني باص','أتوبيس','نقل خفيف','نقل ثقيل','أخرى'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-sm font-bold sm:col-span-2 lg:col-span-3">الماركات أو الموديلات المفضلة<textarea name="makes_models" rows={2} className={field} placeholder="اختياري، افصل بين الموديلات بفاصلة."/></label>
        <label className="text-sm font-bold">سنة الصنع من<input name="model_year_min" type="number" min={1950} max={2100} className={field}/></label><label className="text-sm font-bold">سنة الصنع إلى<input name="model_year_max" type="number" min={1950} max={2100} className={field}/></label>
        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2 lg:col-span-3"><legend className="px-1 text-sm font-bold">المحافظات المطلوبة</legend><div className="mt-2 flex flex-wrap gap-3">{['الإسكندرية','القاهرة','الجيزة','البحيرة','الشرقية','الدقهلية','القليوبية','أي محافظة'].map(c=><label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="governorates" value={c} className="h-4 w-4 accent-blue-700"/>{c}</label>)}</div></fieldset>
        <label className="text-sm font-bold">مدة الإيجار<select name="duration_type" className={field}><option value="monthly">شهري</option><option value="yearly">سنوي</option><option value="custom">مدة أخرى</option></select></label><label className="text-sm font-bold">عدد الشهور<input name="duration_months" type="number" min={1} max={120} defaultValue={12} className={field}/></label><label className="text-sm font-bold">تاريخ بدء الاحتياج<input name="start_date" type="date" className={field}/></label>
        <label className="text-sm font-bold">الميزانية الشهرية للسيارة (جنيه)<input name="budget_per_vehicle_egp" type="number" min={0} step="100" className={field}/></label><label className="text-sm font-bold">الميزانية الإجمالية (جنيه)<input name="total_budget_egp" type="number" min={0} step="100" className={field}/></label>
        <label className="text-sm font-bold">مستوى التفويض<select name="delegation_level" defaultValue="full_coordination" className={field}><option value="recommendations">بحث وتجهيز ترشيحات</option><option value="supplier_quotes">بحث والتواصل وجمع عروض الأسعار</option><option value="full_coordination">تفويض كامل حتى تجهيز الخيارات للمقارنة</option></select></label>
        <label className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-900"><input name="urgency" type="checkbox" className="h-4 w-4"/> أحتاج الخدمة بشكل عاجل</label>
        <label className="text-sm font-bold sm:col-span-2 lg:col-span-3">تفاصيل إضافية وشروط التشغيل<textarea name="requirements" rows={3} maxLength={5000} className={field} placeholder="ساعات التشغيل، سائق، GPS، نوع الوقود أو شروط خاصة."/></label>
        <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2 lg:col-span-3"><h3 className="font-extrabold">رسوم خدمة My Car</h3><p className="mt-2 text-sm leading-6 text-slate-600">رسوم الخدمة منفصلة عن إيجار السيارات. يعرض الفريق السعر النهائي ونطاق العمل قبل موافقتك والدفع.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">نظام الرسوم<select name="payment_model" className={field}><option value="per_request">رسوم لكل طلب</option><option value="subscription">باقة شهرية</option></select></label><label className="text-sm font-bold">الباقة الشهرية<select name="package_id" className={field}><option value="">اختر باقة</option>{activePackages.map(p=><option key={p.id} value={p.id}>{p.name} — {money(p.monthly_price_egp)} شهريًا — {p.included_requests} طلبات</option>)}</select></label></div><p className="mt-2 text-xs leading-6 text-slate-500">الرسوم الإرشادية: {pricing.filter(p=>p.is_active).map(p=>p.name+': '+money(p.service_fee_egp)).join(' · ')||'يحددها الفريق بعد مراجعة الطلب'}؛ السعر النهائي هو السعر المعتمد في عرض الخدمة.</p></div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3"><button disabled={saving} className={primary}><Plus size={17}/>{saving?'جارٍ الإرسال...':'إرسال طلب التوفير'}</button><span className="text-xs leading-5 text-slate-500">إرسال الطلب لا ينشئ التزامًا ماليًا، ويبدأ العمل بعد موافقتك وتأكيد السداد.</span></div>
      </form></section>}
    {adminRoute&&<section className="mb-8 grid gap-5 xl:grid-cols-2">
      <div className="rounded-3xl border bg-white p-5"><h2 className="text-lg font-extrabold">تسعير كل طلب</h2><p className="mt-1 text-xs leading-6 text-slate-500">الأسعار المبدئية إرشادية وليست دراسة سوق. راجعها قبل تقديم الخدمة تجاريًا.</p><div className="mt-4 space-y-3">{pricing.map(row=><form key={row.id} onSubmit={e=>void savePricing(e,row)} className="rounded-2xl border p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">اسم الشريحة<input name="name" defaultValue={row.name} className={field}/></label><label className="text-xs font-bold">رسوم الخدمة<input name="service_fee_egp" type="number" min={0} step="50" defaultValue={row.service_fee_egp} className={field}/></label><label className="text-xs font-bold">الحد الأدنى<input name="min_vehicles" type="number" min={1} defaultValue={row.min_vehicles} className={field}/></label><label className="text-xs font-bold">الحد الأقصى (فارغ = بلا حد)<input name="max_vehicles" type="number" min={1} defaultValue={row.max_vehicles??''} className={field}/></label><label className="text-xs font-bold">مضاعف العاجل<input name="urgency_multiplier" type="number" min={1} step="0.1" defaultValue={row.urgency_multiplier} className={field}/></label><label className="flex items-center gap-2 text-xs font-bold"><input name="is_active" type="checkbox" defaultChecked={row.is_active}/> مفعلة</label><label className="text-xs font-bold sm:col-span-2">الوصف<textarea name="description" defaultValue={row.description} rows={2} className={field}/></label></div><button disabled={saving} className={primary+' mt-3'}>حفظ الشريحة</button></form>)}</div></div>
      <div className="rounded-3xl border bg-white p-5"><h2 className="text-lg font-extrabold">الباقات الشهرية</h2><p className="mt-1 text-xs leading-6 text-slate-500">غير مفعلة افتراضيًا حتى مراجعة السعر والحدود.</p><div className="mt-4 space-y-3">{packages.map(row=><form key={row.id} onSubmit={e=>void savePackage(e,row)} className="rounded-2xl border p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">اسم الباقة<input name="name" defaultValue={row.name} className={field}/></label><label className="text-xs font-bold">السعر الشهري<input name="monthly_price_egp" type="number" min={0} step="100" defaultValue={row.monthly_price_egp} className={field}/></label><label className="text-xs font-bold">عدد الطلبات شهريًا<input name="included_requests" type="number" min={0} defaultValue={row.included_requests} className={field}/></label><label className="text-xs font-bold">حد السيارات لكل طلب<input name="included_vehicles_per_request" type="number" min={1} defaultValue={row.included_vehicles_per_request??''} className={field}/></label><label className="flex items-center gap-2 text-xs font-bold"><input name="is_active" type="checkbox" defaultChecked={row.is_active}/> مفعلة</label><label className="text-xs font-bold sm:col-span-2">الوصف<textarea name="description" defaultValue={row.description} rows={2} className={field}/></label></div><button disabled={saving} className={primary+' mt-3'}>حفظ الباقة</button></form>)}</div></div>
    </section>}
    <section className="rounded-3xl border bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">{adminRoute?'طلبات التوفير المُدار':'طلباتي المفوضة إلى My Car'}</h2><p className="mt-1 text-sm text-slate-500">{adminRoute?'راجع الطلبات والرسوم والحالة وعروض الموردين.':'تابع التقدم والرسوم والخيارات التي تحتاج إلى قرار منك.'}</p></div><div className="relative w-full sm:w-72"><Search className="absolute right-3 top-3 text-slate-400" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في الطلبات..." className="min-h-11 w-full rounded-xl border pr-10 pl-3 text-sm"/></div></div>
      <div className="mt-5 space-y-4">{visible.length===0?<div className="rounded-2xl border border-dashed p-8 text-center"><ClipboardList className="mx-auto text-slate-400" size={30}/><p className="mt-3 font-bold">لا توجد طلبات {search?'مطابقة':'حتى الآن'}</p><p className="mt-1 text-sm text-slate-500">{adminRoute?'ستظهر الطلبات الجديدة هنا.':'أنشئ طلبًا من النموذج بالأعلى.'}</p></div>:visible.map(request=>{
        const reqOffers=offers.filter(o=>o.request_id===request.id), reqUpdates=updates.filter(u=>u.request_id===request.id), reqActions=actions.filter(a=>a.request_id===request.id)
        return <article key={request.id} className="overflow-hidden rounded-2xl border"><button type="button" onClick={()=>setExpanded(expanded===request.id?null:request.id)} className="flex w-full flex-wrap items-start justify-between gap-3 bg-slate-50 p-4 text-right sm:p-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{request.title}</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{statusNames[request.status]||request.status}</span></div><p className="mt-2 text-xs leading-6 text-slate-500">{adminRoute?'معرف الشركة: '+request.company_organization_id+' · ':''}{request.quantity} سيارة · {request.vehicle_type} · {date(request.created_at)}</p></div><div className="text-left"><strong className="text-blue-800">{money(request.quoted_fee_egp)}</strong><p className="text-xs text-slate-500">رسوم خدمة البحث</p></div></button>
        {expanded===request.id&&<div className="space-y-5 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">المدة</span><p className="mt-1 font-bold">{request.duration_months} شهر · {request.start_date||'غير محدد'}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">ميزانية السيارة شهريًا</span><p className="mt-1 font-bold">{money(request.budget_per_vehicle_egp)}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">حالة رسوم الخدمة</span><p className="mt-1 font-bold">{payNames[request.payment_status]||request.payment_status}</p></div><div className="rounded-xl bg-slate-50 p-3 sm:col-span-2 lg:col-span-3"><span className="text-xs text-slate-500">المحافظات: </span>{(request.governorates||[]).join('، ')||'مرنة حسب التوافر'}<p className="mt-2 text-sm text-slate-600">الماركات: {(request.makes_models||[]).join('، ')||'بدون تفضيل'}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{request.requirements||'لا توجد متطلبات إضافية.'}</p></div></div>
          {!adminRoute&&request.status==='awaiting_company_approval'&&<div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><h4 className="font-extrabold">عرض رسوم الخدمة جاهز</h4><p className="mt-2 text-sm leading-6">رسوم My Car: <strong>{money(request.quoted_fee_egp)}</strong>. لا تشمل هذه الرسوم إيجار السيارات أو أي دفعات للموردين.</p><button disabled={saving} className={primary+' mt-3'} onClick={()=>void companyAction(request,'approve_quote','أوافق على نطاق الخدمة ورسومها.')}>موافقة على الرسوم والنطاق</button></div>}
          {!adminRoute&&(request.status==='awaiting_payment'||request.payment_status==='awaiting_payment'||request.payment_status==='rejected')&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void companyAction(request,'submit_payment_reference',String(f.get('payment_notes')||''),String(f.get('payment_reference')||''))}} className="rounded-xl border border-orange-200 bg-orange-50 p-4"><h4 className="font-extrabold">تسجيل سداد رسوم خدمة My Car</h4><p className="mt-1 text-sm leading-6">استخدم وسيلة الدفع المعتمدة التي يعرضها الفريق، ثم أرسل مرجع العملية. لا تحول إيجار السيارات من هذا النموذج.</p><label className="mt-3 block text-sm font-bold">مرجع التحويل أو رقم العملية *<input name="payment_reference" required minLength={3} maxLength={200} className={field}/></label><label className="mt-3 block text-sm font-bold">ملاحظات<textarea name="payment_notes" rows={2} className={field}/></label><button disabled={saving} className={primary+' mt-3'}>إرسال بيانات الدفع</button></form>}
          {!adminRoute&&request.status==='results_ready'&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h4 className="font-extrabold">الخيارات جاهزة</h4><p className="mt-1 text-sm leading-6">اختيارك يعني طلب متابعة الخيار فقط، ولا ينشئ عقد إيجار أو التزامًا ماليًا مع المورد.</p></div>}
          {adminRoute&&<form onSubmit={e=>void saveAdminRequest(e,request)} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><h4 className="font-extrabold">إدارة سير الطلب</h4><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-bold">الحالة<select name="status" defaultValue={request.status} className={field}>{states.map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select></label><label className="text-xs font-bold">رسوم الخدمة (جنيه)<input name="quoted_fee_egp" type="number" min={0} step="50" defaultValue={request.quoted_fee_egp??''} className={field}/></label><label className="text-xs font-bold">حالة الدفع<select name="payment_status" defaultValue={request.payment_status} className={field}>{Object.keys(payNames).map(s=><option key={s} value={s}>{payNames[s]}</option>)}</select></label><label className="text-xs font-bold">مسؤول المتابعة (معرف المستخدم)<input name="assigned_to" defaultValue={request.assigned_to||''} className={field} placeholder="UUID اختياري"/></label><label className="text-xs font-bold sm:col-span-2 lg:col-span-3">إضافة ملاحظة داخلية للفريق (لن تظهر للشركة)<textarea name="internal_note" rows={3} className={field} placeholder="أضف ملاحظة جديدة للفريق..."/></label></div><button disabled={saving} className={primary+' mt-3'}>حفظ الحالة والرسوم</button></form>}
          {adminRoute&&<div className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-extrabold">خيارات السيارات وعروض الموردين</h4><p className="mt-1 text-xs text-slate-500">أدخل فقط الأسعار والتوافر التي تم تأكيدها مع المورد.</p></div><button className={primary} onClick={()=>setOfferFor(offerFor===request.id?null:request.id)}><Plus size={16}/> إضافة خيار</button></div>{offerFor===request.id&&<form onSubmit={e=>void addOffer(e,request)} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">الماركة *<input name="make" required className={field}/></label><label className="text-xs font-bold">الموديل *<input name="model" required className={field}/></label><label className="text-xs font-bold">سنة الصنع<input name="model_year" type="number" min={1950} max={2100} className={field}/></label><label className="text-xs font-bold">نوع السيارة<input name="vehicle_type" className={field}/></label><label className="text-xs font-bold">عدد المقاعد<input name="seats" type="number" min={1} max={100} className={field}/></label><label className="text-xs font-bold">المحافظة<input name="governorate" className={field}/></label><label className="text-xs font-bold">السعر الشهري<input name="monthly_price_egp" type="number" min={0} className={field}/></label><label className="text-xs font-bold">السعر السنوي<input name="yearly_price_egp" type="number" min={0} className={field}/></label><label className="text-xs font-bold">التوافر<select name="availability_status" className={field}><option value="awaiting_confirmation">بانتظار التأكيد</option><option value="available">متاحة ومؤكدة</option><option value="limited">توافر محدود</option><option value="unavailable">غير متاحة</option></select></label><label className="text-xs font-bold">حالة التواصل<select name="outreach_status" className={field}><option value="contacted">تم التواصل</option><option value="waiting_reply">بانتظار الرد</option><option value="price_received">تم استلام السعر</option><option value="confirmed">تم التأكيد</option><option value="unavailable">غير متاح</option><option value="not_contacted">لم يتم التواصل</option></select></label><label className="text-xs font-bold sm:col-span-2">شروط العرض<textarea name="terms" rows={2} className={field}/></label><label className="text-xs font-bold sm:col-span-2">ملاحظات داخلية<textarea name="notes" rows={2} className={field}/></label><button disabled={saving} className={primary+' sm:col-span-2'}>حفظ الخيار</button></form>}</div>}
          {reqOffers.length>0&&<div><h4 className="mb-3 font-extrabold">خيارات السيارات ({reqOffers.length})</h4><div className="space-y-3">{reqOffers.map(o=>renderOffer(o,request))}</div></div>}
          {adminRoute&&reqActions.length>0&&<div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4"><h4 className="font-extrabold">إجراءات الشركة</h4><div className="mt-3 space-y-2">{reqActions.map(a=><div key={a.id} className="rounded-xl bg-white p-3 text-sm"><strong>{({approve_quote:'موافقة على الرسوم',submit_payment_reference:'مرجع دفع مرسل',select_offer:'اختيار عرض',request_alternatives:'طلب بدائل',change_requirements:'تعديل الاحتياج',cancel_request:'إلغاء الطلب',question:'استفسار'} as Record<string,string>)[a.action_type]||a.action_type}</strong>{a.payment_reference&&<p className="mt-1">مرجع الدفع: {a.payment_reference}</p>}{a.message&&<p className="mt-1 leading-6 text-slate-600">{a.message}</p>}<p className="mt-1 text-[11px] text-slate-400">{date(a.created_at)}</p></div>)}</div></div>}
          {reqUpdates.length>0&&<div><h4 className="mb-3 font-extrabold">سجل التحديثات</h4><div className="space-y-2">{reqUpdates.map(u=><div key={u.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{u.title}</strong><span className="text-[11px] text-slate-400">{date(u.created_at)}</span></div>{u.body&&<p className="mt-1 text-sm leading-6 text-slate-600">{u.body}</p>}</div>)}</div></div>}
          {adminRoute&&internalNotes.filter(n=>n.request_id===request.id).length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><strong>ملاحظات الفريق الداخلية:</strong><ul className="mt-2 list-disc space-y-2 pr-5">{internalNotes.filter(n=>n.request_id===request.id).map(n=><li key={n.id}>{n.note} <span className="text-[11px] text-amber-700">({date(n.created_at)})</span></li>)}</ul></div>}
        </div>}
      </article>
      })}</div>
    </section>
    <p className="mt-5 text-xs leading-6 text-slate-500">My Car وسيط بحث وتنسيق فقط. يجب تأكيد التوافر والسعر مع المورد، ولا تضمن المنصة إتمام عقد إيجار. رسوم الخدمة منفصلة عن الإيجار؛ التعاقد والدفع للإيجار يتمان بين الشركة والمورد خارج المنصة.</p>
  </div></main>
}
