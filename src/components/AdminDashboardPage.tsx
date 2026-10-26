import { useEffect, useState } from 'react'
import { Activity, ArrowLeft, BadgeCheck, Banknote, Building2, CarFront, ClipboardCheck, FileText, Megaphone, RefreshCw, Settings, ShieldCheck, Users, WalletCards } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

type Metric = { label: string; value: number | string; hint: string; icon: typeof CarFront; tone: string }
const money = (value: number) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value)
const sections = [
  { title: 'المراجعة والاعتمادات', description: 'مراجعة السيارات والتحويلات والحسابات والطلبات والعروض.', href: '/workspace/admin', icon: ClipboardCheck, tag: 'مركز العمليات' },
  { title: 'هوية وإعدادات المنصة', description: 'الاسم والشعار والألوان وبيانات التواصل والإعلانات العامة وحالة التسجيل والصيانة.', href: '/workspace/admin/platform-settings', icon: Settings, tag: 'إعدادات عامة' },
  { title: 'باقات اشتراك الشركات', description: 'إدارة خطط الاشتراك والأسعار والمزايا وحدود الاستخدام.', href: '/workspace/admin/subscription-plans', icon: WalletCards, tag: 'الاشتراكات' },
  { title: 'باقات إعلانات السيارات', description: 'إضافة وتعديل الأسعار والمدة والمزايا وترتيب الباقات المنشورة.', href: '/workspace/admin/advertising-plans', icon: Megaphone, tag: 'الإعلانات' },
  { title: 'كتالوج السيارات', description: 'معاينة السيارات المنشورة والمتاحة للشركات.', href: '/workspace/catalog', icon: CarFront, tag: 'عرض عام' },
  { title: 'طلبات التأجير', description: 'متابعة طلبات الشركات والعروض الواردة من الملاك والموردين.', href: '/workspace/admin', icon: FileText, tag: 'سير العمل' },
]
export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [lastUpdated, setLastUpdated] = useState('')
  async function load() {
    if (!supabase) { setError('إعدادات الاتصال بقاعدة البيانات غير مكتملة.'); setLoading(false); return }
    setLoading(true); setError('')
    const db = supabase
    const { data: auth, error: authError } = await db.auth.getUser()
    if (authError || !auth.user) { window.location.replace('/?login=1'); return }
    const { data: admin, error: adminError } = await db.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
    if (adminError || !admin) { setAuthorized(false); setError(adminError?.message || 'هذه اللوحة مخصصة لصاحب المنصة فقط.'); setLoading(false); return }
    setAuthorized(true)
    const count = async (table: string, filters: [string, string][] = []) => {
      let query = db.from(table).select('id', { count: 'exact', head: true })
      for (const [column, value] of filters) query = query.eq(column, value)
      const result = await query
      if (result.error) throw result.error
      return result.count || 0
    }
    try {
      const [companies, owners, suppliers, vehicles, approvedVehicles, pendingVehicles, rejectedVehicles, pendingPayments, verifiedPayments, pendingRequests, pendingOffers, pendingPromotions, paymentRows] = await Promise.all([
        count('organizations', [['organization_type','company']]),
        count('organizations', [['organization_type','individual_owner']]),
        count('organizations', [['organization_type','fleet_supplier']]),
        count('vehicles'),
        count('vehicles', [['review_status','approved']]),
        count('vehicles', [['review_status','pending_review']]),
        count('vehicles', [['review_status','rejected']]),
        count('vehicle_payment_submissions', [['review_status','pending']]),
        
        count('vehicle_payment_submissions', [['review_status','approved']]),
        count('rental_requests', [['status','open']]),
        count('rental_offers', [['status','submitted']]),
        count('vehicle_promotions', [['status','pending_review']]),
        db.from('vehicle_payment_submissions').select('amount_egp,review_status')
      ])
      if (paymentRows.error) throw paymentRows.error
      const paymentData = paymentRows.data || []
      const pendingAmount = paymentData.filter(p => p.review_status === 'pending').reduce((sum,p) => sum + Number(p.amount_egp || 0), 0)
      const verifiedAmount = paymentData.filter(p => p.review_status === 'approved').reduce((sum,p) => sum + Number(p.amount_egp || 0), 0)
      setMetrics([
        { label:'الشركات المسجلة', value:companies, hint:'إجمالي حسابات الشركات؛ لا يوجد حاليًا حقل مستقل لاعتماد الحساب.', icon:Building2, tone:'blue' },
        { label:'ملاك السيارات', value:owners, hint:'إجمالي حسابات الملاك المسجلة.', icon:Users, tone:'violet' },
        { label:'موردو الأساطيل', value:suppliers, hint:'إجمالي حسابات موردي الأساطيل المسجلة.', icon:Building2, tone:'cyan' },
        { label:'إجمالي السيارات', value:vehicles, hint:`${approvedVehicles} معتمدة · ${pendingVehicles} تنتظر المراجعة · ${rejectedVehicles} مرفوضة`, icon:CarFront, tone:'blue' },
        { label:'تحويلات تنتظر المراجعة', value:pendingPayments, hint:`${money(pendingAmount)} إجمالي المبالغ المعلّقة حسب سجلات التحويل`, icon:Banknote, tone:'amber' },
        { label:'مبالغ مؤكدة', value:money(verifiedAmount), hint:`${verifiedPayments} تحويلات مؤكدة`, icon:BadgeCheck, tone:'emerald' },
        { label:'طلبات تأجير مفتوحة', value:pendingRequests, hint:'طلبات تنتظر العروض أو المتابعة.', icon:FileText, tone:'indigo' },
        { label:'عروض تنتظر المراجعة', value:pendingOffers, hint:'عروض حالتها قيد الإرسال.', icon:ClipboardCheck, tone:'amber' },
        { label:'طلبات ترويج معلّقة', value:pendingPromotions, hint:'طلبات باقات إعلانية تنتظر قرار الإدارة.', icon:Megaphone, tone:'rose' },
      ])
      setLastUpdated(new Date().toLocaleString('ar-EG'))
    } catch (caught) {
      setError(caught instanceof Error ? 'تعذر تحميل بعض مؤشرات لوحة التحكم: ' + caught.message : 'تعذر تحميل مؤشرات لوحة التحكم.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const toneClasses: Record<string,string> = { blue:'bg-blue-50 text-blue-700', violet:'bg-violet-50 text-violet-700', cyan:'bg-cyan-50 text-cyan-700', amber:'bg-amber-50 text-amber-700', emerald:'bg-emerald-50 text-emerald-700', indigo:'bg-indigo-50 text-indigo-700', rose:'bg-rose-50 text-rose-700' }
  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><PlatformBrand/><div className="flex flex-wrap items-center gap-2"><button onClick={()=>void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/> تحديث البيانات</button><a href="/workspace/catalog" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white"><ArrowLeft size={16}/> عرض المنصة</a></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-xl sm:p-9"><div className="absolute -left-8 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5"/><div className="relative flex flex-wrap items-end justify-between gap-5"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold"><ShieldCheck size={15}/> مساحة خاصة بصاحب المنصة</span><h1 className="mt-4 text-3xl font-black sm:text-4xl">مركز التحكم والإدارة</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">متابعة أداء My Car، ومراجعة التسجيلات والتحويلات، وإدارة الإعدادات والباقات من مكان واحد.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm"><p className="text-blue-100">آخر تحديث للمؤشرات</p><p className="mt-1 font-bold">{lastUpdated || 'لم يتم التحديث بعد'}</p></div></div></section>
      {!authorized && !loading && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error || 'هذه الصفحة مخصصة لصاحب المنصة فقط.'}</div>}
      {authorized && error && <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">{error}</div>}
      {authorized && <><div className="mt-7 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">مؤشرات التشغيل</h2><p className="mt-1 text-sm text-slate-500">الأرقام مستمدة من سجلات قاعدة البيانات المتاحة لحساب الإدارة.</p></div>{loading&&<span className="text-sm text-slate-500">جارٍ تحديث الأرقام...</span>}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(item=><article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{item.value}</p></div><span className={`grid h-11 w-11 place-items-center rounded-xl ${toneClasses[item.tone]||toneClasses.blue}`}><item.icon size={21}/></span></div><p className="mt-3 text-xs leading-6 text-slate-500">{item.hint}</p></article>)}</div>
        <div className="mt-10"><h2 className="text-xl font-black">إدارة صفحات المنصة</h2><p className="mt-1 text-sm text-slate-500">كل قسم يفتح صفحة مخصصة لوظائفه المتاحة حاليًا.</p></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(item=><a key={item.title} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><item.icon size={23}/></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{item.tag}</span></div><h3 className="mt-4 text-lg font-black">{item.title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700">فتح القسم <ArrowLeft size={16} className="transition group-hover:-translate-x-1"/></span></a>)}</div>
        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="flex items-start gap-3"><Activity className="mt-1 shrink-0 text-blue-700"/><div><h3 className="font-extrabold text-blue-950">ملاحظات دقة البيانات</h3><p className="mt-2 text-sm leading-7 text-blue-900">قاعدة البيانات الحالية لا تحتوي على حقل مستقل يحدد اعتماد الشركة أو المورد؛ لذلك لا يتم تقسيمهما إلى معتمد وغير معتمد بشكل تخميني. المبالغ المؤكدة محسوبة من التحويلات التي تحمل حالة «approved» فقط. يمكن استكمال حالات اعتماد الحسابات لاحقًا مع سياسات صلاحيات آمنة.</p></div></div></div>
      </>}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500"><span>My Car · لوحة إدارة خاصة</span><span>صلاحيات الإدارة تُراجع من قاعدة البيانات قبل عرض المؤشرات.</span></footer>
    </div>
  </main>
}