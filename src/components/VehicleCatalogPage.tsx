import { useEffect, useMemo, useState } from 'react'
import { CircleUserRound, ArrowLeft, BadgeCheck, Bot, CarFront, Check, ChevronDown, CircleHelp, Filter, MessageCircle, Search, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type Vehicle = {
  id: string; make: string; model: string; model_year: number; vehicle_type: string; transmission: string;
  seats: number; governorate: string; monthly_price_egp: number; yearly_price_egp: number | null;
  with_driver: boolean; has_gps: boolean | null; notes: string | null; organization_id: string; images: { url: string; alt_text: string }[]
}
type AdPlan = { id: string; name: string; description: string; duration_days: number; price_egp: number; features: string[] }
type OwnedVehicle = { id: string; make: string; model: string; model_year: number; review_status: string }

const money = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value)
const questions = [
  { title: 'كيف أبحث عن سيارة مناسبة؟', answer: 'استخدم أدوات البحث والتصفية حسب النوع والمحافظة والسعر، ثم افتح تفاصيل السيارة لمراجعة المواصفات المتاحة.' },
  { title: 'كيف يمكنني بدء التواصل؟', answer: 'افتح تفاصيل السيارة واختر «بدء محادثة». يتم التواصل من خلال My Car مع الحفاظ على خصوصية بيانات الاتصال الشخصية.' },
  { title: 'هل كل السيارات معتمدة؟', answer: 'الكتالوج يعرض السيارات التي اجتازت مراجعة الإدارة وحالة الرسوم المطلوبة فقط.' },
  { title: 'كيف أرسل طلب عرض؟', answer: 'من صفحة تفاصيل السيارة، اختر «إرسال عرض» وأضف المدة والكمية والسعر المقترح أو تفاصيل احتياجك لإرسال الطلب عبر المنصة.' },
  { title: 'كيف يمكنني تعزيز ظهور سيارتي؟', answer: 'ملاك السيارات وموردو الأساطيل يمكنهم الاطلاع على باقات الظهور الإعلاني المتاحة من مساحة العمل. الترويج لا يُفعّل إلا بعد اعتماد الطلب والتحقق من الدفع.' },
  { title: 'كيف أسجل سيارة جديدة؟', answer: 'افتح مساحة العمل الخاصة بك، ثم اختر إضافة سيارة وأدخل بياناتها وارفع صورًا واضحة. لن تظهر السيارة في الكتالوج إلا بعد مراجعة الإدارة واعتماد البيانات واستكمال حالة الرسوم المطلوبة.' },
  { title: 'متى يتم تفعيل الإعلان؟', answer: 'بعد اختيار الباقة وإرسال طلب الترويج، تراجع الإدارة الطلب وتتحقق من الدفع. لا يظهر الإعلان في مقدمة الكتالوج قبل اعتماد الطلب وتأكيد الدفع أو الإعفاء.' },
  { title: 'هل تظهر بيانات الاتصال الخاصة بالمالك؟', answer: 'لا، لا يعرض الكتالوج رقم هاتف المالك أو بيانات الاتصال الشخصية. التواصل بين الشركة ومقدم السيارة يتم عبر المحادثات داخل منصة My Car.' },
  { title: 'ما أنواع الحسابات المتاحة؟', answer: 'تدعم My Car ثلاثة أنواع من الحسابات: مالك سيارة فردي، شركة تبحث عن سيارات للتأجير طويل الأجل، ومورد أسطول. تختلف مساحة العمل والأدوات حسب نوع الحساب.' }
]

