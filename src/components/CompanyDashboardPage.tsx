import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowLeft, BadgeCheck, BellRing, Building2, CarFront, ClipboardList, CheckCircle2, Clock3, CreditCard, FileBarChart, FileText, MessageCircle, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Users, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AccountNotifications from './AccountNotifications'
import CompanyPageSidebar from './CompanyPageSidebar'
import PlatformBrand from './PlatformBrand'

type OfferRow = { id: string; status: string; monthly_price_egp: number; yearly_price_egp: number | null; vehicle_count: number; organizations?: { id: string; name: string } | { id: string; name: string }[] | null }
type RequestRow = { id: string; title: string; details: string | null; vehicle_type: string; quantity: number; duration_type: string; duration_months: number; governorate: string; with_driver: boolean; status: string; created_at: string; rental_offers?: OfferRow[] | null }
type VehicleRow = { id: string; make: string; model: string; model_year: number; vehicle_type: string; governorate: string; monthly_price_egp: number; yearly_price_egp?: number | null }
type SubscriptionRow = { id: string; plan_name: string; billing_cycle: string; status: string; payment_status: string; ends_at: string | null }
type ManagedRequestRow = { id: string; title: string; status: string; created_at: string }
type OrganizationRow = { id: string; name: string; organization_type: string; approval_status: string | null }

const requestStatus: Record<string, string> = {
  open: 'مفتوح لاستقبال العروض',
  pending: 'قيد المراجعة',
  in_progress: 'جاري التنفيذ',
  searching: 'جارٍ البحث',
  awaiting_payment: 'بانتظار الدفع',
  awaiting_company_decision: 'بانتظار قرارك',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  closed: 'مغلق'
}
const money = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value) || 0)
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'غير محدد'

