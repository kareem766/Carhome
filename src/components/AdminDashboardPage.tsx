import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowLeft, BellRing, Building2, CarFront, CheckCircle2, ClipboardCheck, CreditCard, Gauge, Megaphone, RefreshCw, Settings2, ShieldCheck, Users, Wallet, BriefcaseBusiness } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type Metric = { key: string; label: string; value: number | string; note: string; icon: typeof Users; tone: string }
type Counts = { users: number; organizations: number; approvedOrganizations: number; pendingOrganizations: number; vehicles: number; approvedVehicles: number; pendingVehicles: number; pendingPayments: number; subscriptions: number; activeAds: number; requests: number; suppliers: number }
const initial: Counts = { users: 0, organizations: 0, approvedOrganizations: 0, pendingOrganizations: 0, vehicles: 0, approvedVehicles: 0, pendingVehicles: 0, pendingPayments: 0, subscriptions: 0, activeAds: 0, requests: 0, suppliers: 0 }
const shortcuts = [
 { href: '/workspace/admin/vehicle-reviews', title: 'مراجعة السيارات والتحويلات', desc: 'اعتماد السيارات ومراجعة إثباتات الدفع', icon: ClipboardCheck, tone: 'from-sky-500 to-blue-700' },
 { href: '/workspace/admin/managed-accounts', title: 'إدارة حسابات المستخدمين', desc: 'إنشاء الحسابات وتعديلها وتعطيلها أو حذفها', icon: Users, tone: 'from-indigo-500 to-violet-700' },
 { href: '/workspace/admin/subscription-plans', title: 'اشتراكات الشركات', desc: 'التحكم في الباقات والأسعار', icon: CreditCard, tone: 'from-emerald-500 to-teal-700' },
 { href: '/workspace/admin/advertising-plans', title: 'باقات الإعلانات', desc: 'إدارة باقات الترويج وأسعارها', icon: Megaphone, tone: 'from-orange-500 to-amber-600' },
 { href: '/workspace/admin/payment-information', title: 'معلومات الدفع', desc: 'بيانات التحويلات المعتمدة للمنصة', icon: Wallet, tone: 'from-cyan-500 to-sky-700' },
 { href: '/workspace/admin/platform-settings', title: 'إعدادات وهوية المنصة', desc: 'الاسم والشعار والألوان وإعدادات التسجيل', icon: Settings2, tone: 'from-slate-600 to-slate-800' },
 { href: '/workspace/admin/communications', title: 'الإشعارات والبانرات', desc: 'إدارة الرسائل والإعلانات داخل المنصة', icon: BellRing, tone: 'from-pink-500 to-rose-700' },
 { href: '/workspace/admin/analytics', title: 'التقارير والتحليلات', desc: 'تصفية البيانات وتصدير تقارير CSV وPDF', icon: Activity, tone: 'from-violet-500 to-purple-700' },
]
export default function AdminDashboardPage() {
 const [authorized, setAuthorized] = useState(false)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [counts, setCounts] = useState<Counts>(initial)
 const [updatedAt, setUpdatedAt] = useState('')
 const load = useCallback(async () => {
  if (!supabase) { window.location.replace('/?login=1'); return }
  setLoading(true); setError('')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) { window.location.replace('/?login=1'); return }
  const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (adminError || !admin) { setAuthorized(false); setError(adminError?.message || 'هذا الحساب غير مصرح له بدخول لوحة الإدارة.'); setLoading(false); return }
  setAuthorized(true)
  const count = async (table: string, filters: Array<[string, string]> = []) => {
   let q = supabase!.from(table).select('*', { count: 'exact', head: true })
   for (const [column, value] of filters) q = q.eq(column, value)
   const result = await q
   if (result.error) throw new Error(table + ': ' + result.error.message)
   return result.count || 0
  }
  try {
   const values = await Promise.all([
    count('profiles'),
    count('organizations'),
    count('organizations', [['approval_status', 'approved']]),
    count('organizations', [['approval_status', 'pending']]),
    count('vehicles'),
    count('vehicles', [['review_status', 'approved']]),
    count('vehicles', [['review_status', 'pending']]),
    count('vehicle_payment_submissions', [['review_status', 'pending']]),
    count('company_subscriptions'),
    count('vehicle_promotions', [['status', 'active']]),
    count('rental_requests'),
    count('organizations', [['organization_type', 'fleet_supplier']]),
   ])
   setCounts({ users: values[0], organizations: values[1], approvedOrganizations: values[2], pendingOrganizations: values[3], vehicles: values[4], approvedVehicles: values[5], pendingVehicles: values[6], pendingPayments: values[7], subscriptions: values[8], activeAds: values[9], requests: values[10], suppliers: values[11] })
   setUpdatedAt(new Date().toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }))
  } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل مؤشرات لوحة الإدارة.') }
  finally { setLoading(false) }
 }, [])
 useEffect(() => { void load() }, [load])
 const metrics: Metric[] = [
  { key: 'orgs', label: 'حسابات المؤسسات', value: counts.organizations, note: `${counts.approvedOrganizations} معتمد · ${counts.pendingOrganizations} بانتظار المراجعة`, icon: Building2, tone: 'blue' },
  { key: 'vehicles', label: 'السيارات المسجلة', value: counts.vehicles, note: `${counts.approvedVehicles} معتمد · ${counts.pendingVehicles} قيد المراجعة`, icon: CarFront, tone: 'cyan' },
  { key: 'users', label: 'ملفات المستخدمين', value: counts.users, note: 'إجمالي الملفات المسجلة على المنصة', icon: Users, tone: 'violet' },
  { key: 'payments', label: 'تحويلات تنتظر المراجعة', value: counts.pendingPayments, note: 'إثباتات دفع رسوم تسجيل السيارات', icon: Wallet, tone: 'amber' },
  { key: 'requests', label: 'طلبات التأجير', value: counts.requests, note: 'كل طلبات التأجير المسجلة', icon: ClipboardCheck, tone: 'emerald' },
  { key: 'ads', label: 'الإعلانات النشطة', value: counts.activeAds, note: 'إعلانات ترويج السيارات النشطة', icon: Megaphone, tone: 'rose' },
 ]
 const toneClasses: Record<string, string> = { blue: 'bg-blue-50 text-blue-700 ring-blue-100', cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100', violet: 'bg-violet-50 text-violet-700 ring-violet-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100', rose: 'bg-rose-50 text-rose-700 ring-rose-100' }
 return <main dir="rtl" className="min-h-screen bg-[#f3f7fc] text-slate-900">
  <div className="mx-auto max-w-[1680px] px-3 py-4 sm:px-6 lg:px-8">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:px-5">
    <PlatformBrand />
    <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:inline-flex sm:items-center sm:gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/>مركز الإدارة</span><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> تحديث</button><AccountNotifications /></div>
   </header>
   <AdminPageNavigation />
   <section className="relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-l from-[#0b2340] via-[#123a61] to-[#1768a6] px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
    <div className="pointer-events-none absolute -left-12 -top-24 h-64 w-64 rounded-full border-[28px] border-white/5"/><div className="pointer-events-none absolute -left-4 -bottom-28 h-72 w-72 rounded-full border-[34px] border-cyan-300/10"/>
    <div className="relative flex flex-wrap items-end justify-between gap-5">
     <div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><Gauge size={15}/> MY CAR · CONTROL CENTER</div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">لوحة الإدارة الرئيسية</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">نظرة تشغيلية موحّدة لإدارة الحسابات والسيارات والمدفوعات والاشتراكات وإعدادات المنصة من مكان واحد.</p></div>
     <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xs text-blue-100">حالة المنصة</p><p className="mt-1 flex items-center gap-2 font-extrabold"><ShieldCheck size={18} className="text-emerald-300"/> لوحة الإدارة متصلة</p><p className="mt-1 text-[11px] text-blue-100/80">{updatedAt ? `آخر تحديث: ${updatedAt}` : 'يتم تحميل البيانات الفعلية'}</p></div>
    </div>
   </section>
   {!authorized && !loading ? <section className="mt-5 rounded-2xl border border-red-200 bg-white p-6 font-bold text-red-700">{error || 'غير مصرح بالدخول.'}</section> : <>
    {error && <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(({key,label,value,note,icon:Icon,tone}) => <article key={key} className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-3 text-3xl font-black tabular-nums text-[#102b47]">{loading ? '—' : value.toLocaleString('ar-EG')}</p></div><span className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ${toneClasses[tone]}`}><Icon size={22}/></span></div><p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">{note}</p></article>)}</section>
    <section className="mt-7 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
     <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-[#102b47]">إدارة المنصة</h2><p className="mt-1 text-sm text-slate-500">انتقل مباشرة إلى القسم المطلوب.</p></div><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><Settings2 size={21}/></span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{shortcuts.map(({href,title,desc,icon:Icon,tone}) => <a key={href} href={href} className="group flex min-h-[104px] items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-sm`}><Icon size={20}/></span><span className="min-w-0 flex-1"><b className="block text-sm font-extrabold text-slate-800">{title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{desc}</span></span><ArrowLeft size={16} className="mt-1 shrink-0 text-slate-400 transition group-hover:-translate-x-1 group-hover:text-blue-700"/></a>)}</div></div>
     <aside className="space-y-5"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-black text-[#102b47]"><Activity size={19} className="text-blue-700"/>ملخص المراجعات</h2><div className="mt-4 space-y-3">{[{label:'مؤسسات تنتظر الاعتماد',value:counts.pendingOrganizations,href:'/workspace/admin/vehicle-reviews#admin-organizations'},{label:'سيارات تنتظر المراجعة',value:counts.pendingVehicles,href:'/workspace/admin/vehicle-reviews#admin-vehicles'},{label:'تحويلات تنتظر التدقيق',value:counts.pendingPayments,href:'/workspace/admin/vehicle-reviews#admin-vehicles'}].map(row=><a href={row.href} key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm hover:bg-blue-50"><span className="text-slate-600">{row.label}</span><span className={`min-w-9 rounded-lg px-2 py-1 text-center font-black ${row.value ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{loading ? '—' : row.value}</span></a>)}</div><a href="/workspace/admin/vehicle-reviews" className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700">فتح مركز المراجعات<ArrowLeft size={16}/></a></div>
     <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5"><h2 className="font-black text-[#102b47]">معلومات سريعة</h2><div className="mt-3 space-y-3 text-sm"><p className="flex items-center justify-between gap-3"><span className="text-slate-600">موردو الأساطيل</span><b>{loading ? '—' : counts.suppliers.toLocaleString('ar-EG')}</b></p><p className="flex items-center justify-between gap-3"><span className="text-slate-600">اشتراكات الشركات</span><b>{loading ? '—' : counts.subscriptions.toLocaleString('ar-EG')}</b></p><p className="flex items-center justify-between gap-3"><span className="text-slate-600">إعلانات نشطة</span><b>{loading ? '—' : counts.activeAds.toLocaleString('ar-EG')}</b></p></div><p className="mt-4 border-t border-blue-100 pt-3 text-[11px] leading-5 text-slate-500">الأرقام تُقرأ من قاعدة بيانات My Car مباشرة. لا تُعرض هنا أي مبالغ تخص تعاملات التأجير بين المالك والشركة.</p></div></aside>
    </section>
   </>}
   <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> مركز إدارة My Car</span><span>واجهة الإدارة · بيانات تشغيلية فعلية</span></footer>
  </div>
 </main>
}