export default function VehicleCatalogPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [plans, setPlans] = useState<AdPlan[]>([])
  const [myVehicles, setMyVehicles] = useState<OwnedVehicle[]>([])
  const [promotedIds, setPromotedIds] = useState<string[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedPromotionVehicle, setSelectedPromotionVehicle] = useState('')
  const [submittingPromotion, setSubmittingPromotion] = useState(false)
  const [userId, setUserId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [orgType, setOrgType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const [type, setType] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('vehicle_type') || ''
    const translated: Record<string, string> = { sedan: 'سيدان', suv: 'SUV', van: 'فان', bus: 'أتوبيس', truck: 'نقل خفيف' }
    return translated[requested.toLowerCase()] || requested || 'الكل'
  })
  const [city, setCity] = useState(() => new URLSearchParams(window.location.search).get('governorate') || 'الكل')
  const [maxPrice, setMaxPrice] = useState(() => new URLSearchParams(window.location.search).get('max_price') || '')
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [showOffer, setShowOffer] = useState(false)
  const [offerText, setOfferText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [botOpen, setBotOpen] = useState(false)
  const [botInput, setBotInput] = useState('')
  const [botMessages, setBotMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [botReplying, setBotReplying] = useState(false)
  const [showPlans, setShowPlans] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { window.location.replace('/?login=1'); return }
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { window.location.replace('/?login=1'); return }
      const { data: membership, error: memberError } = await supabase.from('organization_memberships').select('organization_id').eq('user_id', auth.user.id).limit(1).maybeSingle()
      if (memberError || !membership?.organization_id) { if (active) { setError('أكمل إعداد حسابك وربطه بمؤسسة حتى تتمكن من استخدام الكتالوج.'); setLoading(false) } return }
      const { data: org } = await supabase.from('organizations').select('organization_type').eq('id',membership.organization_id).maybeSingle()
      if (!active) return
      setUserId(auth.user.id); setOrgId(membership.organization_id); setOrgType(String(org?.organization_type || ''))
      const { data, error: listError } = await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,transmission,seats,governorate,monthly_price_egp,yearly_price_egp,with_driver,has_gps,notes,organization_id').eq('review_status','approved').in('payment_status',['verified','waived']).order('created_at',{ascending:false})
      if (listError) setError('تعذر تحميل الكتالوج: '+listError.message)
      const rows = (data || []) as Omit<Vehicle,'images'>[]
      const imageRows = rows.length ? await supabase.from('vehicle_images').select('vehicle_id,storage_path,alt_text,sort_order').in('vehicle_id',rows.map(v=>v.id)).order('sort_order',{ascending:true}) : { data: [], error: null }
      const signed = await Promise.all((imageRows.data || []).map(async image => {
        const result = await supabase!.storage.from('vehicle-images').createSignedUrl(image.storage_path,3600)
        return result.error || !result.data?.signedUrl ? null : { vehicle_id:image.vehicle_id,url:result.data.signedUrl,alt_text:image.alt_text }
      }))
      if (active) setVehicles(rows.map(v=>({...v,images:signed.filter((img):img is {vehicle_id:string;url:string;alt_text:string}=>Boolean(img&&img.vehicle_id===v.id)).map(img=>({url:img.url,alt_text:img.alt_text}))})))
      const { data: adPlans } = await supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features').eq('is_active',true).order('display_order')
      if (active) setPlans((adPlans || []) as AdPlan[])
      if (['individual_owner','fleet_supplier'].includes(String(org?.organization_type || ''))) {
        const { data: owned } = await supabase.from('vehicles').select('id,make,model,model_year,review_status').eq('organization_id',membership.organization_id).eq('review_status','approved').order('created_at',{ascending:false})
        if (active) setMyVehicles((owned || []) as OwnedVehicle[])
      }
      const { data: promotions } = await supabase.from('vehicle_promotions').select('vehicle_id,starts_at,ends_at').eq('status','approved').in('payment_status',['verified','waived'])
      if (active) {
        const now = Date.now()
        const promoted = (promotions || [])
          .filter(p => (!p.starts_at || new Date(p.starts_at).getTime() <= now) && (!p.ends_at || new Date(p.ends_at).getTime() > now))
          .map(p => p.vehicle_id)
        setPromotedIds(promoted)
        setVehicles(current => [...current].sort((a,b) => Number(promoted.includes(b.id))-Number(promoted.includes(a.id))))
      }
      if (active) setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => vehicles.filter(v => {
    const term = search.trim().toLowerCase()
    const matchesTerm = !term || `${v.make} ${v.model} ${v.model_year} ${v.vehicle_type} ${v.governorate}`.toLowerCase().includes(term)
    return matchesTerm && (type === 'الكل' || v.vehicle_type === type) && (city === 'الكل' || v.governorate === city) && (!maxPrice || v.monthly_price_egp <= Number(maxPrice))
  }), [vehicles,search,type,city,maxPrice])
  const types = useMemo(() => ['الكل',...Array.from(new Set(vehicles.map(v=>v.vehicle_type)))], [vehicles])
  const cities = useMemo(() => ['الكل',...Array.from(new Set(vehicles.map(v=>v.governorate)))], [vehicles])

  async function startConversation() {
    if (!supabase || !selected || !orgId || !userId) return
    if (orgType !== 'company') { setError('بدء محادثة مباشرة مع مالك السيارة متاح لحسابات الشركات.'); return }
    if (selected.organization_id === orgId) { setError('لا يمكنك بدء محادثة مع مؤسستك نفسها.'); return }
    setSending(true); setError('')
    const { data: existing, error: lookupError } = await supabase
      .from('conversations')
      .select('id')
      .eq('vehicle_id', selected.id)
      .eq('company_organization_id', orgId)
      .eq('provider_organization_id', selected.organization_id)
      .eq('status', 'open')
      .maybeSingle()
    if (lookupError) {
      setError('تعذر التحقق من المحادثة الحالية. تأكد من تحديث قاعدة البيانات ثم حاول مجددًا.')
      setSending(false)
      return
    }
    let conversationId = existing?.id
    let isNewConversation = false
    if (!conversationId) {
      const { data, error: createError } = await supabase.from('conversations').insert({
        request_id: null,
        vehicle_id: selected.id,
        company_organization_id: orgId,
        provider_organization_id: selected.organization_id,
        created_by: userId,
        status: 'open'
      }).select('id').single()
      if (createError) {
        // A second company member may have created this conversation at the same time.
        if (createError.code === '23505') {
          const { data: raced } = await supabase
            .from('conversations')
            .select('id')
            .eq('vehicle_id', selected.id)
            .eq('company_organization_id', orgId)
            .eq('provider_organization_id', selected.organization_id)
      .eq('status', 'open')
            .maybeSingle()
          conversationId = raced?.id
        }
        if (!conversationId) {
          setError('تعذر بدء المحادثة. تأكد من تحديث قاعدة البيانات ثم حاول مجددًا.')
          setSending(false)
          return
        }
      } else {
        conversationId = data.id
        isNewConversation = true
      }
    }
    const initial = offerText.trim() || (isNewConversation
      ? `مرحبًا، أود الاستفسار عن السيارة ${selected.make} ${selected.model} ${selected.model_year}.`
      : '')
    if (initial) {
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_organization_id: orgId,
        sender_id: userId,
        body: initial
      })
      if (messageError) {
        setSending(false)
        setError('تم فتح المحادثة لكن تعذر إرسال الرسالة الأولى: ' + messageError.message)
        return
      }
    }
    setSending(false)
    window.location.href = '/messages?conversation=' + conversationId
  }

  async function requestPromotion() {
    if (!supabase || !selectedPlanId || !selectedPromotionVehicle || !userId || !orgId) return
    setSubmittingPromotion(true); setError('')
    const { error: insertError } = await supabase.from('vehicle_promotions').insert({
      vehicle_id: selectedPromotionVehicle, organization_id: orgId, advertising_plan_id: selectedPlanId,
      created_by: userId, status: 'pending_review', payment_status: 'pending'
    })
    setSubmittingPromotion(false)
    if (insertError) { setError('تعذر إرسال طلب الترويج: ' + insertError.message); return }
    setNotice('تم إرسال طلب الترويج للمراجعة. لن يظهر الإعلان قبل اعتماد الإدارة والتحقق من حالة الدفع.')
    setSelectedPlanId(''); setSelectedPromotionVehicle(''); setShowPlans(false)
  }

  function sendBotMessage(question: string) {
    const submitted = question.trim()
    if (!submitted || botReplying) return
    setBotMessages(previous => [...previous, { role: 'user', text: submitted }])
    setBotInput('')
    setBotReplying(true)
    window.setTimeout(() => {
      const match = questions.find(q => q.title === submitted)
      const normalized = submitted.toLowerCase()
        .normalize('NFD')
        .replace(/[\\u064B-\\u065F\\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[؟?!.,،]/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim()
      let answer = match?.answer || ''
      if (!answer && /تسجيل|اسجل|اضافه سياره|سياره جديده|ارفع صور/.test(normalized)) answer = questions[5].answer
      if (!answer && /خصوصيه|رقم|هاتف|تليفون|بيانات المالك|بيانات الاتصال/.test(normalized)) answer = questions[7].answer
      if (!answer && /حساب|انواع الحساب|نوع الحساب|مورد اسطول|مالك سياره|شركه/.test(normalized)) answer = questions[8].answer
      if (!answer && /دفع|فلوس|تحويل|تفعيل الاعلان|امتي يظهر|متي يظهر|اعتماد الاعلان/.test(normalized)) answer = questions[6].answer
      if (!answer && /بحث|ابحث|فلتر|مدينه|سعر|نوع/.test(normalized)) answer = questions[0].answer
      if (!answer && /محادث|شات|تواصل|رساله|رسائل/.test(normalized)) answer = questions[1].answer
      if (!answer && /اعتماد|معتمد|مراجعه/.test(normalized)) answer = questions[2].answer
      if (!answer && /عرض|تاجير|طلب/.test(normalized)) answer = questions[3].answer
      if (!answer && /اعلان|ترويج|باق/.test(normalized)) answer = questions[4].answer
      if (!answer) answer = 'أقدر أساعدك في البحث عن سيارة، تسجيل سيارة جديدة، إرسال عرض، بدء محادثة، خصوصية البيانات، أو باقات الإعلان. جرّب صياغة سؤالك بشكل أوضح أو اختار أحد الاقتراحات.'
      setBotMessages(previous => [...previous, { role: 'assistant', text: answer }])
      setBotReplying(false)
    }, 250)
  }

  return <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4fb_48%,#f8fafc_100%)] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <PlatformBrand />
        <nav className="hidden items-center gap-2 md:flex"><a href="/messages" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">المحادثات</a><a href="/services" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">خدمات السيارات</a><a href={orgType==='company'?'/workspace/company':orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">مساحة عملك</a><a href="/workspace/advertising-plans" className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-800">باقات الظهور الإعلاني</a></nav>
        <div className="flex items-center gap-2"><AccountNotifications/><a href={orgType==='company'?'/workspace/company':orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="hidden items-center gap-2 rounded-xl border border-cyan-200 bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_0_16px_rgba(34,211,238,.22)] sm:inline-flex"><span className="grid h-7 w-7 place-items-center rounded-full border border-cyan-300 text-cyan-200"><CircleUserRound size={16}/></span>مساحة عملك</a></div>
      </div>
    </header>
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,.35),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,.18),transparent_30%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_.9fr]">
        <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-blue-100"><Sparkles size={15}/> كتالوج السيارات المعتمدة</span><h1 className="mt-5 max-w-2xl text-3xl font-black leading-[1.6] sm:text-5xl sm:leading-[1.45]">اعثر على السيارة المناسبة لاحتياجات شركتك <span className="text-blue-300">بوضوح وثقة.</span></h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">تصفح مواصفات السيارات المعتمدة، قارن الخيارات، وابدأ التواصل داخل المنصة دون إظهار بيانات المالك الشخصية.</p><div className="mt-6 flex flex-wrap gap-3"><a href="#catalog" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950">استكشف السيارات <ArrowLeft size={17}/></a><button onClick={()=>setBotOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/25 px-5 font-bold text-white"><CircleHelp size={17}/> تحتاج إلى مساعدة؟</button></div></div>
        <div className="relative min-h-[230px] sm:min-h-[300px]"><div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-400/20 via-slate-800 to-slate-900 ring-1 ring-white/10"/><img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85" alt="سيارة حديثة" className="absolute inset-0 h-full w-full rounded-[2rem] object-cover opacity-85 motion-safe:animate-[catalogFloat_7s_ease-in-out_infinite]"/><div className="absolute bottom-4 right-4 rounded-2xl border border-white/20 bg-slate-950/75 p-4 backdrop-blur"><p className="text-xs text-blue-100">منصة واحدة</p><p className="mt-1 text-lg font-extrabold">كتالوج · عروض · محادثات</p></div></div>
      </div>
    </section>
    <section id="catalog" className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">اختيار أسرع</p><h2 className="mt-1 text-2xl font-black">السيارات المتاحة</h2><p className="mt-2 text-sm text-slate-500">تظهر هنا السيارات المعتمدة والمستوفية لشروط الإتاحة فقط.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200" aria-live="polite">{filtered.length} سيارة</span>{(search || type !== 'الكل' || city !== 'الكل' || maxPrice) && <button type="button" onClick={() => { setSearch(''); setType('الكل'); setCity('الكل'); setMaxPrice('') }} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">مسح الفلاتر</button>}</div></div>
      <div className="mt-5 grid gap-3 rounded-3xl border border-white bg-white/95 p-4 shadow-lg shadow-slate-200/60 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <label className="relative block"><Search size={17} className="absolute right-3 top-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 pe-10 ps-3 text-sm outline-none focus:border-blue-600" placeholder="ابحث عن ماركة أو موديل أو مدينة"/></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Filter size={16} className="text-slate-400"/><select value={type} onChange={e=>setType(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none">{types.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><ChevronDown size={16} className="text-slate-400"/><select value={city} onChange={e=>setCity(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none">{cities.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><span className="whitespace-nowrap text-xs text-slate-500">حتى جنيه/شهر</span><input type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} className="min-h-12 w-full min-w-0 bg-transparent text-sm outline-none" placeholder="السعر"/></label>
      </div>
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700">{error}</p>}
      {notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
      {loading?<div className="py-16 text-center text-slate-500">جارٍ تحميل السيارات المعتمدة...</div>:filtered.length===0?<div className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center"><CarFront size={34} className="mx-auto text-slate-300"/><h3 className="mt-3 font-extrabold">لا توجد سيارات مطابقة</h3><p className="mt-2 text-sm text-slate-500">غيّر خيارات البحث أو ارجع لاحقًا عند إضافة سيارات معتمدة.</p><button onClick={()=>{setSearch('');setType('الكل');setCity('الكل');setMaxPrice('')}} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold">مسح الفلاتر</button></div>:<div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(v=><article key={v.id} className="group overflow-hidden rounded-3xl border border-white bg-white shadow-md shadow-slate-200/60 transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/10">
        <button onClick={()=>{setSelected(v);setShowOffer(false);setOfferText('');setError('')}} className="block w-full text-right"><div className="relative h-52 bg-slate-100">{promotedIds.includes(v.id)&&<span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950"><Sparkles size={13}/> إعلان مميز</span>}{v.images[0]?<img src={v.images[0].url} alt={v.images[0].alt_text||v.make+' '+v.model} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>:<div className="grid h-full place-items-center text-slate-300"><CarFront size={42}/><span className="text-xs">الصورة غير متاحة</span></div>}<span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-emerald-800"><BadgeCheck size={14}/> معتمدة</span></div><div className="p-5"><div className="flex items-start justify-between gap-2"><h3 className="text-lg font-extrabold">{v.make} {v.model}</h3><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{v.model_year}</span></div><p className="mt-2 text-sm text-slate-500">{v.vehicle_type} · {v.governorate} · {v.seats} مقاعد</p><p className="mt-4 text-xl font-black text-blue-800">{money(Number(v.monthly_price_egp))} <span className="text-xs font-bold text-slate-500">جنيه / شهر</span></p><p className="mt-3 text-sm font-bold text-blue-700">عرض التفاصيل <ArrowLeft size={14} className="inline"/></p></div></button>
      </article>)}</div>}
    </section>
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6"><div className="grid gap-4 rounded-3xl border border-blue-100 bg-[linear-gradient(120deg,#eff6ff_0%,#ffffff_70%)] p-6 shadow-sm shadow-blue-100 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><h2 className="text-xl font-black">هل ترغب في تعزيز ظهور سياراتك داخل الكتالوج؟</h2><p className="mt-2 text-sm leading-7 text-slate-600">تساعد باقات الظهور الإعلاني على إبراز سياراتك في الكتالوج، ويخضع تفعيل كل طلب لمراجعة الإدارة.</p></div><a href="/workspace/advertising-plans" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white"><Sparkles size={17}/> استكشف الباقات</a></div></section>
    {selected&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="تفاصيل السيارة"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-700">تفاصيل السيارة المعتمدة</p><h2 className="mt-1 text-2xl font-black">{selected.make} {selected.model} · {selected.model_year}</h2></div><button onClick={()=>setSelected(null)} aria-label="إغلاق" className="rounded-xl border p-2"><X size={19}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="overflow-hidden rounded-2xl bg-slate-100 sm:col-span-2">{selected.images[0]&&<img src={selected.images[0].url} alt={selected.images[0].alt_text||'صورة السيارة'} className="h-64 w-full object-cover"/>}</div>{[['نوع السيارة',selected.vehicle_type],['المحافظة',selected.governorate],['سنة الصنع',String(selected.model_year)],['ناقل الحركة',selected.transmission],['عدد المقاعد',String(selected.seats)],['السائق',selected.with_driver?'متاح بسائق':'بدون سائق'],['نظام GPS',selected.has_gps===null?'لم يتم تحديده بعد':selected.has_gps?'مزودة بجهاز GPS':'غير مزودة بجهاز GPS']].map(([k,val])=><div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 font-bold">{val}</p></div>)}</div>{selected.notes&&<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{selected.notes}</p>}<div className="mt-5 rounded-2xl bg-blue-50 p-4"><p className="text-sm text-slate-600">السعر الشهري</p><p className="mt-1 text-2xl font-black text-blue-800">{money(Number(selected.monthly_price_egp))} جنيه</p>{selected.yearly_price_egp&&<p className="mt-1 text-sm font-bold text-slate-600">السعر السنوي: {money(Number(selected.yearly_price_egp))} جنيه</p>}</div><p className="mt-4 flex items-center gap-2 text-xs leading-6 text-slate-500"><ShieldCheck size={16}/> بيانات مالك السيارة ووسائل الاتصال الشخصية مخفية. التواصل متاح من خلال المحادثات داخل My Car فقط.</p>{showOffer&&<label className="mt-4 block text-sm font-bold">رسالتك أو تفاصيل العرض<textarea rows={3} maxLength={2000} value={offerText} onChange={e=>setOfferText(e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="اكتب المدة المطلوبة، عدد السيارات، أو السعر المقترح..."/></label>}<div className="mt-5 flex flex-col gap-3 sm:flex-row">{orgType==='company'&&<><button disabled={sending} onClick={()=>showOffer?void startConversation():setShowOffer(true)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white disabled:opacity-50"><Send size={17}/>{sending?'جارٍ الإرسال...':showOffer?'إرسال العرض وبدء المحادثة':'إرسال عرض'}</button><button disabled={sending} onClick={()=>{setOfferText('');void startConversation()}} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 font-extrabold"><MessageCircle size={17}/> بدء محادثة</button></>}{orgType!=='company'&&<a href={orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white">إدارة سياراتك والترويج لها</a>}</div></div></div>}
    {showPlans&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-black">باقات الظهور الإعلاني</h2><p className="mt-2 text-sm text-slate-500">خيارات مدفوعة لإبراز السيارات في بداية الكتالوج.</p></div><button onClick={()=>setShowPlans(false)} className="rounded-xl border p-2"><X size={18}/></button></div>{plans.length===0?<div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-bold">لا توجد باقات إعلانية متاحة حاليًا.</p><p className="mt-2 text-sm text-slate-500">سيتم عرض الباقات بعد اعتمادها من إدارة المنصة.</p></div>:<div className="mt-5 grid gap-4 sm:grid-cols-2">{plans.map(p=><article key={p.id} className="rounded-2xl border p-5"><h3 className="text-lg font-extrabold">{p.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{p.description}</p><p className="mt-4 text-2xl font-black text-blue-800">{money(p.price_egp)} جنيه</p><p className="mt-1 text-sm text-slate-500">لمدة {p.duration_days} يومًا</p><ul className="mt-3 space-y-2">{(p.features||[]).map(f=><li key={f} className="flex gap-2 text-sm"><Check size={16} className="text-emerald-600"/>{f}</li>)}</ul><button onClick={()=>setSelectedPlanId(p.id)} className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 font-bold text-white">طلب ترويج سيارة</button>{selectedPlanId===p.id&&<div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">{myVehicles.length===0?<p className="text-sm leading-6 text-slate-600">لا توجد سيارة معتمدة في حسابك حاليًا. أضف سيارة وانتظر اعتمادها أولًا.</p>:<><label className="block text-sm font-bold">اختر السيارة<select value={selectedPromotionVehicle} onChange={e=>setSelectedPromotionVehicle(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3"><option value="">اختر سيارة</option>{myVehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.model_year}</option>)}</select></label><button disabled={!selectedPromotionVehicle||submittingPromotion} onClick={()=>void requestPromotion()} className="min-h-11 w-full rounded-xl bg-blue-700 px-4 font-bold text-white disabled:opacity-50">{submittingPromotion?'جارٍ إرسال الطلب...':'إرسال طلب الترويج للمراجعة'}</button></>}</div>}</article>)}</div>}</div></div>}
    {botOpen&&<div className="fixed bottom-24 left-4 z-50 w-[min(92vw,390px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-slate-950 p-4 text-white"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600"><Bot size={22}/></span><div><p className="font-extrabold">مساعد My Car</p><p className="text-xs text-slate-300">اسأل أولًا وسأساعدك في الخطوة التالية</p></div></div><button onClick={()=>setBotOpen(false)} aria-label="إغلاق المساعد"><X size={18}/></button></div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4">
        {botMessages.length===0&&<div className="rounded-2xl bg-slate-50 p-3 text-sm leading-7 text-slate-600">اكتب سؤالك أو اختر اقتراحًا لملء خانة الرسالة. المساعد لن يرسل إجابة قبل إرسال سؤالك.</div>}
        {botMessages.map((message,index)=><div key={index} className={message.role==='user'?'mr-8 rounded-2xl bg-blue-700 p-3 text-sm leading-7 text-white':'ml-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-700'}>{message.text}</div>)}
        {botReplying&&<p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">المساعد يجهّز الرد...</p>}
        <div className="grid gap-2">{questions.map(q=><button key={q.title} onClick={()=>setBotInput(q.title)} className="rounded-xl border border-slate-200 p-2.5 text-right text-xs font-bold hover:border-blue-300 hover:bg-blue-50">{q.title}</button>)}</div>
      </div>
      <form onSubmit={e=>{e.preventDefault();sendBotMessage(botInput)}} className="flex gap-2 border-t bg-white p-3"><input value={botInput} onChange={e=>setBotInput(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm" placeholder="اكتب سؤالك ثم اضغط إرسال" aria-label="رسالتك للمساعد"/><button disabled={!botInput.trim()||botReplying} className="rounded-xl bg-blue-700 px-4 text-white disabled:opacity-40" aria-label="إرسال السؤال"><Send size={16}/></button></form>
    </div>}
    <button onClick={()=>setBotOpen(v=>!v)} className="fixed bottom-5 left-5 z-40 inline-flex min-h-14 items-center gap-2 rounded-full bg-blue-700 px-5 font-extrabold text-white shadow-xl transition hover:scale-105"><Bot size={22}/><span>{botOpen?'إغلاق المساعد':'اسأل مساعد My Car'}</span></button>
  </main>
}