export default function CompanyDashboardPage({ employeeView = false }: { employeeView?: boolean }) {
  const [organization, setOrganization] = useState<OrganizationRow | null>(null)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [catalogCount, setCatalogCount] = useState<number | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [pendingSubscription, setPendingSubscription] = useState<SubscriptionRow | null>(null)
  const [managedRequests, setManagedRequests] = useState<ManagedRequestRow[] | null>(null)
  const [teamCount, setTeamCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      if (!supabase) {
        setError('تعذر الاتصال بالمنصة. حدّث الصفحة أو حاول مرة أخرى.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        window.location.replace('/?login=1')
        return
      }
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('organization_id,organizations!inner(id,name,organization_type,approval_status)')
        .eq('user_id', authData.user.id)
        .eq('organizations.organization_type', 'company')
        .limit(1)
        .maybeSingle()
      if (membershipError || !membership?.organization_id) {
        if (alive) {
          setError('لم نتمكن من تحديد الشركة المرتبطة بحسابك. سجّل الخروج ثم ادخل مرة أخرى أو تواصل مع الدعم.')
          setLoading(false)
        }
        return
      }
      const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations
      if (!org || org.organization_type !== 'company') {
        window.location.replace('/workspace')
        return
      }
      const organizationRow = { ...org, id: membership.organization_id } as OrganizationRow
      const today = new Date().toLocaleDateString('en-CA')
      const [requestResult, vehicleResult, catalogResult, subscriptionResult, managedResult, membersResult] = await Promise.all([
        supabase.from('rental_requests')
          .select('id,title,details,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,status,created_at,rental_offers(id,status,monthly_price_egp,yearly_price_egp,vehicle_count,organizations(id,name))')
          .eq('organization_id', membership.organization_id)
          .order('created_at', { ascending: false }),
        supabase.from('vehicles')
          .select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,yearly_price_egp')
          .eq('review_status', 'approved')
          .in('payment_status', ['verified', 'waived'])
          .or(`license_expiry_date.is.null,license_expiry_date.gte.${today}`)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase.from('vehicles').select('id', { count: 'exact', head: true })
          .eq('review_status', 'approved')
          .in('payment_status', ['verified', 'waived'])
          .or(`license_expiry_date.is.null,license_expiry_date.gte.${today}`),
        supabase.from('company_subscriptions')
          .select('id,plan_name,billing_cycle,status,payment_status,ends_at')
          .eq('organization_id', membership.organization_id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.from('managed_sourcing_requests')
          .select('id,title,status,created_at')
          .eq('company_organization_id', membership.organization_id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.rpc('company_list_members')
      ])
      if (!alive) return
      setOrganization(organizationRow)
      if (requestResult.error) setError('تعذر تحميل طلبات الشركة: ' + requestResult.error.message)
      else setRequests((requestResult.data || []) as unknown as RequestRow[])
      if (!vehicleResult.error) setVehicles((vehicleResult.data || []) as VehicleRow[])
      if (!catalogResult.error) setCatalogCount(catalogResult.count || 0)
      if (!subscriptionResult.error) {
        const rows = (subscriptionResult.data || []) as SubscriptionRow[]
        const now = Date.now()
        setSubscription(rows.find(row => row.status === 'active' && ['verified', 'waived'].includes(row.payment_status) && !!row.ends_at && new Date(row.ends_at).getTime() > now) || null)
        setPendingSubscription(rows.find(row => row.status === 'pending' || row.payment_status === 'submitted') || null)
      }
      if (!managedResult.error) setManagedRequests((managedResult.data || []) as ManagedRequestRow[])
      if (!membersResult.error && Array.isArray(membersResult.data)) setTeamCount(membersResult.data.length)
      setLoading(false)
    }
    void load()
    return () => { alive = false }
  }, [refresh])

  const stats = useMemo(() => {
    const offers = requests.flatMap(request => request.rental_offers || [])
    const terminal = ['completed', 'cancelled', 'closed']
    return {
      totalRequests: requests.length,
      activeRequests: requests.filter(request => !terminal.includes(request.status)).length,
      openRequests: requests.filter(request => request.status === 'open').length,
      totalOffers: offers.length,
      pendingOffers: offers.filter(offer => ['submitted', 'pending'].includes(offer.status)).length,
      acceptedOffers: offers.filter(offer => offer.status === 'accepted').length,
      rejectedOffers: offers.filter(offer => ['rejected', 'withdrawn'].includes(offer.status)).length,
      completedRequests: requests.filter(request => request.status === 'completed').length,
      requestsWithoutOffers: requests.filter(request => request.status === 'open' && !(request.rental_offers || []).length).length,
      awaitingDecision: requests.filter(request => request.status === 'awaiting_company_decision' || (request.rental_offers || []).some(offer => ['submitted', 'pending'].includes(offer.status))).length
    }
  }, [requests])

  const activeManagedRequests = (managedRequests || []).filter(request => !['completed', 'cancelled', 'rejected', 'closed'].includes(request.status)).length
  const companyApproval = organization?.approval_status === 'approved'
    ? { label: 'حساب معتمد', detail: 'خدمات الشركة متاحة حسب باقتك وصلاحيات حسابك.', icon: BadgeCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
    : organization?.approval_status === 'pending_review'
      ? { label: 'الحساب قيد المراجعة', detail: 'فريق My Car يراجع بيانات الشركة حاليًا.', icon: Clock3, tone: 'border-amber-200 bg-amber-50 text-amber-900' }
      : organization?.approval_status === 'rejected'
        ? { label: 'الحساب يحتاج إلى استكمال', detail: 'راجع بيانات الحساب أو تواصل مع الدعم لمعرفة المطلوب.', icon: AlertTriangle, tone: 'border-rose-200 bg-rose-50 text-rose-800' }
        : { label: 'حالة الحساب', detail: 'يمكنك متابعة حالة اعتماد حساب الشركة من هنا.', icon: ShieldCheck, tone: 'border-slate-200 bg-slate-50 text-slate-700' }
  const ApprovalIcon = companyApproval.icon
  const subscriptionLabel = subscription
    ? { title: subscription.plan_name, status: 'اشتراك نشط', detail: 'ينتهي في ' + dateLabel(subscription.ends_at), tone: 'text-emerald-800 bg-emerald-50 border-emerald-200' }
    : pendingSubscription
      ? { title: pendingSubscription.plan_name, status: 'طلب الاشتراك قيد المراجعة', detail: 'تم استلام طلبك، وسيتم تحديث الحالة بعد مراجعة التحويل.', tone: 'text-amber-900 bg-amber-50 border-amber-200' }
      : { title: 'لا يوجد اشتراك نشط', status: 'راجع الباقات المتاحة', detail: 'اختر الباقة المناسبة لاحتياجات شركتك وتعرّف على المزايا والحدود.', tone: 'text-slate-700 bg-slate-50 border-slate-200' }

  return <>
    <CompanyPageSidebar active="overview" employeeView={employeeView} />
    <main dir="rtl" className="mc-company-page-with-sidebar min-h-screen bg-[linear-gradient(180deg,#f3f7fd_0%,#f8fbff_44%,#eef3fa_100%)] text-slate-900">
      <header className="mc-company-dashboard-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(20,55,95,.05)] backdrop-blur-xl">
        <div className="mc-company-dashboard-topbar-inner mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="mc-company-dashboard-heading min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-400">MY CAR · {employeeView ? "مساحة موظف الشركة" : "مساحة الشركات"}</span>
            <h1 className="mt-0.5 truncate text-base font-black text-slate-900 sm:text-lg">لوحة متابعة الشركة</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 sm:px-4 sm:text-sm">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">تحديث البيانات</span>
            </button>
            <a href="/messages" aria-label="المحادثات" title="المحادثات" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"><MessageCircle size={18} /></a>
            <AccountNotifications />
            <PlatformBrand compact />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="mc-company-dark-hero relative isolate overflow-hidden rounded-[28px] bg-gradient-to-l from-[#071d38] via-[#103d6b] to-[#087eae] p-5 text-white shadow-[0_22px_55px_-28px_rgba(5,36,75,.55)] sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 -z-10 h-64 w-64 rounded-full border-[30px] border-white/5" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/3 -z-10 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-cyan-100"><Building2 size={14} /> مركز إدارة احتياجات النقل والتشغيل</span>
              <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">أهلًا بك في مساحة {organization?.name || 'شركتك'}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">{employeeView ? "تابع طلبات التأجير الخاصة بشركتك، راجع العروض الواردة، واستكشف السيارات المتاحة من مساحة عملك." : "كل ما تحتاجه شركتك للبحث عن السيارات، نشر طلبات التأجير، مقارنة العروض، متابعة الاشتراك وإدارة فريق العمل — من لوحة واحدة واضحة."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold ' + companyApproval.tone}><ApprovalIcon size={14} />{companyApproval.label}</span>
                {subscription && <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/40 bg-emerald-300/10 px-3 py-1.5 text-xs font-extrabold text-emerald-100"><CreditCard size={14} />{subscription.plan_name}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a href="/workspace/company/requests/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#123b68] shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50"><Plus size={18} /> إنشاء طلب سيارات</a>
              <a href="/workspace/catalog" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-extrabold text-white transition hover:bg-white/15"><CarFront size={18} /> استكشاف السيارات</a>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-2 border-t border-white/15 pt-4 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-blue-100">طلباتك المسجلة</span><strong className="mt-1 block text-xl font-black tabular-nums">{loading ? '—' : stats.totalRequests.toLocaleString('ar-EG')}</strong></div>
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-blue-100">العروض الواردة</span><strong className="mt-1 block text-xl font-black tabular-nums">{loading ? '—' : stats.totalOffers.toLocaleString('ar-EG')}</strong></div>
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-blue-100">طلبات نشطة</span><strong className="mt-1 block text-xl font-black tabular-nums">{loading ? '—' : stats.activeRequests.toLocaleString('ar-EG')}</strong></div>
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-blue-100">سيارات متاحة بالمنصة</span><strong className="mt-1 block text-xl font-black tabular-nums">{loading || catalogCount === null ? '—' : catalogCount.toLocaleString('ar-EG')}</strong></div>
          </div>
        </section>

        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"><span>{error}</span><button type="button" onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 font-bold"><RefreshCw size={14} /> إعادة المحاولة</button></div>}

        {loading ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</section> : <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'الطلبات النشطة', value: stats.activeRequests, note: 'احتياجات ما زالت قيد المتابعة', icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
              { label: 'العروض المستلمة', value: stats.totalOffers, note: 'من ملاك السيارات وموردي الأساطيل', icon: FileText, tone: 'bg-cyan-50 text-cyan-700' },
              { label: 'عروض تحتاج قرارك', value: stats.pendingOffers, note: 'راجع الأسعار والتفاصيل واختر الأنسب', icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
              { label: 'عروض مقبولة', value: stats.acceptedOffers, note: 'العروض التي وافقت عليها شركتك', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' }
            ].map(item => <article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_20px_rgba(15,40,75,.045)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-extrabold text-slate-500">{item.label}</span><strong className="mt-2 block text-3xl font-black tabular-nums text-slate-950">{item.value.toLocaleString('ar-EG')}</strong></div><span className={'grid h-11 w-11 place-items-center rounded-2xl ' + item.tone}><item.icon size={21} /></span></div><p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{item.note}</p></article>)}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.85fr)]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-blue-700">مركز المتابعة</p><h3 className="mt-1 text-lg font-black">أين وصلت طلبات شركتك؟</h3><p className="mt-1 text-xs text-slate-500">ملخص سريع لحالة الطلبات والعروض المرتبطة بها.</p></div><a href="/workspace/company/requests" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:border-blue-300 hover:text-blue-700">كل الطلبات <ArrowLeft size={14} /></a></div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'تستقبل عروضًا', value: stats.openRequests, tone: 'bg-blue-50 text-blue-800', icon: Activity },
                    { label: 'بانتظار قرارك', value: stats.awaitingDecision, tone: 'bg-amber-50 text-amber-800', icon: Clock3 },
                    { label: 'بدون عروض بعد', value: stats.requestsWithoutOffers, tone: 'bg-slate-100 text-slate-700', icon: FileText },
                    { label: 'طلبات مكتملة', value: stats.completedRequests, tone: 'bg-emerald-50 text-emerald-800', icon: CheckCircle2 }
                  ].map(item => <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"><span className={'grid h-9 w-9 place-items-center rounded-xl ' + item.tone}><item.icon size={17} /></span><strong className="mt-3 block text-2xl font-black tabular-nums">{item.value.toLocaleString('ar-EG')}</strong><span className="mt-1 block text-xs font-bold text-slate-600">{item.label}</span></div>)}
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{stats.acceptedOffers.toLocaleString('ar-EG')} عرض مقبول</span><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-800">{stats.rejectedOffers.toLocaleString('ar-EG')} عرض مرفوض أو مسحوب</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">{stats.totalRequests.toLocaleString('ar-EG')} طلب إجمالي</span></div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:px-6"><div><h3 className="font-black text-slate-950">أحدث طلبات الشركة</h3><p className="mt-1 text-xs text-slate-500">آخر احتياجات التأجير التي سجلتها شركتك.</p></div><a href="/workspace/company/requests/new" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-extrabold text-white"><Plus size={14} /> طلب جديد</a></div>
                {requests.length ? <div className="divide-y divide-slate-100">{requests.slice(0, 5).map(request => <article key={request.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><h4 className="truncate text-sm font-extrabold text-slate-900">{request.title}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{request.vehicle_type} · {request.quantity} سيارة · {request.governorate} · {request.duration_type === 'yearly' ? 'سنوي' : 'شهري'} · {request.duration_months} شهر{request.with_driver ? ' · بسائق' : ''}</p><p className="mt-1 text-[11px] text-slate-400">تاريخ الطلب: {dateLabel(request.created_at)}</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700">{requestStatus[request.status] || request.status}</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold text-blue-800">{(request.rental_offers || []).length} عرض</span></div></article>)}</div> : <div className="p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardList size={22} /></span><h4 className="mt-3 font-extrabold">لم تنشئ طلبات حتى الآن</h4><p className="mt-1 text-sm text-slate-500">ابدأ بطلب سيارات بالمواصفات والمدة التي تحتاجها شركتك.</p><a href="/workspace/company/requests/new" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white"><Plus size={15} /> إنشاء أول طلب</a></div>}
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 sm:px-6"><div><h3 className="font-black text-slate-950">سيارات متاحة للاستعراض</h3><p className="mt-1 text-xs text-slate-500">نماذج من السيارات المعتمدة والمتاحة حاليًا.</p></div><a href="/workspace/catalog" className="text-xs font-extrabold text-blue-700">فتح الكتالوج ←</a></div>
                {vehicles.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{vehicles.map(vehicle => <article key={vehicle.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><CarFront size={21} /></span><div className="min-w-0 flex-1"><h4 className="truncate text-sm font-extrabold">{vehicle.make} {vehicle.model} · {vehicle.model_year}</h4><p className="mt-1 text-xs text-slate-500">{vehicle.vehicle_type} · {vehicle.governorate}</p><p className="mt-1 text-xs font-extrabold text-blue-800">{money(vehicle.monthly_price_egp)} جنيه / شهر</p></div></article>)}</div> : <p className="p-6 text-center text-sm text-slate-500">لا توجد سيارات معتمدة ومتاحة للعرض حاليًا.</p>}
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={21} /></span><div><h3 className="font-black">حالة حساب الشركة</h3><p className="mt-0.5 text-xs text-slate-500">حالة اعتماد بيانات شركتك.</p></div></div>
                <div className={'mt-4 rounded-xl border p-3 ' + companyApproval.tone}><div className="flex items-center gap-2 text-sm font-extrabold"><ApprovalIcon size={17} />{companyApproval.label}</div><p className="mt-1 text-xs leading-5">{companyApproval.detail}</p></div>
                {!employeeView && <a href="/workspace/company/account" className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-blue-700">مراجعة بيانات الحساب <ArrowLeft size={14} /></a>}
              </section>

              <section className={employeeView ? "hidden" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"}>
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><CreditCard size={21} /></span><div><h3 className="font-black">اشتراك الشركة</h3><p className="mt-0.5 text-xs text-slate-500">الباقة وحالة التفعيل.</p></div></div><a href="/workspace/company/subscriptions" className="text-xs font-extrabold text-blue-700">إدارة</a></div>
                <div className={'mt-4 rounded-xl border p-3 ' + subscriptionLabel.tone}><span className="text-[11px] font-extrabold">{subscriptionLabel.status}</span><strong className="mt-1 block text-base font-black">{subscriptionLabel.title}</strong><p className="mt-1 text-xs leading-5">{subscriptionLabel.detail}</p></div>
                <a href="/workspace/company/subscriptions" className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-extrabold text-white"><CreditCard size={15} /> عرض الباقات وإدارة الاشتراك</a>
              </section>

              <section className={employeeView ? "hidden" : "mc-company-dark-card overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-[#0e3260] via-[#0b2b50] to-[#071a32] p-5 text-white shadow-sm"}>
                <div className="flex items-center justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/10 text-cyan-200"><Search size={22} /></span><span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-[10px] font-extrabold text-cyan-100">خدمة اختيارية</span></div>
                <h3 className="mt-4 text-lg font-black">فوّض My Car للبحث نيابةً عن شركتك</h3>
                <p className="mt-2 text-xs leading-6 text-blue-100">حدد احتياجك، ودع فريق المنصة يبحث لدى الملاك وموردي الأساطيل ويجهز لك ترشيحات وعروضًا للمقارنة قبل اتخاذ القرار.</p>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="text-xs text-blue-100">طلبات بحث قيد المتابعة</span><strong className="text-lg font-black tabular-nums">{managedRequests === null ? '—' : activeManagedRequests.toLocaleString('ar-EG')}</strong></div>
                <a href="/workspace/company/managed-sourcing" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-xs font-extrabold text-blue-950 hover:bg-cyan-50">إدارة خدمة البحث <ArrowLeft size={14} /></a>
              </section>

              <section className={employeeView ? "hidden" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"}>
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Users size={19} /></span><div><h3 className="font-black">فريق الشركة</h3><p className="mt-0.5 text-xs text-slate-500">إدارة المستخدمين والصلاحيات.</p></div></div><strong className="text-xl font-black tabular-nums">{teamCount === null ? '—' : teamCount.toLocaleString('ar-EG')}</strong></div>
                <a href="/workspace/company/team" className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-extrabold text-slate-700 hover:border-blue-300 hover:text-blue-700"><Users size={15} /> إدارة موظفي الشركة</a>
              </section>
            </aside>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-blue-700">كل الأدوات في مكان واحد</p><h3 className="mt-1 text-lg font-black">إدارة عمليات شركتك</h3><p className="mt-1 text-xs text-slate-500">انتقل مباشرةً إلى الخدمة التي تحتاجها.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">{teamCount === null ? 'مساحة عمل متكاملة' : teamCount.toLocaleString('ar-EG') + ' عضو بالفريق'}</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { href: '/workspace/company/requests', title: 'طلبات التأجير', description: 'تابع الطلبات والعروض الواردة', icon: FileText, tone: 'bg-blue-50 text-blue-700' },
                { href: '/workspace/company/insights', title: 'المؤشرات والتقارير', description: 'راجع نشاط شركتك وأداء الطلبات', icon: FileBarChart, tone: 'bg-violet-50 text-violet-700' },
                { href: '/workspace/company/alerts', title: 'التنبيهات الذكية', description: 'احفظ احتياجاتك وتابع السيارات المطابقة', icon: BellRing, tone: 'bg-amber-50 text-amber-700' },
                { href: '/workspace/company/team', title: 'إدارة الفريق', description: 'أضف الموظفين ونظم الصلاحيات', icon: Users, tone: 'bg-emerald-50 text-emerald-700' },
                { href: '/workspace/company/managed-sourcing', title: 'البحث المفوّض', description: 'اطلب من فريق My Car البحث نيابةً عنك', icon: Search, tone: 'bg-cyan-50 text-cyan-700' },
                { href: '/workspace/company/subscriptions', title: 'الاشتراكات والباقات', description: 'راجع مزايا الباقة وحالة السداد', icon: CreditCard, tone: 'bg-indigo-50 text-indigo-700' },
                { href: '/messages', title: 'المحادثات', description: 'تابع تواصلك مع مقدمي السيارات', icon: MessageCircle, tone: 'bg-sky-50 text-sky-700' },
                { href: '/services', title: 'خدمات السيارات', description: 'استكشف خدمات الصيانة والتشغيل', icon: Wrench, tone: 'bg-orange-50 text-orange-700' }
              ].filter(item => !employeeView || ['/workspace/company/requests','/messages','/services'].includes(item.href)).map(item => <a key={item.href} href={item.href} className="group flex min-h-[104px] items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"><span className={'grid h-11 w-11 shrink-0 place-items-center rounded-xl ' + item.tone}><item.icon size={20} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-extrabold text-slate-900">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></span><ArrowLeft size={15} className="shrink-0 text-slate-400 transition group-hover:-translate-x-1 group-hover:text-blue-700" /></a>)}
            </div>
          </section>

          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white/70 p-4 text-[11px] leading-6 text-slate-500"><Sparkles size={15} className="mt-0.5 shrink-0 text-blue-600" /> تعرض هذه اللوحة بيانات الطلبات والعروض المسجلة داخل المنصة. My Car عربيتي وسيط إلكتروني لربط الشركات بمقدمي السيارات، ولا تضمن توافر المركبات أو إتمام التعاقد بين الأطراف.</p>
        </>}
      </div>
    </main>
  </>
}

