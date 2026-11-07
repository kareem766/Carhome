import { useEffect, useState } from 'react'
import { ArrowLeft, CarFront, ClipboardList, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import SupplierNavigation from './SupplierNavigation'

type Req = {
  id: string
  title: string
  vehicle_type: string
  seats: number
  governorate: string
  pickup_address: string
  duration_months: number
  start_date: string
  work_days_per_week: number
  daily_hours: number
  budget_min_egp: number | null
  budget_max_egp: number | null
  details: string | null
}
type Vehicle = {
  id: string
  make: string
  model: string
  model_year: number
  vehicle_type: string
  seats: number
  governorate: string
  with_driver: boolean
  review_status: string
  payment_status: string
  registration_expires_at: string | null
  license_expiry_date: string | null
}
type OwnOffer = {
  id: string
  request_id: string
  status: string
  monthly_price_egp: number
  employee_rental_requests: { title: string } | { title: string }[] | null
}

function matchesVehicleType(vehicleType: string, requestType: string) {
  return requestType === 'أخرى'
    || vehicleType.trim().toLocaleLowerCase('ar') === requestType.trim().toLocaleLowerCase('ar')
    || (requestType === 'فان / ميكروباص' && ['فان', 'ميكروباص'].includes(vehicleType.trim()))
}

export default function EmployeeProviderRequestsPage() {
  const [requests, setRequests] = useState<Req[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [ownOffers, setOwnOffers] = useState<OwnOffer[]>([])
  const [orgId, setOrgId] = useState('')
  const [providerType, setProviderType] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.replace('/?login=1')
      return
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id,organizations!inner(organization_type,approval_status)')
      .eq('user_id', user.id)
      .in('organizations.organization_type', ['individual_owner', 'fleet_supplier'])
      .eq('organizations.approval_status', 'approved')
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.organization_id) {
      setError('هذه الصفحة متاحة لملاك السيارات وموردي الأساطيل المعتمدين فقط.')
      setLoading(false)
      return
    }

    const organizationData = (membership as any).organizations
    const currentProviderType = String(Array.isArray(organizationData)
      ? organizationData[0]?.organization_type
      : organizationData?.organization_type || '')
    setOrgId(membership.organization_id)
    setProviderType(currentProviderType)

    const [requestResult, vehicleResult, offerResult] = await Promise.all([
      supabase.from('employee_rental_requests')
        .select('id,title,vehicle_type,seats,governorate,pickup_address,duration_months,start_date,work_days_per_week,daily_hours,budget_min_egp,budget_max_egp,details')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase.from('vehicles')
        .select('id,make,model,model_year,vehicle_type,seats,governorate,with_driver,review_status,payment_status,registration_expires_at,license_expiry_date')
        .eq('organization_id', membership.organization_id),
      supabase.from('employee_rental_offers')
        .select('id,request_id,status,monthly_price_egp,employee_rental_requests(title)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (requestResult.error) setError('تعذر تحميل الطلبات: ' + requestResult.error.message)
    else setRequests((requestResult.data || []) as Req[])

    if (vehicleResult.error) setError('تعذر تحميل سيارات الأسطول: ' + vehicleResult.error.message)
    else setVehicles((vehicleResult.data || []) as Vehicle[])

    if (offerResult.error) setError('تعذر تحميل عروضك: ' + offerResult.error.message)
    else setOwnOffers((offerResult.data || []) as unknown as OwnOffer[])

    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function eligibleVehiclesFor(request: Req) {
    const today = new Date().toLocaleDateString('en-CA')
    return vehicles.filter(vehicle =>
      vehicle.review_status === 'approved'
      && vehicle.with_driver
      && (vehicle.payment_status === 'verified' || vehicle.payment_status === 'waived')
      && (!vehicle.license_expiry_date || vehicle.license_expiry_date >= today)
      && (providerType !== 'individual_owner' || !vehicle.registration_expires_at || new Date(vehicle.registration_expires_at).getTime() > Date.now())
      && vehicle.governorate === request.governorate
      && matchesVehicleType(vehicle.vehicle_type, request.vehicle_type)
      && vehicle.seats >= request.seats
    )
  }

  function eligibilityMessage(request: Req) {
    const approved = vehicles.filter(vehicle => vehicle.review_status === 'approved')
    if (!approved.length) return 'لا توجد سيارة معتمدة في أسطولك حتى الآن.'
    const withDriver = approved.filter(vehicle => vehicle.with_driver)
    if (!withDriver.length) return 'الطلب يشترط توفير سيارة بسائق، ولا توجد سيارة معتمدة بسائق في أسطولك.'
    const paid = withDriver.filter(vehicle => vehicle.payment_status === 'verified' || vehicle.payment_status === 'waived')
    if (!paid.length) return 'توجد سيارات معتمدة بسائق، لكن رسوم تسجيلها لم يتم تأكيدها بعد.'
    const today = new Date().toLocaleDateString('en-CA')
    const licensed = paid.filter(vehicle => !vehicle.license_expiry_date || vehicle.license_expiry_date >= today)
    if (!licensed.length) return 'رخص السيارات المعتمدة بسائق منتهية؛ حدّث بيانات الترخيص أولًا.'
    const registered = licensed.filter(vehicle => providerType !== 'individual_owner' || !vehicle.registration_expires_at || new Date(vehicle.registration_expires_at).getTime() > Date.now())
    if (!registered.length) return 'انتهت مدة تسجيل السيارة؛ جدّد التسجيل لتتمكن من تقديم عرض.'
    const sameGovernorate = registered.filter(vehicle => vehicle.governorate === request.governorate)
    if (!sameGovernorate.length) return 'لا توجد سيارة مطابقة للمحافظة المطلوبة: ' + request.governorate + '.'
    const sameType = sameGovernorate.filter(vehicle => matchesVehicleType(vehicle.vehicle_type, request.vehicle_type))
    if (!sameType.length) return 'نوع السيارة المطلوب (' + request.vehicle_type + ') غير متوفر في أسطولك حاليًا.'
    return 'عدد المقاعد المطلوب ' + request.seats + '؛ لا توجد سيارة معتمدة تستوفي السعة المطلوبة.'
  }

  async function offer(request: Req) {
    if (!supabase) return
    const vehicleId = selected[request.id]
    const price = Number(prices[request.id])
    if (!eligibleVehiclesFor(request).some(vehicle => vehicle.id === vehicleId) || !Number.isFinite(price) || price <= 0) {
      setError('اختر سيارة مطابقة ومعتمدة بسائق وأدخل السعر الشهري.')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { error: submitError } = await supabase.from('employee_rental_offers').insert({
      request_id: request.id,
      organization_id: orgId,
      vehicle_id: vehicleId,
      created_by: user?.id,
      monthly_price_egp: price,
      driver_notes: messages[request.id] || null,
      message: 'عرض شهري شامل توفير السائق',
    })
    if (submitError) {
      setError(submitError.code === '42501'
        ? 'تعذر إرسال العرض: السيارة غير مؤهلة حاليًا. تأكد من اعتمادها وسداد رسومها وسريان الترخيص ومطابقتها للطلب.'
        : 'تعذر إرسال العرض: ' + submitError.message)
    } else {
      setNotice('تم إرسال العرض بنجاح.')
      await load()
    }
  }

  const eligibleRequestCount = requests.filter(request => eligibleVehiclesFor(request).length > 0).length

  return <main dir="rtl" className="min-h-screen bg-slate-50">
    <header className="mc-supplier-topbar flex min-h-[68px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
      <a href="/workspace/supplier/vehicles" aria-label="My Car عربيتي" className="mc-supplier-brand min-w-0 shrink"><PlatformBrand compact /></a>
      <div className="mc-workspace-header-actions">
        <a href="/messages" aria-label="المحادثات" title="المحادثات" className="mc-top-icon"><MessageCircle size={19} /></a>
        <AccountNotifications />
      </div>
    </header>
    <SupplierNavigation />
    <div className="mx-auto max-w-6xl px-4 pt-3">
      <button type="button" onClick={() => {
        const fallback = '/workspace/supplier/vehicles'
        if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) window.history.back()
        else window.location.assign(fallback)
      }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-300 hover:bg-blue-50">
        <ArrowLeft size={17} /> رجوع
      </button>
    </div>

    <div className="mx-auto max-w-6xl space-y-5 p-4 py-7">
      <section className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#176b9a] p-7 text-white">
        <h1 className="text-3xl font-black">طلبات الموظفين المتاحة</h1>
        <p className="mt-2 text-sm leading-7 text-blue-100">طلبات شهرية بسيارة وسائق. تظهر هنا الطلبات التي اعتمدتها الإدارة، ويمكنك مراجعتها حتى لو لم تتوفر سيارة مطابقة في أسطولك حاليًا.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-xs text-blue-100">الطلبات المنشورة</p>
            <p className="mt-1 text-2xl font-black">{requests.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-xs text-blue-100">متاح لأسطولك تقديم عرض</p>
            <p className="mt-1 text-2xl font-black">{eligibleRequestCount}</p>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-900">عروضي على طلبات الموظفين</h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{ownOffers.length} عرض</span>
        </div>
        {ownOffers.length === 0
          ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">لم ترسل عروضًا بعد.</p>
          : ownOffers.map(ownOffer => {
            const request = Array.isArray(ownOffer.employee_rental_requests) ? ownOffer.employee_rental_requests[0] : ownOffer.employee_rental_requests
            return <article key={ownOffer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
              <div>
                <p className="font-bold">{request?.title || 'طلب سيارة شهرية بسائق'}</p>
                <p className="mt-1 text-xs text-slate-500">{Number(ownOffer.monthly_price_egp).toLocaleString('ar-EG')} جنيه شهريًا · {ownOffer.status === 'submitted' ? 'بانتظار رد الموظف' : ownOffer.status === 'accepted' ? 'تم قبول العرض' : ownOffer.status === 'rejected' ? 'مرفوض' : 'مسحوب'}</p>
              </div>
              {['submitted', 'accepted'].includes(ownOffer.status) && <a href={'/workspace/provider/employee-messages?offer=' + ownOffer.id} className="inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-4 text-xs font-bold text-white">مراسلة الموظف</a>}
            </article>
          })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-900">الطلبات المعتمدة والمتاحة</h2>
          <span className="text-sm text-slate-500">{requests.length} طلب</span>
        </div>
        {loading
          ? <p className="p-8 text-center">جارٍ تحميل الطلبات...</p>
          : requests.length === 0
            ? <p className="rounded-xl border bg-white p-8 text-center text-slate-500">لا توجد طلبات معتمدة متاحة حاليًا. سنعرض الطلبات الجديدة هنا فور اعتمادها.</p>
            : requests.map(request => {
              const eligibleVehicles = eligibleVehiclesFor(request)
              const canOffer = eligibleVehicles.length > 0
              return <article key={request.id} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <ClipboardList className="mt-1 shrink-0 text-blue-700" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black">{request.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{request.vehicle_type} · {request.seats} ركاب · {request.governorate} · {request.duration_months} شهر</p>
                    <p className="mt-1 text-xs text-slate-500">{request.pickup_address} · بداية {request.start_date} · {request.work_days_per_week} أيام أسبوعيًا · {request.daily_hours} ساعات يوميًا</p>
                    {request.details && <p className="mt-2 text-sm leading-6 text-slate-600">{request.details}</p>}
                    {(request.budget_min_egp !== null || request.budget_max_egp !== null) && <p className="mt-2 text-sm font-bold text-blue-800">الميزانية: {request.budget_min_egp ?? '—'} إلى {request.budget_max_egp ?? '—'} جنيه شهريًا</p>}
                  </div>
                </div>

                {canOffer
                  ? <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">متاح لأسطولك تقديم عرض على هذا الطلب.</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm font-bold sm:col-span-2">السيارة
                        <select value={selected[request.id] || ''} onChange={event => setSelected(value => ({ ...value, [request.id]: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border px-3">
                          <option value="">اختر سيارة بسائق</option>
                          {eligibleVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} {vehicle.model_year} · {vehicle.seats} ركاب</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-bold">السعر الشهري
                        <input type="number" min="1" value={prices[request.id] || ''} onChange={event => setPrices(value => ({ ...value, [request.id]: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border px-3" />
                      </label>
                    </div>
                    <label className="block text-sm font-bold">تفاصيل السائق أو العرض
                      <input value={messages[request.id] || ''} onChange={event => setMessages(value => ({ ...value, [request.id]: event.target.value }))} maxLength={1000} className="mt-2 min-h-11 w-full rounded-xl border px-3" />
                    </label>
                    <button onClick={() => void offer(request)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 font-bold text-white"><CarFront size={17} /> إرسال عرض</button>
                  </>
                  : <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="font-bold text-amber-900">لا توجد سيارة مطابقة في أسطولك حاليًا</p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">{eligibilityMessage(request)}</p>
                    <p className="mt-2 text-xs text-amber-800">يمكنك مراجعة الطلب الآن، وسيظل إرسال العرض متوقفًا حتى تتوفر سيارة تستوفي الشروط.</p>
                  </div>}
              </article>
            })}
      </section>
    </div>
  </main>
}
