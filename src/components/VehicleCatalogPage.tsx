import { useEffect, useMemo, useState } from 'react'
import { CircleUserRound, ArrowLeft, BadgeCheck, Heart, Bot, CarFront, Check, ChevronDown, Filter, Menu, Megaphone, MessageCircle, Search, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type Vehicle = {
  id: string; make: string; model: string; model_year: number; vehicle_type: string; transmission: string;
  seats: number; governorate: string; license_expiry_date: string | null; monthly_price_egp: number; yearly_price_egp: number | null;
  with_driver: boolean; has_gps: boolean | null; notes: string | null; organization_id: string; images: { url: string; alt_text: string }[]
}
type AdPlan = { id: string; name: string; description: string; duration_days: number; price_egp: number; features: string[]; placement_type: 'standard' | 'premium' }
type OwnedVehicle = { id: string; make: string; model: string; model_year: number; review_status: string }

const money = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value)

export default function VehicleCatalogPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [plans, setPlans] = useState<AdPlan[]>([])
  const [myVehicles, setMyVehicles] = useState<OwnedVehicle[]>([])
  const [promotedIds, setPromotedIds] = useState<string[]>([])
  const [premiumPromotedIds, setPremiumPromotedIds] = useState<string[]>([])
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
    const translated: Record<string, string> = { sedan: 'سيدان', suv: 'SUV', van: 'فان / ميكروباص', bus: 'أتوبيس', truck: 'نقل' }
    return translated[requested.toLowerCase()] || requested || 'الكل'
  })
  const [city, setCity] = useState(() => new URLSearchParams(window.location.search).get('governorate') || 'الكل')
  const [maxPrice, setMaxPrice] = useState(() => new URLSearchParams(window.location.search).get('max_price') || '')
  const [makeFilter, setMakeFilter] = useState('الكل')
  const [minYear, setMinYear] = useState('')
  const [maxYear, setMaxYear] = useState('')
  const [minSeats, setMinSeats] = useState('')
  const [gpsFilter, setGpsFilter] = useState('الكل')
  const [sortBy, setSortBy] = useState('featured')
  const [page, setPage] = useState(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [pageSize, setPageSize] = useState(() => window.innerWidth < 640 ? 12 : 18)
  useEffect(() => {
    const updatePageSize = () => setPageSize(window.innerWidth < 640 ? 12 : 18)
    window.addEventListener('resize', updatePageSize)
    return () => window.removeEventListener('resize', updatePageSize)
  }, [])
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [showOffer, setShowOffer] = useState(false)
  const [offerText, setOfferText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [showPlans, setShowPlans] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { window.location.replace('/?login=1'); return }
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { window.location.replace('/?login=1'); return }
      const { data: membership, error: memberError } = await supabase.from('organization_memberships').select('organization_id').eq('user_id', auth.user.id).limit(1).maybeSingle()
      if (memberError || !membership?.organization_id) { if (active) { setError('أكمل إعداد حسابك وربطه بمؤسسة حتى تتمكن من استخدام الكتالوج.'); setLoading(false) } return }
      const { data: org } = await supabase.from('organizations').select('organization_type,approval_status').eq('id',membership.organization_id).maybeSingle()
      if (!active) return
      if (!['company','fleet_supplier','individual_owner'].includes(String(org?.organization_type || ''))) { window.location.replace('/workspace'); return }
      if (!org || org.approval_status !== 'approved') { setError('الكتالوج متاح للحسابات المعتمدة فقط. أكمل مراجعة حسابك أولًا.'); setLoading(false); return }
      setUserId(auth.user.id); setOrgId(membership.organization_id); setOrgType(String(org?.organization_type || ''))
      try {
        const savedFavorites = JSON.parse(localStorage.getItem(`mycar:favorites:${membership.organization_id}`) || '[]')
        setFavoriteIds(Array.isArray(savedFavorites) ? savedFavorites.filter((id): id is string => typeof id === 'string') : [])
      } catch { setFavoriteIds([]) }
      const { data, error: listError } = await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,transmission,seats,governorate,license_expiry_date,monthly_price_egp,yearly_price_egp,with_driver,has_gps,notes,organization_id').eq('review_status','approved').in('payment_status',['verified','waived']).order('created_at',{ascending:false})
      if (listError) setError('تعذر تحميل الكتالوج: '+listError.message)
      const rows = (data || []) as Omit<Vehicle,'images'>[]
      const imageRows = rows.length ? await supabase.from('vehicle_images').select('vehicle_id,storage_path,alt_text,sort_order').in('vehicle_id',rows.map(v=>v.id)).order('sort_order',{ascending:true}) : { data: [], error: null }
      const signed = await Promise.all((imageRows.data || []).map(async image => {
        const result = await supabase!.storage.from('vehicle-images').createSignedUrl(image.storage_path,3600)
        return result.error || !result.data?.signedUrl ? null : { vehicle_id:image.vehicle_id,url:result.data.signedUrl,alt_text:image.alt_text }
      }))
      if (active) setVehicles(rows.map(v=>({...v,images:signed.filter((img):img is {vehicle_id:string;url:string;alt_text:string}=>Boolean(img&&img.vehicle_id===v.id)).map(img=>({url:img.url,alt_text:img.alt_text}))})))
      const { data: adPlans } = await supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features,placement_type').eq('is_active',true).order('display_order')
      if (active) setPlans((adPlans || []) as AdPlan[])
      if (['individual_owner','fleet_supplier'].includes(String(org?.organization_type || ''))) {
        const { data: owned } = await supabase.from('vehicles').select('id,make,model,model_year,review_status').eq('organization_id',membership.organization_id).eq('review_status','approved').order('created_at',{ascending:false})
        if (active) setMyVehicles((owned || []) as OwnedVehicle[])
      }
      const { data: promotions } = await supabase.from('vehicle_promotions').select('vehicle_id,starts_at,ends_at,advertising_plans(placement_type)').eq('status','approved').in('payment_status',['verified','waived'])
      if (active) {
        const now = Date.now()
        const activePromotions = (promotions || []).filter(p => Boolean(p.starts_at && p.ends_at) && new Date(p.starts_at as string).getTime() <= now && new Date(p.ends_at as string).getTime() > now)
        const premium = activePromotions.filter(p => {
          const plan = Array.isArray(p.advertising_plans) ? p.advertising_plans[0] : p.advertising_plans
          return plan?.placement_type === 'premium'
        }).map(p => p.vehicle_id)
        const promoted = activePromotions.filter(p => {
          const plan = Array.isArray(p.advertising_plans) ? p.advertising_plans[0] : p.advertising_plans
          return plan?.placement_type !== 'premium'
        }).map(p => p.vehicle_id)
        setPremiumPromotedIds(premium)
        setPromotedIds(promoted)
        setVehicles(current => [...current].sort((a,b) => Number(premium.includes(b.id))-Number(premium.includes(a.id)) || Number(promoted.includes(b.id))-Number(promoted.includes(a.id))))
      }
      if (active) setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  const makes = useMemo(() => ['الكل', ...Array.from(new Set(vehicles.map(v => v.make))).sort((a,b) => a.localeCompare(b,'ar'))], [vehicles])
  const years = useMemo(() => Array.from(new Set(vehicles.map(v => v.model_year))).sort((a,b) => b-a), [vehicles])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const result = vehicles.filter(v => {
      const matchesTerm = !term || `${v.make} ${v.model} ${v.model_year} ${v.vehicle_type} ${v.governorate}`.toLowerCase().includes(term)
      const matchesType = type === 'الكل' || (type === 'فان / ميكروباص' ? ['فان','ميكروباص'].includes(v.vehicle_type) : type === 'نقل' ? v.vehicle_type.includes('نقل') : v.vehicle_type === type)
      return matchesTerm && matchesType && (city === 'الكل' || v.governorate === city) &&
        (!maxPrice || v.monthly_price_egp <= Number(maxPrice)) &&
        (makeFilter === 'الكل' || v.make === makeFilter) &&
        (!minYear || v.model_year >= Number(minYear)) && (!maxYear || v.model_year <= Number(maxYear)) &&
        (!minSeats || v.seats >= Number(minSeats)) &&
        (gpsFilter === 'الكل' || (gpsFilter === 'yes' ? v.has_gps === true : v.has_gps === false)) &&
        (!favoritesOnly || favoriteIds.includes(v.id))
    })
    return result.sort((a,b) => sortBy === 'price_asc' ? a.monthly_price_egp-b.monthly_price_egp :
      sortBy === 'price_desc' ? b.monthly_price_egp-a.monthly_price_egp :
      sortBy === 'year_desc' ? b.model_year-a.model_year :
      sortBy === 'seats_desc' ? b.seats-a.seats :
      Number(promotedIds.includes(b.id))-Number(promotedIds.includes(a.id)))
  }, [vehicles,search,type,city,maxPrice,makeFilter,minYear,maxYear,minSeats,gpsFilter,favoritesOnly,favoriteIds,sortBy,promotedIds])
  useEffect(() => { setPage(1) }, [search,type,city,maxPrice,makeFilter,minYear,maxYear,minSeats,gpsFilter,favoritesOnly,sortBy])
  const premiumVehicles = vehicles.filter(v => premiumPromotedIds.includes(v.id))
  const featuredVehicles = filtered.filter(v => promotedIds.includes(v.id) && !premiumPromotedIds.includes(v.id))
  const regularVehicles = filtered.filter(v => !promotedIds.includes(v.id) && !premiumPromotedIds.includes(v.id))
  const totalPages = Math.max(1, Math.ceil(regularVehicles.length / pageSize))
  const visibleRegularVehicles = regularVehicles.slice((page-1)*pageSize, page*pageSize)
  const types = useMemo(() => ['الكل',...Array.from(new Set([...vehicles.map(v=>v.vehicle_type),'فان / ميكروباص','نقل']))], [vehicles])
  const cities = useMemo(() => ['الكل',...Array.from(new Set(vehicles.map(v=>v.governorate)))], [vehicles])

  function toggleCompare(vehicleId: string) {
    const alreadyAdded = compareIds.includes(vehicleId)
    if (alreadyAdded) {
      setCompareIds(current => current.filter(id => id !== vehicleId))
      setNotice('تمت إزالة السيارة من المقارنة.')
      return
    }
    if (compareIds.length >= 3) {
      setNotice('يمكنك مقارنة 3 سيارات كحد أقصى. أزل سيارة أولًا لإضافة سيارة أخرى.')
      return
    }
    setCompareIds(current => [...current, vehicleId])
    const vehicle = vehicles.find(item => item.id === vehicleId)
    setNotice(vehicle ? `تمت إضافة ${vehicle.make} ${vehicle.model} للمقارنة بنجاح.` : 'تمت إضافة السيارة للمقارنة بنجاح.')
  }

  function toggleFavorite(vehicleId: string) {
    const next = favoriteIds.includes(vehicleId) ? favoriteIds.filter(id => id !== vehicleId) : [...favoriteIds, vehicleId]
    setFavoriteIds(next)
    if (orgId) localStorage.setItem(`mycar:favorites:${orgId}`, JSON.stringify(next))
  }

  async function startConversation(sendOffer = false) {
    if (!supabase || !selected || !orgId || !userId) {
      setError('تعذر التحقق من جلسة الدخول أو بيانات الشركة. حدّث الصفحة ثم حاول مرة أخرى.')
      return
    }
    if (!['company','fleet_supplier'].includes(orgType)) {
      setError('التواصل من خلال الكتالوج متاح للشركات وموردي الأساطيل المعتمدين فقط.')
      return
    }
    if (selected.organization_id === orgId) {
      setError('لا يمكنك إرسال عرض على سيارة تابعة لمؤسستك.')
      return
    }
    const messageBody = offerText.trim()
    if (sendOffer && !messageBody) {
      setError('اكتب تفاصيل العرض أو احتياج شركتك أولًا قبل الإرسال.')
      return
    }

    setSending(true)
    setError('')
    setNotice('')
    try {
      if (sendOffer && orgType === 'company') {
        // A single database transaction creates the formal company offer, conversation and first message.
        const { data, error: submitError } = await supabase.rpc('submit_company_vehicle_offer', {
          p_vehicle_id: selected.id,
          p_message: messageBody
        })
        if (submitError) throw new Error('تعذر تسجيل العرض وإرساله: ' + submitError.message)
        const result = data as { offer_id?: string; conversation_id?: string } | null
        if (!result?.offer_id || !result?.conversation_id) {
          throw new Error('لم يؤكد النظام تسجيل العرض. لم يتم تحويلك إلى المحادثة.')
        }
        window.location.href = '/messages?conversation=' + result.conversation_id
        return
      }

      const { data: existing, error: lookupError } = await supabase
        .from('conversations')
        .select('id')
        .eq('vehicle_id', selected.id)
        .eq('company_organization_id', orgId)
        .eq('provider_organization_id', selected.organization_id)
        .eq('status', 'open')
        .maybeSingle()
      if (lookupError) throw new Error('تعذر التحقق من محادثة السيارة: ' + lookupError.message)

      let conversationId = existing?.id
      if (!conversationId) {
        const { data, error: createError } = await supabase.from('conversations').insert({
          request_id: null,
          vehicle_id: selected.id,
          company_organization_id: orgId,
          provider_organization_id: selected.organization_id,
          created_by: userId,
          status: 'open'
        }).select('id').single()
        if (createError) throw new Error('تعذر إنشاء محادثة للسيارة: ' + createError.message)
        conversationId = data?.id
      }
      if (!conversationId) throw new Error('لم يتم إنشاء المحادثة. حاول مرة أخرى.')
      if (!existing?.id) {
        const { error: messageError } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_organization_id: orgId,
          sender_id: userId,
          body: sendOffer ? messageBody : `مرحبًا، أود الاستفسار عن السيارة ${selected.make} ${selected.model} ${selected.model_year}.`
        })
        if (messageError) throw new Error('تعذر إرسال رسالة بدء المحادثة: ' + messageError.message)
      }
      window.location.href = '/messages?conversation=' + conversationId
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع أثناء إرسال العرض.')
      setSending(false)
    }
  }

  async function requestPromotion() {
    // All advertising requests must use the dedicated payment-confirmation flow.
    // This prevents creating a promotion without transfer method/reference/date.
    setSubmittingPromotion(true)
    window.location.href = '/workspace/advertising-plans'
  }


  return <main dir="rtl" className="mc-catalog-main min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4fb_48%,#f8fafc_100%)] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <PlatformBrand />
        <nav className="hidden items-center gap-2 md:flex"><a href="/messages" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">المحادثات</a><a href="/services" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">خدمات السيارات</a><a href={orgType==='company'?'/workspace/company':orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">مساحة عملك</a><a href={orgType==='company'?'/workspace/company/managed-sourcing':orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/advertising-plans'} className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-800">{orgType==='company'?'خدمة البحث نيابةً عنك':orgType==='fleet_supplier'?'إدارة أسطولك':'باقات الإعلانات'}</a></nav>
        <div className="flex items-center gap-2"><button type="button" onClick={()=>setMobileNavOpen(value=>!value)} aria-label={mobileNavOpen?"إغلاق القائمة":"فتح القائمة"} aria-expanded={mobileNavOpen} aria-controls="catalog-mobile-navigation" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 md:hidden">{mobileNavOpen?<X size={19}/>:<Menu size={19}/>}</button><AccountNotifications/><a href={orgType==='company'?'/workspace/company':orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/owner/vehicles'} className="hidden items-center gap-2 rounded-xl border border-cyan-200 bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_0_16px_rgba(34,211,238,.22)] sm:inline-flex"><span className="grid h-7 w-7 place-items-center rounded-full border border-cyan-300 text-cyan-200"><CircleUserRound size={16}/></span>مساحة عملك</a></div>
      </div>
    </header>
    {mobileNavOpen&&<nav id="catalog-mobile-navigation" aria-label="التنقل الرئيسي للهاتف" className="sticky top-[65px] z-20 mx-3 mt-2 grid gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl md:hidden"><a onClick={()=>setMobileNavOpen(false)} href="/" className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">الرئيسية</a><a onClick={()=>setMobileNavOpen(false)} href="#catalog" className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">السيارات المتاحة</a><a onClick={()=>setMobileNavOpen(false)} href="/messages" className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">المحادثات</a><a onClick={()=>setMobileNavOpen(false)} href="/services" className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">خدمات السيارات</a><a onClick={()=>setMobileNavOpen(false)} href="/workspace/company/managed-sourcing" className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">خدمة البحث نيابةً عنك</a></nav>}
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,.35),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,.18),transparent_30%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_.9fr]">
        <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-blue-100"><Sparkles size={15}/> كتالوج السيارات المعتمدة</span><h1 className="mt-5 max-w-2xl text-3xl font-black leading-[1.6] sm:text-5xl sm:leading-[1.45]">{orgType === 'fleet_supplier' ? 'اعثر على سيارات توسّع أسطولك' : 'اعثر على السيارة المناسبة لاحتياجات شركتك'} <span className="text-blue-300">بوضوح وثقة.</span></h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">تصفح مواصفات السيارات المعتمدة، قارن الخيارات، وابدأ التواصل داخل المنصة دون إظهار بيانات المالك الشخصية. {orgType === 'fleet_supplier' ? 'يمكنك طلب سيارات من ملاك آخرين لتوسيع أسطولك.' : ''}</p><div className="mt-6 flex flex-wrap gap-3"><a href="#catalog" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950">استكشف السيارات <ArrowLeft size={17}/></a><a href="/assistant" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-cyan-300/40 bg-white/5 px-5 font-bold text-white hover:bg-white/10"><Sparkles size={17}/> مساعد My Car الذكي</a></div></div>
        <div className="relative min-h-[230px] sm:min-h-[300px]"><div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-400/20 via-slate-800 to-slate-900 ring-1 ring-white/10"/><img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85" onError={(event)=>{event.currentTarget.onerror=null;event.currentTarget.src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%201200%20650'%3E%3Cdefs%3E%3ClinearGradient%20id%3D'bg'%20x2%3D'1'%20y2%3D'1'%3E%3Cstop%20stop-color%3D'%25230d1b35'%2F%3E%3Cstop%20offset%3D'1'%20stop-color%3D'%25231d4ed8'%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D'body'%20x2%3D'0'%20y2%3D'1'%3E%3Cstop%20stop-color%3D'%2523f8fafc'%2F%3E%3Cstop%20offset%3D'.55'%20stop-color%3D'%252394a3b8'%2F%3E%3Cstop%20offset%3D'1'%20stop-color%3D'%2523334155'%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D'glass'%20x2%3D'0'%20y2%3D'1'%3E%3Cstop%20stop-color%3D'%25239de7ff'%2F%3E%3Cstop%20offset%3D'1'%20stop-color%3D'%25231e3a5f'%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D'1200'%20height%3D'650'%20fill%3D'url(%2523bg)'%2F%3E%3Ccircle%20cx%3D'930'%20cy%3D'120'%20r%3D'210'%20fill%3D'%252360a5fa'%20opacity%3D'.12'%2F%3E%3Cellipse%20cx%3D'600'%20cy%3D'520'%20rx%3D'430'%20ry%3D'38'%20fill%3D'%2523000'%20opacity%3D'.35'%2F%3E%3Cg%20transform%3D'translate(80%2090)'%3E%3Cpath%20d%3D'M170%20340%20250%20240Q290%20175%20405%20160L710%20165Q785%20170%20850%20255L940%20305Q975%20325%20980%20375L970%20430Q960%20465%20920%20465H160Q120%20455%20120%20415L130%20370Q135%20350%20170%20340Z'%20fill%3D'url(%2523body)'%20stroke%3D'%2523e2e8f0'%20stroke-width%3D'9'%2F%3E%3Cpath%20d%3D'm300%20245%2095-78q35-20%20100-20h185q60%200%2095%2055l55%2075-530-2Z'%20fill%3D'url(%2523glass)'%20stroke%3D'%2523e2e8f0'%20stroke-width%3D'8'%2F%3E%3Cpath%20d%3D'm535%20150%205%20130M770%20205l38%2068'%20stroke%3D'%2523dbeafe'%20stroke-width%3D'8'%2F%3E%3Cpath%20d%3D'M145%20350%20265%20330M860%20330l100%2020'%20stroke%3D'%2523fff'%20stroke-width%3D'14'%20stroke-linecap%3D'round'%2F%3E%3Cpath%20d%3D'M135%20395h95M875%20395h85'%20stroke%3D'%2523f8fafc'%20stroke-width%3D'18'%20stroke-linecap%3D'round'%2F%3E%3Ccircle%20cx%3D'310'%20cy%3D'450'%20r%3D'83'%20fill%3D'%25230f172a'%20stroke%3D'%2523cbd5e1'%20stroke-width%3D'13'%2F%3E%3Ccircle%20cx%3D'310'%20cy%3D'450'%20r%3D'42'%20fill%3D'%252394a3b8'%20stroke%3D'%2523e2e8f0'%20stroke-width%3D'10'%2F%3E%3Ccircle%20cx%3D'790'%20cy%3D'450'%20r%3D'83'%20fill%3D'%25230f172a'%20stroke%3D'%2523cbd5e1'%20stroke-width%3D'13'%2F%3E%3Ccircle%20cx%3D'790'%20cy%3D'450'%20r%3D'42'%20fill%3D'%252394a3b8'%20stroke%3D'%2523e2e8f0'%20stroke-width%3D'10'%2F%3E%3Cpath%20d%3D'M170%20340%20245%20325M875%20320l70%2020'%20stroke%3D'%2523fff'%20stroke-width%3D'12'%20stroke-linecap%3D'round'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"}} alt="سيارة حديثة" className="absolute inset-0 h-full w-full rounded-[2rem] object-cover opacity-90 motion-safe:animate-[catalogFloat_7s_ease-in-out_infinite]"/><div className="absolute bottom-4 right-4 rounded-2xl border border-white/20 bg-slate-950/75 p-4 backdrop-blur"><p className="text-xs text-blue-100">منصة واحدة</p><p className="mt-1 text-lg font-extrabold">كتالوج · عروض · محادثات</p></div></div>
      </div>
    </section>
    <section id="catalog" className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">اختيار أسرع</p><h2 className="mt-1 text-2xl font-black">السيارات المتاحة</h2><p className="mt-2 text-sm text-slate-500">تظهر هنا السيارات المعتمدة والمستوفية لشروط الإتاحة فقط.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200" aria-live="polite">{filtered.length} سيارة</span><button type="button" onClick={()=>setFavoritesOnly(value=>!value)} aria-pressed={favoritesOnly} className={"inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition "+(favoritesOnly?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-700")}><Heart size={16} fill={favoritesOnly?"currentColor":"none"}/> المفضلة ({favoriteIds.length})</button><button type="button" disabled={compareIds.length < 2} onClick={()=>setCompareOpen(true)} className="min-h-10 rounded-xl bg-blue-800 px-3 py-2 text-sm font-extrabold text-white disabled:opacity-40">مقارنة السيارات ({compareIds.length}/3)</button>{(search || type !== 'الكل' || city !== 'الكل' || maxPrice) && <button type="button" onClick={() => { setSearch(''); setType('الكل'); setCity('الكل'); setMaxPrice('') }} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">مسح الفلاتر</button>}</div></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Filter size={17} className="text-blue-700"/> بحث وتصفية متقدمة</div>
        <button type="button" onClick={()=>setMobileFiltersOpen(v=>!v)} aria-expanded={mobileFiltersOpen} className="min-h-10 rounded-xl bg-blue-50 px-4 text-sm font-extrabold text-blue-800 md:hidden">{mobileFiltersOpen?'إخفاء الفلاتر':'عرض كل الفلاتر'}</button>
        <div className="hidden items-center gap-2 md:flex"><span className="text-xs text-slate-500">ترتيب النتائج</span><select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="featured">الأكثر تميزًا</option><option value="price_asc">السعر: الأقل أولًا</option><option value="price_desc">السعر: الأعلى أولًا</option><option value="year_desc">الأحدث سنة</option><option value="seats_desc">الأعلى سعة</option></select></div>
      </div>
      <div className={"mc-catalog-filters mt-3 grid gap-3 rounded-3xl border border-white bg-white/95 p-4 shadow-lg shadow-slate-200/60 sm:grid-cols-2 lg:grid-cols-4 "+(mobileFiltersOpen?'':'hidden md:grid')}>
        <label className="relative block sm:col-span-2"><Search size={17} className="absolute right-3 top-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 pe-10 ps-3 text-sm outline-none focus:border-blue-600" placeholder="ابحث عن الماركة أو الموديل أو المدينة"/></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Filter size={16} className="text-slate-400"/><select value={makeFilter} onChange={e=>setMakeFilter(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none">{makes.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Filter size={16} className="text-slate-400"/><select value={type} onChange={e=>setType(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none">{types.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><ChevronDown size={16} className="text-slate-400"/><select value={city} onChange={e=>setCity(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none">{cities.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><span className="whitespace-nowrap text-xs text-slate-500">حتى جنيه/شهر</span><input type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} className="min-h-12 w-full min-w-0 bg-transparent text-sm outline-none" placeholder="السعر"/></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><span className="whitespace-nowrap text-xs text-slate-500">من سنة</span><select value={minYear} onChange={e=>setMinYear(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none"><option value="">أي سنة</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><span className="whitespace-nowrap text-xs text-slate-500">إلى سنة</span><select value={maxYear} onChange={e=>setMaxYear(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none"><option value="">أي سنة</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><span className="whitespace-nowrap text-xs text-slate-500">عدد المقاعد</span><select value={minSeats} onChange={e=>setMinSeats(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none"><option value="">الكل</option>{[2,4,5,7,8,14,15,20,30,45].map(n=><option key={n} value={n}>{n} فأكثر</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><span className="whitespace-nowrap text-xs text-slate-500">GPS</span><select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none"><option value="الكل">الكل</option><option value="yes">متوفر</option><option value="no">غير متوفر</option></select></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 md:hidden"><span className="whitespace-nowrap text-xs text-slate-500">ترتيب</span><select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none"><option value="featured">الأكثر تميزًا</option><option value="price_asc">السعر الأقل</option><option value="price_desc">السعر الأعلى</option><option value="year_desc">الأحدث سنة</option><option value="seats_desc">الأعلى سعة</option></select></label>
        <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-4"><span className="text-xs font-bold text-slate-500">النتائج المطابقة: {filtered.length}</span><button type="button" onClick={()=>{setSearch('');setType('الكل');setCity('الكل');setMaxPrice('');setMakeFilter('الكل');setMinYear('');setMaxYear('');setMinSeats('');setGpsFilter('الكل');setSortBy('featured');setFavoritesOnly(false)}} className="rounded-lg px-3 py-2 text-xs font-extrabold text-blue-700 hover:bg-blue-50">مسح جميع الفلاتر</button></div>
      </div>
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700">{error}</p>}
      {notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
      {!loading&&premiumVehicles.length===0&&<section className="relative mt-7 overflow-hidden rounded-[1.75rem] border border-amber-300 bg-[linear-gradient(115deg,#071a31_0%,#12385b_55%,#172554_100%)] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-9"><div className="pointer-events-none absolute -left-12 -top-16 h-56 w-56 rounded-full border-[22px] border-white/5"/><div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-amber-400/10 blur-2xl"/><div className="relative grid items-center gap-6 sm:grid-cols-[1fr_auto]"><div><span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200"><Sparkles size={14}/> مساحة إعلانية حصرية</span><h3 className="mt-3 text-2xl font-black leading-relaxed sm:text-3xl">سيارتك تستحق الظهور في المكان الأبرز</h3><p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">هذه المساحة مخصصة للإعلانات المميزة داخل كتالوج My Car، لتظهر سيارتك في مقدمة اختيارات الشركات. احجز ظهورًا مميزًا لسيارتك بعد اعتماد الطلب والدفع.</p></div><a href="/workspace/advertising-plans?placement=premium" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-amber-300 to-orange-400 px-6 font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5"><Megaphone size={18}/> اشترك في الإعلان المميز</a></div></section>}
      {loading?<div className="py-16 text-center text-slate-500">جارٍ تحميل السيارات المعتمدة...</div>:filtered.length===0&&premiumVehicles.length===0?<div className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center"><CarFront size={34} className="mx-auto text-slate-300"/><h3 className="mt-3 font-extrabold">لا توجد سيارات مطابقة</h3><p className="mt-2 text-sm text-slate-500">غيّر خيارات البحث أو ارجع لاحقًا عند إضافة سيارات معتمدة.</p><button onClick={()=>{setSearch('');setType('الكل');setCity('الكل');setMaxPrice('');setMakeFilter('الكل');setMinYear('');setMaxYear('');setMinSeats('');setGpsFilter('الكل');setFavoritesOnly(false)}} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold">مسح الفلاتر</button></div>:<>
        {premiumVehicles.length>0&&<section aria-labelledby="premium-vehicles-title" className="mt-7 rounded-[1.75rem] border border-amber-300 bg-[linear-gradient(135deg,#fff7e6_0%,#fff_55%,#fff1e8_100%)] p-4 shadow-md sm:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-black text-white"><Sparkles size={14}/> إعلان مميز</span><h3 id="premium-vehicles-title" className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">المساحة الإعلانية المميزة</h3><p className="mt-1 text-sm text-slate-600">سيارات مشتركة في باقة الإعلان المميز، تظهر في المساحة الأبرز بالكتالوج.</p></div><span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-amber-900 ring-1 ring-amber-200">{premiumVehicles.length} إعلان مميز</span></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{premiumVehicles.map(v=><article key={v.id} className="group relative overflow-hidden rounded-3xl border border-amber-300 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"><button type="button" onClick={()=>{setSelected(v);setShowOffer(false);setOfferText('');setError('')}} className="block w-full text-right"><div className="relative h-56 bg-slate-100"><span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-emerald-800"><BadgeCheck size={14}/> معتمدة</span><span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-amber-500 to-orange-500 px-3.5 py-2 text-xs font-black text-white shadow-lg"><Sparkles size={14}/> إعلان مميز</span>{v.images[0]?<img loading="lazy" src={v.images[0].url} alt={v.images[0].alt_text||v.make+' '+v.model} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>:<div className="grid h-full place-items-center text-slate-300"><CarFront size={42}/><span className="text-xs">الصورة غير متاحة</span></div>}</div><div className="px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-2"><h4 className="min-w-0 truncate text-base font-black text-slate-950 sm:text-lg">{v.make} {v.model}</h4><span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-900">{v.model_year}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-500"><span>{v.vehicle_type}</span><span>•</span><span>{v.governorate}</span><span>•</span><span>{v.seats} مقاعد</span></div><p className="mt-3 border-t border-slate-100 pt-3 text-lg font-black text-blue-800">{money(Number(v.monthly_price_egp))} <span className="text-[11px] font-bold text-slate-500">جنيه / شهر</span></p></div></button></article>)}</div></section>}
        {featuredVehicles.length>0&&<section aria-labelledby="featured-vehicles-title" className="mt-7 rounded-[1.75rem] border border-amber-200/80 bg-[linear-gradient(135deg,#fffaf0_0%,#fff_55%,#f0f8ff_100%)] p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900"><Sparkles size={14}/> إعلانات السيارات</span><h3 id="featured-vehicles-title" className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">السيارات المُعلن عنها</h3><p className="mt-1 text-sm text-slate-600">سيارات مشتركة في باقات إعلانية سارية، تظهر هنا في مقدمة الكتالوج.</p></div><span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-amber-900 ring-1 ring-amber-200">{featuredVehicles.length} سيارة مميزة</span></div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featuredVehicles.map(v=><article key={v.id} className="group relative overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl">
            <button type="button" aria-label={favoriteIds.includes(v.id)?"إزالة السيارة من المفضلة":"إضافة السيارة إلى المفضلة"} aria-pressed={favoriteIds.includes(v.id)} onClick={()=>toggleFavorite(v.id)} className={"absolute left-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full shadow-md ring-1 ring-black/5 "+(favoriteIds.includes(v.id)?"bg-rose-50 text-rose-600":"bg-white/95 text-slate-600")}><Heart size={19} fill={favoriteIds.includes(v.id)?"currentColor":"none"}/></button>
            <button type="button" onClick={()=>{setSelected(v);setShowOffer(false);setOfferText('');setError('')}} className="block w-full text-right"><div className="relative h-52 bg-slate-100"><span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-emerald-800"><BadgeCheck size={14}/> معتمدة</span><span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-gradient-to-l from-amber-500 to-orange-500 px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-amber-950/20"><Megaphone size={14}/> إعلان</span>{v.images[0]?<img loading="lazy" src={v.images[0].url} alt={v.images[0].alt_text||v.make+' '+v.model} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>:<div className="grid h-full place-items-center text-slate-300"><CarFront size={42}/><span className="text-xs">الصورة غير متاحة</span></div>}</div><div className="px-4 py-3 sm:px-5"><div className="flex items-center justify-between gap-2"><h4 className="min-w-0 truncate text-base font-black text-slate-950 sm:text-lg">{v.make} {v.model}</h4><span className="shrink-0 rounded-lg bg-amber-50 text-amber-900 px-2 py-1 text-[11px] font-extrabold">{v.model_year}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-500 sm:text-sm"><span className="inline-flex items-center gap-1"><CarFront size={14}/>{v.vehicle_type}</span><span className="text-slate-300">•</span><span>{v.governorate}</span><span className="text-slate-300">•</span><span>{v.seats} مقاعد</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-base font-black text-blue-800 sm:text-lg">{money(Number(v.monthly_price_egp))} <span className="text-[11px] font-bold text-slate-500">جنيه / شهر</span></p><span className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700">عرض التفاصيل <ArrowLeft size={13}/></span></div></div></button>
            <div className="flex justify-start border-t border-slate-100 px-5 py-3"><button type="button" onClick={()=>toggleCompare(v.id)} aria-pressed={compareIds.includes(v.id)} className={"inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-xs font-extrabold "+(compareIds.includes(v.id)?"border-blue-300 bg-blue-50 text-blue-800":"border-slate-200 bg-white text-slate-700")}>{compareIds.includes(v.id)?"إزالة من المقارنة":"أضف للمقارنة"}</button></div>
          </article>)}</div>
        </section>}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-black">كل السيارات المتاحة</h3><p className="mt-1 text-sm text-slate-500">السيارات المميزة معروضة في القسم العلوي فقط دون تكرارها هنا.</p></div><span className="text-xs font-bold text-slate-500">{regularVehicles.length} نتيجة عادية</span></div>
        {regularVehicles.length===0?<div className="mt-4 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">لا توجد نتائج عادية مطابقة؛ يمكنك استعراض السيارات المميزة أعلاه.</div>:<>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleRegularVehicles.map(v=><article key={v.id} className="group relative overflow-hidden rounded-3xl border border-white bg-white shadow-md shadow-slate-200/60 transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/10">
            <button type="button" aria-label={favoriteIds.includes(v.id)?"إزالة السيارة من المفضلة":"إضافة السيارة إلى المفضلة"} aria-pressed={favoriteIds.includes(v.id)} onClick={()=>toggleFavorite(v.id)} className={"absolute left-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full shadow-md ring-1 ring-black/5 transition "+(favoriteIds.includes(v.id)?"bg-rose-50 text-rose-600":"bg-white/95 text-slate-600 hover:bg-rose-50 hover:text-rose-600")}><Heart size={19} fill={favoriteIds.includes(v.id)?"currentColor":"none"}/></button>
            <button type="button" onClick={()=>{setSelected(v);setShowOffer(false);setOfferText('');setError('')}} className="block w-full text-right"><div className="relative h-52 bg-slate-100">{v.images[0]?<img loading="lazy" src={v.images[0].url} alt={v.images[0].alt_text||v.make+' '+v.model} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>:<div className="grid h-full place-items-center text-slate-300"><CarFront size={42}/><span className="text-xs">الصورة غير متاحة</span></div>}<span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-emerald-800"><BadgeCheck size={14}/> معتمدة</span></div><div className="px-4 py-3 sm:px-5"><div className="flex items-center justify-between gap-2"><h4 className="min-w-0 truncate text-base font-black text-slate-950 sm:text-lg">{v.make} {v.model}</h4><span className="shrink-0 rounded-lg bg-slate-100 text-slate-700 px-2 py-1 text-[11px] font-extrabold">{v.model_year}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-500 sm:text-sm"><span className="inline-flex items-center gap-1"><CarFront size={14}/>{v.vehicle_type}</span><span className="text-slate-300">•</span><span>{v.governorate}</span><span className="text-slate-300">•</span><span>{v.seats} مقاعد</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-base font-black text-blue-800 sm:text-lg">{money(Number(v.monthly_price_egp))} <span className="text-[11px] font-bold text-slate-500">جنيه / شهر</span></p><span className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700">عرض التفاصيل <ArrowLeft size={13}/></span></div></div></button>
            <div className="flex justify-start border-t border-slate-100 px-5 py-3"><button type="button" onClick={()=>toggleCompare(v.id)} aria-pressed={compareIds.includes(v.id)} className={"inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-xs font-extrabold shadow-sm transition "+(compareIds.includes(v.id)?"border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100":"border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800")}>{compareIds.includes(v.id)?"إزالة من المقارنة":"أضف للمقارنة"}</button></div>
          </article>)}</div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-bold text-slate-600">صفحة {page} من {totalPages} · عرض {visibleRegularVehicles.length} من {regularVehicles.length} سيارة</p><div className="flex items-center gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="min-h-10 rounded-xl border px-4 text-sm font-bold disabled:opacity-40">السابق</button><span className="min-w-10 text-center text-sm font-black">{page}</span><button type="button" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="min-h-10 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white disabled:opacity-40">التالي</button></div></div>
        </>}
      </>}
    </section>
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6"><div className="relative overflow-hidden rounded-3xl border border-cyan-200/70 bg-[linear-gradient(120deg,#eaf5ff_0%,#ffffff_58%,#eefbff_100%)] p-6 shadow-sm shadow-blue-100 sm:p-8"><div className="pointer-events-none absolute -left-10 -top-12 h-44 w-44 rounded-full border-[18px] border-cyan-100/60"/><div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-extrabold text-blue-800"><Bot size={15}/> {orgType==='individual_owner'?'مساحة مخصصة لملاك السيارات':orgType==='fleet_supplier'?'كتالوج لموردي الأساطيل':'خدمة مخصصة للشركات'}</span><h2 className="mt-3 text-xl font-black text-slate-950">{orgType==='individual_owner'?'اعرض سيارتك أمام الشركات':orgType==='fleet_supplier'?'وسّع أسطولك بسيارات من ملاك آخرين':'خلّي My Car تبحث عن السيارات نيابةً عن شركتك'}</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{orgType==='individual_owner'?'تصفح طريقة ظهور السيارات في الكتالوج، وشاهد شكل الإعلانات المميزة قبل الاشتراك بسيارتك. بيانات التواصل الخاصة بالملاك تظل مخفية.':orgType==='fleet_supplier'?'استعرض السيارات المعتمدة وتواصل مع ملاكها داخل المنصة لطلب السيارات التي تناسب احتياج أسطولك.':'بدل ما تضيّع وقتك في البحث، حدّد احتياج شركتك وفوّض فريق My Car للبحث لدى الملاك وموردي الأساطيل وتجهيز اختيارات وعروض مقارنة تساعدك على اتخاذ القرار.'}</p></div><a href={orgType==='individual_owner'?'/workspace/advertising-plans?placement=premium':orgType==='fleet_supplier'?'/workspace/supplier/vehicles':'/workspace/company/managed-sourcing'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-700"><Search size={17}/> {orgType==='individual_owner'?'اشترك في الإعلان المميز':orgType==='fleet_supplier'?'إدارة سيارات أسطولك':'اطلب خدمة البحث نيابةً عنك'}</a></div></div></section>
    {compareOpen&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">مقارنة السيارات</h2><div className="flex items-center gap-2"><button type="button" onClick={()=>{setCompareIds([]);setCompareOpen(false);setNotice('تمت إزالة المقارنة. يمكنك البدء من جديد باختيار سيارات أخرى.')}} disabled={compareIds.length===0} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">إزالة المقارنة والبدء من جديد</button><button onClick={()=>setCompareOpen(false)} aria-label="إغلاق"><X/></button></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-right text-sm"><tbody>{[['السيارة',(v:Vehicle)=>v.make+' '+v.model],['السعر الشهري',(v:Vehicle)=>money(Number(v.monthly_price_egp))+' جنيه'],['السعر السنوي',(v:Vehicle)=>v.yearly_price_egp?money(Number(v.yearly_price_egp))+' جنيه':'غير محدد'],['النوع',(v:Vehicle)=>v.vehicle_type],['المحافظة',(v:Vehicle)=>v.governorate],['عدد المقاعد',(v:Vehicle)=>String(v.seats)],['ناقل الحركة',(v:Vehicle)=>v.transmission],['سائق',(v:Vehicle)=>v.with_driver?'متاح بسائق':'بدون سائق']].map(([label,get])=><tr key={String(label)}><th className="border-b p-3">{String(label)}</th>{vehicles.filter(v=>compareIds.includes(v.id)).map(v=><td key={v.id} className="border-b p-3">{(get as (v:Vehicle)=>string)(v)}</td>)}</tr>)}</tbody></table></div><button onClick={()=>setCompareOpen(false)} className="mt-4 rounded-xl bg-blue-800 px-4 py-3 font-bold text-white">إغلاق المقارنة</button></div></div>}{selected&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="تفاصيل السيارة"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-700">تفاصيل السيارة المعتمدة</p><h2 className="mt-1 text-2xl font-black">{selected.make} {selected.model} · {selected.model_year}</h2></div><button onClick={()=>setSelected(null)} aria-label="إغلاق" className="rounded-xl border p-2"><X size={19}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="overflow-hidden rounded-2xl bg-slate-100 sm:col-span-2">{selected.images[0]&&<img src={selected.images[0].url} alt={selected.images[0].alt_text||'صورة السيارة'} className="h-64 w-full object-cover"/>}</div>{[['نوع السيارة',selected.vehicle_type],['المحافظة',selected.governorate],['سنة الصنع',String(selected.model_year)],['ناقل الحركة',selected.transmission],['عدد المقاعد',String(selected.seats)],['السائق',selected.with_driver?'متاح بسائق':'بدون سائق'],['نظام GPS',selected.has_gps===null?'لم يتم تحديده بعد':selected.has_gps?'مزودة بجهاز GPS':'غير مزودة بجهاز GPS'],['تاريخ انتهاء الرخصة',selected.license_expiry_date?new Date(selected.license_expiry_date+'T00:00:00').toLocaleDateString('ar-EG'):'غير مسجل']].map(([k,val])=><div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 font-bold">{val}</p></div>)}</div>{selected.notes&&<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{selected.notes}</p>}<div className="mt-5 rounded-2xl bg-blue-50 p-4"><p className="text-sm text-slate-600">السعر الشهري</p><p className="mt-1 text-2xl font-black text-blue-800">{money(Number(selected.monthly_price_egp))} جنيه</p>{selected.yearly_price_egp&&<p className="mt-1 text-sm font-bold text-slate-600">السعر السنوي: {money(Number(selected.yearly_price_egp))} جنيه</p>}</div><p className="mt-4 flex items-center gap-2 text-xs leading-6 text-slate-500"><ShieldCheck size={16}/> بيانات مالك السيارة ووسائل الاتصال الشخصية مخفية. التواصل متاح من خلال المحادثات داخل My Car فقط.</p>{showOffer&&<label className="mt-4 block text-sm font-bold">رسالتك أو تفاصيل العرض<textarea rows={3} maxLength={2000} value={offerText} onChange={e=>setOfferText(e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="اكتب المدة المطلوبة، عدد السيارات، أو السعر المقترح..."/></label>}<div className="mt-5 flex flex-col gap-3 sm:flex-row">{['company','fleet_supplier'].includes(orgType)&&<><button disabled={sending} onClick={()=>showOffer?void startConversation(true):setShowOffer(true)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white disabled:opacity-50"><Send size={17}/>{sending?'جارٍ الإرسال...':showOffer?(orgType==='fleet_supplier'?'إرسال طلب السيارة وبدء المحادثة':'إرسال العرض وبدء المحادثة'):(orgType==='fleet_supplier'?'طلب السيارة':'إرسال عرض')}</button><button disabled={sending} onClick={()=>{setOfferText('');void startConversation()}} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 font-extrabold"><MessageCircle size={17}/> بدء محادثة</button></>}{orgType==='individual_owner'&&<a href={'/workspace/owner/vehicles'} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white">إدارة سياراتك والترويج لها</a>}</div></div></div>}
    {showPlans&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-black">باقات الظهور الإعلاني</h2><p className="mt-2 text-sm text-slate-500">خيارات مدفوعة لإبراز السيارات في بداية الكتالوج.</p></div><button onClick={()=>setShowPlans(false)} className="rounded-xl border p-2"><X size={18}/></button></div>{plans.length===0?<div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-bold">لا توجد باقات إعلانية متاحة حاليًا.</p><p className="mt-2 text-sm text-slate-500">سيتم عرض الباقات بعد اعتمادها من إدارة المنصة.</p></div>:<div className="mt-5 grid gap-4 sm:grid-cols-2">{plans.map(p=><article key={p.id} className="rounded-2xl border p-5"><h3 className="text-lg font-extrabold">{p.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{p.description}</p><p className="mt-4 text-2xl font-black text-blue-800">{money(p.price_egp)} جنيه</p><p className="mt-1 text-sm text-slate-500">لمدة {p.duration_days} يومًا</p><ul className="mt-3 space-y-2">{(p.features||[]).map(f=><li key={f} className="flex gap-2 text-sm"><Check size={16} className="text-emerald-600"/>{f}</li>)}</ul><button onClick={()=>setSelectedPlanId(p.id)} className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 font-bold text-white">طلب ترويج سيارة</button>{selectedPlanId===p.id&&<div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">{myVehicles.length===0?<p className="text-sm leading-6 text-slate-600">لا توجد سيارة معتمدة في حسابك حاليًا. أضف سيارة وانتظر اعتمادها أولًا.</p>:<><label className="block text-sm font-bold">اختر السيارة<select value={selectedPromotionVehicle} onChange={e=>setSelectedPromotionVehicle(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3"><option value="">اختر سيارة</option>{myVehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.model_year}</option>)}</select></label><button disabled={!selectedPromotionVehicle||submittingPromotion} onClick={()=>void requestPromotion()} className="min-h-11 w-full rounded-xl bg-blue-700 px-4 font-bold text-white disabled:opacity-50">{submittingPromotion?'جارٍ إرسال الطلب...':'إرسال طلب الترويج للمراجعة'}</button></>}</div>}</article>)}</div>}</div></div>}
    <a href="/assistant" className="fixed bottom-5 left-5 z-40 inline-flex min-h-14 items-center gap-2 rounded-full border border-cyan-300/40 bg-gradient-to-l from-[#0b2545] to-[#155e91] px-5 font-extrabold text-white shadow-xl shadow-blue-950/25 transition hover:-translate-y-0.5 hover:shadow-2xl"><Sparkles size={21}/><span>مساعد My Car الذكي</span></a>
  </main>
}
