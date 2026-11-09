import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, CarFront, Users, Megaphone, CreditCard, BriefcaseBusiness, UserCheck, Headset, ArrowUpRight, LayoutDashboard, RefreshCw, Search } from 'lucide-react'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

const groups = [
  { title: 'مراجعة التسجيل والاعتماد', description: 'طلبات تحتاج فحص بيانات أو اتخاذ قرار اعتماد.', items: [
    { label: 'السيارات والتحويلات', detail: 'مراجعة بيانات السيارات والصور ورسوم التسجيل وإثباتات الدفع.', href: '/workspace/admin/vehicle-reviews', icon: CarFront },
    { label: 'الحسابات والمؤسسات', detail: 'مراجعة حسابات الملاك والشركات وموردي الأساطيل.', href: '/workspace/admin/vehicle-reviews', icon: Users },
    { label: 'الإعلانات', detail: 'مراجعة طلبات الإعلانات العادية والمميزة والتحقق من الدفع.', href: '/workspace/admin/vehicle-reviews', icon: Megaphone },
    { label: 'اشتراكات الشركات', detail: 'مراجعة طلبات الاشتراك والمدفوعات وتفعيل الباقات.', href: '/workspace/admin/company-subscriptions', icon: CreditCard },
  ]},
  { title: 'مراجعة الخدمات والطلبات', description: 'طلبات الخدمات والتشغيل التي تصل إلى الإدارة.', items: [
    { label: 'طلبات الموظفين', detail: 'مراجعة طلبات الموظفين المنشورة من الشركات.', href: '/workspace/admin/employee-requests', icon: UserCheck },
    { label: 'تفويضات البحث', detail: 'متابعة طلبات البحث نيابةً عن الشركات ومراحلها.', href: '/workspace/admin/managed-sourcing', icon: BriefcaseBusiness },
    { label: 'الدعم والتذاكر', detail: 'متابعة استفسارات ومشكلات المستخدمين.', href: '/workspace/admin/support', icon: Headset },
  ]},
]
export default function AdminReviewCenterPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [query, setQuery] = useState('')
  const loadCounts = useCallback(async () => {
    const client = supabase
    if (!client) return
    setRefreshing(true)
    try {
      const checks = [
        ['vehicles', () => client.from('vehicles').select('id', { count: 'exact', head: true }).in('review_status', ['pending_review','pending_payment'])],
        ['payments', () => client.from('vehicle_payment_submissions').select('id', { count: 'exact', head: true }).in('review_status', ['pending','pending_review'])],
        ['promotions', () => client.from('vehicle_promotions').select('id', { count: 'exact', head: true }).eq('status','pending_review').eq('payment_status','pending')],
        ['companySubscriptions', () => client.from('company_subscriptions').select('id', { count: 'exact', head: true }).in('payment_status',['submitted','pending'])],
        ['employeeRequests', () => client.from('employee_rental_requests').select('id', { count: 'exact', head: true }).eq('status','pending_review')],
        ['sourcingSubscriptions', () => client.from('managed_sourcing_subscriptions').select('id', { count: 'exact', head: true }).in('payment_status',['submitted','pending'])],
      ] as const
      const results = await Promise.all(checks.map(async ([key, run]) => {
        const result = await run()
        return [key, result.error ? null : (result.count ?? 0)] as const
      }))
      setCounts(Object.fromEntries(results))
    } finally {
      setRefreshing(false)
    }
  }, [])
  useEffect(() => {
    let active = true
    async function verify() {
      const client = supabase
      if (!client) { window.location.replace('/?login=1'); return }
      const { data: auth } = await client.auth.getUser()
      if (!auth.user) { window.location.replace('/?login=1'); return }
      const { data, error } = await client.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
      if (!active) return
      if (error || !data) { window.location.replace('/'); return }
      setAuthorized(true)
      setLoading(false)
      void loadCounts()
    }
    void verify()
    return () => { active = false }
  }, [loadCounts])
  const searchableGroups = useMemo(() => groups.map(group => ({ ...group, items: group.items.filter(item => (item.label + ' ' + item.detail).toLowerCase().includes(query.trim().toLowerCase())) })).filter(group => group.items.length), [query])
  const countFor = (label: string) => label === 'السيارات والتحويلات' ? (counts.vehicles ?? 0) + (counts.payments ?? 0) : label === 'الإعلانات' ? counts.promotions : label === 'اشتراكات الشركات' ? counts.companySubscriptions : label === 'طلبات الموظفين' ? counts.employeeRequests : label === 'تفويضات البحث' ? counts.sourcingSubscriptions : null
  if (loading || !authorized) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><p className="font-bold text-slate-600">جارٍ التحقق من صلاحيات الإدارة...</p></main>
  return <><AdminPageNavigation/><main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-7 lg:px-9">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#17466b] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100"><ClipboardCheck size={15}/> مركز المراجعات</div>
            <h1 className="text-2xl font-black sm:text-3xl">كل المراجعات والطلبات في مكان واحد</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">اختر نوع الطلب للوصول مباشرةً إلى شاشة المراجعة الحالية. تم الإبقاء على مسارات الاعتماد والصلاحيات الحالية دون تغيير.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void loadCounts()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/> تحديث الأعداد</button>
            <a href="/workspace/admin" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"><LayoutDashboard size={17}/> لوحة التحكم</a>
          </div>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"السيارات والتحويلات",value:(counts.vehicles ?? 0)+(counts.payments ?? 0)},{label:"الإعلانات",value:counts.promotions},{label:"اشتراكات الشركات",value:counts.companySubscriptions},{label:"طلبات الموظفين",value:counts.employeeRequests}].map(item=><div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-bold text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-black text-slate-900">{item.value === null || item.value === undefined ? "—" : item.value}</p><p className="mt-1 text-xs text-slate-400">طلبات بانتظار المراجعة</p></div>)}</section><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"><Search size={18} className="text-slate-400"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ابحث عن نوع المراجعة أو الخدمة..." className="w-full bg-transparent text-sm outline-none" aria-label="البحث في أقسام المراجعة"/></div><section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><b>طريقة العمل:</b> تعرض هذه الصفحة أعداد الطلبات المتاحة حاليًا وتسهّل الوصول إلى شاشة المراجعة الأصلية لكل نوع، دون تغيير إجراءات الاعتماد أو الدفع.</section>
      {searchableGroups.map(group => <section key={group.title} className="space-y-3">
        <div><h2 className="text-lg font-black text-slate-900">{group.title}</h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{group.items.map(item => { const Icon=item.icon; return <a key={item.label} href={item.href} className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          <div className="mb-3 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={22}/></span><ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-blue-700"/></div>
          <div className="flex items-center justify-between gap-2"><h3 className="font-extrabold text-slate-900">{item.label}</h3>{countFor(item.label) !== null && countFor(item.label) !== undefined && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">{countFor(item.label)}</span>}</div><p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
        </a>})}</div>
      </section>)}
      {searchableGroups.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">لا توجد أقسام تطابق البحث.</div>}<footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">ملاحظة: لم يتم نقل أو حذف أي شاشة قديمة. الروابط تفتح إجراءات المراجعة المعتمدة حاليًا، للحفاظ على استقرار بيانات المنصة وسير العمل.</footer>
    </div>
  </main></>
}
