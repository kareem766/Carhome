import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, CarFront, CheckCircle2, Clock3, Download, FileSpreadsheet, Megaphone, RefreshCw, TrendingUp, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Vehicle = { id: string; make: string; model: string; model_year: number; vehicle_type: string; governorate: string; license_expiry_date: string | null; review_status: string; payment_status: string; monthly_price_egp: number; created_at: string }
type Offer = { id: string; status: string; created_at: string; monthly_price_egp: number; vehicle_count?: number; source: 'company' | 'employee'; request_title: string; governorate: string }
type Promotion = { id: string; status: string; payment_status: string; starts_at: string | null; ends_at: string | null; vehicle_id: string | null; plan_name_snapshot: string | null }

const money = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value)
const dateLabel = (value: string | null) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ar-EG') : 'غير مسجل'
const statusLabel = (status: string) => status === 'approved' ? 'معتمدة' : status === 'pending_review' ? 'قيد المراجعة' : status === 'pending_payment' ? 'بانتظار الدفع' : status === 'rejected' ? 'تحتاج تعديلًا' : status === 'paused' ? 'متوقفة' : status

function exportCsv(filename: string, rows: string[][]) {
  const csv = '\uFEFF' + rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function FleetSupplierInsightsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [organizationName, setOrganizationName] = useState('أسطولك')

  async function load(showRefresh = false) {
    if (!supabase) { window.location.replace('/?login=1'); return }
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) { window.location.replace('/?login=1'); return }
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id,organizations!inner(name,organization_type,approval_status)')
      .eq('user_id', auth.user.id)
      .eq('organizations.organization_type', 'fleet_supplier')
      .eq('organizations.approval_status', 'approved')
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership?.organization_id) {
      setError('هذه التقارير متاحة لحسابات موردي الأساطيل المعتمدة فقط.')
      setLoading(false); setRefreshing(false); return
    }
    const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations
    setOrganizationName(String((org as any)?.name || 'أسطولك'))
    const [vehicleResult, companyOfferResult, employeeOfferResult, promotionResult] = await Promise.all([
      supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,license_expiry_date,review_status,payment_status,monthly_price_egp,created_at').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }),
      supabase.from('rental_offers').select('id,status,created_at,monthly_price_egp,vehicle_count,rental_requests(title,governorate)').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }),
      supabase.from('employee_rental_offers').select('id,status,created_at,monthly_price_egp,employee_rental_requests(title,governorate)').eq('created_by', auth.user.id).order('created_at', { ascending: false }),
      supabase.from('vehicle_promotions').select('id,status,payment_status,starts_at,ends_at,vehicle_id,plan_name_snapshot').eq('organization_id', membership.organization_id).order('created_at', { ascending: false })
    ])
    if (vehicleResult.error) setError('تعذر تحميل سيارات الأسطول: ' + vehicleResult.error.message)
    else setVehicles((vehicleResult.data || []) as Vehicle[])
    if (companyOfferResult.error) setError(previous => previous ? previous + ' · تعذر تحميل عروض الشركات.' : 'تعذر تحميل عروض الشركات: ' + companyOfferResult.error.message)
    if (employeeOfferResult.error) setError(previous => previous ? previous + ' · تعذر تحميل عروض الموظفين.' : 'تعذر تحميل عروض الموظفين: ' + employeeOfferResult.error.message)
    if (promotionResult.error) setError(previous => previous ? previous + ' · تعذر تحميل الإعلانات.' : 'تعذر تحميل الإعلانات: ' + promotionResult.error.message)
    const companyOffers = (companyOfferResult.data || []).map((offer: any) => {
      const request = Array.isArray(offer.rental_requests) ? offer.rental_requests[0] : offer.rental_requests
      return { id: offer.id, status: offer.status, created_at: offer.created_at, monthly_price_egp: Number(offer.monthly_price_egp || 0), vehicle_count: Number(offer.vehicle_count || 0), source: 'company' as const, request_title: request?.title || 'طلب شركة', governorate: request?.governorate || '—' }
    })
    const employeeOffers = (employeeOfferResult.data || []).map((offer: any) => {
      const request = Array.isArray(offer.employee_rental_requests) ? offer.employee_rental_requests[0] : offer.employee_rental_requests
      return { id: offer.id, status: offer.status, created_at: offer.created_at, monthly_price_egp: Number(offer.monthly_price_egp || 0), source: 'employee' as const, request_title: request?.title || 'طلب موظف', governorate: request?.governorate || '—' }
    })
    setOffers([...companyOffers, ...employeeOffers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setPromotions((promotionResult.data || []) as Promotion[])
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  const today = new Date().toLocaleDateString('en-CA')
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA')
  const activeVehicles = vehicles.filter(vehicle => vehicle.review_status === 'approved' && ['verified','waived'].includes(vehicle.payment_status))
  const pendingVehicles = vehicles.filter(vehicle => ['pending_review','pending_payment'].includes(vehicle.review_status) || vehicle.payment_status === 'pending')
  const expiringLicenses = vehicles.filter(vehicle => vehicle.license_expiry_date && vehicle.license_expiry_date >= today && vehicle.license_expiry_date <= thirtyDays)
  const activePromotions = promotions.filter(item => item.status === 'approved' && ['verified','waived'].includes(item.payment_status) && (!item.starts_at || new Date(item.starts_at).getTime() <= Date.now()) && (!item.ends_at || new Date(item.ends_at).getTime() > Date.now()))
  const offerStats = { pending: offers.filter(offer => offer.status === 'submitted').length, accepted: offers.filter(offer => offer.status === 'accepted').length, rejected: offers.filter(offer => ['rejected','withdrawn'].includes(offer.status)).length }
  const typeStats = useMemo(() => Object.entries(vehicles.reduce<Record<string, number>>((result, vehicle) => { const key = vehicle.vehicle_type || 'غير محدد'; result[key] = (result[key] || 0) + 1; return result }, {})).sort((a,b) => b[1]-a[1]), [vehicles])
  const governorateStats = useMemo(() => Object.entries(vehicles.reduce<Record<string, number>>((result, vehicle) => { const key = vehicle.governorate || 'غير محدد'; result[key] = (result[key] || 0) + 1; return result }, {})).sort((a,b) => b[1]-a[1]), [vehicles])

  function exportVehicles() {
    exportCsv('mycar-fleet-vehicles.csv', [['السيارة','الموديل','السنة','النوع','المحافظة','السعر الشهري','حالة المراجعة','حالة الدفع','انتهاء الرخصة','تاريخ الإضافة'], ...vehicles.map(v => [v.make,v.model,String(v.model_year),v.vehicle_type,v.governorate,String(v.monthly_price_egp),statusLabel(v.review_status),v.payment_status,dateLabel(v.license_expiry_date),dateLabel(v.created_at.slice(0,10))])])
  }
  function exportOffers() {
    exportCsv('mycar-fleet-offers.csv', [['مصدر العرض','الطلب','المحافظة','السعر الشهري','عدد السيارات','الحالة','تاريخ الإرسال'], ...offers.map(o => [o.source === 'employee' ? 'موظف' : 'شركة',o.request_title,o.governorate,String(o.monthly_price_egp),String(o.vehicle_count || 1),o.status,dateLabel(o.created_at.slice(0,10))])])
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-7xl space-y-6 p-4 py-7 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><span className="text-xs font-black tracking-wide text-blue-700">MY CAR · FLEET PERFORMANCE</span><h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">تقارير وتحليلات الأسطول</h1><p className="mt-2 text-sm leading-6 text-slate-600">{organizationName} · ملخص تشغيلي لسياراتك وعروضك وإعلاناتك</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load(true)} disabled={refreshing || loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''}/> تحديث</button><a href="/workspace/supplier/vehicles" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white"><ArrowLeft size={15}/> العودة للأسطول</a></div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">{error}</p>}
      {loading ? <div className="rounded-2xl border bg-white p-12 text-center text-slate-500">جارٍ تحميل تقارير الأسطول...</div> : <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{label:'إجمالي السيارات',value:vehicles.length,detail:'كل السيارات المسجلة في مؤسستك',icon:CarFront},{label:'سيارات معتمدة ونشطة',value:activeVehicles.length,detail:'جاهزة للتقديم على الطلبات وفق شروط الأهلية',icon:CheckCircle2},{label:'سيارات قيد المراجعة',value:pendingVehicles.length,detail:'تابع استكمال الدفع أو مراجعة الإدارة',icon:Clock3},{label:'رخص تنتهي خلال 30 يومًا',value:expiringLicenses.length,detail:'راجع التجديد قبل انتهاء الترخيص',icon:FileSpreadsheet},{label:'عروض بانتظار الرد',value:offerStats.pending,detail:'طلبات شركات وموظفين',icon:Clock3},{label:'عروض مقبولة',value:offerStats.accepted,detail:'من الطلبات التي قدمت عليها',icon:TrendingUp},{label:'عروض مرفوضة أو مسحوبة',value:offerStats.rejected,detail:'راجع أداء العروض السابقة',icon:XCircle},{label:'إعلانات نشطة',value:activePromotions.length,detail:'إعلانات معتمدة وسارية حاليًا',icon:Megaphone}].map(item => <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-600">{item.label}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><item.icon size={19}/></span></div><strong className="mt-3 block text-3xl font-black text-slate-950">{item.value.toLocaleString('ar-EG')}</strong><p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p></article>)}
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h2 className="font-extrabold text-slate-900">توزيع الأسطول حسب النوع</h2><p className="mt-1 text-xs text-slate-500">عدد السيارات المسجلة بكل فئة</p></div><BarChart3 className="text-blue-700"/></div>{typeStats.length ? <div className="mt-5 space-y-4">{typeStats.map(([name,count]) => <div key={name}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="font-bold text-slate-700">{name}</span><strong>{count.toLocaleString('ar-EG')}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-l from-blue-700 to-cyan-400" style={{width: (count / vehicles.length * 100) + '%'}}/></div></div>)}</div> : <p className="mt-5 text-sm text-slate-500">لا توجد سيارات مسجلة بعد.</p>}</article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h2 className="font-extrabold text-slate-900">توزيع السيارات حسب المحافظة</h2><p className="mt-1 text-xs text-slate-500">أماكن تمركز السيارات المسجلة</p></div><BarChart3 className="text-blue-700"/></div>{governorateStats.length ? <div className="mt-5 space-y-4">{governorateStats.map(([name,count]) => <div key={name}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="font-bold text-slate-700">{name}</span><strong>{count.toLocaleString('ar-EG')}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-l from-indigo-700 to-sky-400" style={{width: (count / vehicles.length * 100) + '%'}}/></div></div>)}</div> : <p className="mt-5 text-sm text-slate-500">لا توجد بيانات جغرافية متاحة.</p>}</article>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-extrabold text-slate-900">حالة سيارات الأسطول</h2><p className="mt-1 text-xs text-slate-500">آخر السيارات المضافة أولًا</p></div><button type="button" onClick={exportVehicles} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-800"><Download size={14}/> تصدير CSV</button></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">السيارة</th><th className="p-3">النوع / المحافظة</th><th className="p-3">المراجعة</th><th className="p-3">الدفع</th><th className="p-3">الرخصة</th></tr></thead><tbody>{vehicles.slice(0,12).map(v=><tr key={v.id} className="border-t"><td className="p-3 font-bold">{v.make} {v.model} · {v.model_year}</td><td className="p-3 text-slate-600">{v.vehicle_type} · {v.governorate}</td><td className="p-3">{statusLabel(v.review_status)}</td><td className="p-3">{v.payment_status === 'verified' || v.payment_status === 'waived' ? 'مؤكد' : v.payment_status === 'pending' ? 'قيد المراجعة' : v.payment_status}</td><td className="p-3">{dateLabel(v.license_expiry_date)}</td></tr>)}{vehicles.length===0&&<tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد سيارات لعرضها.</td></tr>}</tbody></table></div></article>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-extrabold text-slate-900">آخر العروض المقدمة</h2><p className="mt-1 text-xs text-slate-500">عروض طلبات الشركات والموظفين</p></div><button type="button" onClick={exportOffers} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-800"><Download size={14}/> تصدير CSV</button></div><div className="divide-y">{offers.slice(0,10).map(offer=><div key={offer.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{offer.request_title}</strong><span className={'rounded-full px-2.5 py-1 text-[11px] font-bold ' + (offer.status==='accepted'?'bg-emerald-50 text-emerald-700':offer.status==='rejected'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700')}>{offer.status==='accepted'?'مقبول':offer.status==='rejected'?'مرفوض':offer.status==='withdrawn'?'مسحوب':'بانتظار الرد'}</span></div><p className="mt-1 text-xs text-slate-500">{offer.source==='employee'?'طلب موظف':'طلب شركة'} · {offer.governorate} · {money(offer.monthly_price_egp)} جنيه شهريًا · {dateLabel(offer.created_at.slice(0,10))}</p></div>)}{offers.length===0&&<p className="p-8 text-center text-sm text-slate-500">لم تقدم عروضًا بعد.</p>}</div></article>
        </section>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">هذه التقارير تلخص البيانات التشغيلية المسجلة داخل المنصة، ولا تمثل ضمانًا لتأجير السيارات أو تحقيق إيرادات. إتمام التأجير والتعاقد يتم مباشرة بين المورد والشركة.</div>
      </>}
    </div>
  </main>
}
