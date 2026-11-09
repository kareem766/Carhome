import { ClipboardCheck, CarFront, Wallet, Users, Megaphone, CreditCard, BriefcaseBusiness, UserCheck, Wrench, Headset, ArrowUpRight, LayoutDashboard } from 'lucide-react'
import AdminPageNavigation from './AdminPageNavigation'

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
    { label: 'مقدمو الخدمات', detail: 'إدارة طلبات مقدمي خدمات السيارات.', href: '/services', icon: Wrench },
    { label: 'الدعم والتذاكر', detail: 'متابعة استفسارات ومشكلات المستخدمين.', href: '/workspace/admin/support', icon: Headset },
  ]},
]
export default function AdminReviewCenterPage() {
  return <><AdminPageNavigation/><main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-7 lg:px-9">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#17466b] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100"><ClipboardCheck size={15}/> مركز المراجعات</div>
          <h1 className="text-2xl font-black sm:text-3xl">كل المراجعات والطلبات في مكان واحد</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">اختر نوع الطلب للوصول مباشرةً إلى شاشة المراجعة الحالية. تم الإبقاء على مسارات الاعتماد والصلاحيات الحالية دون تغيير.</p></div>
          <a href="/workspace/admin" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"><LayoutDashboard size={17}/> لوحة التحكم</a>
        </div>
      </header>
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><b>طريقة العمل:</b> هذه بوابة موحدة للوصول إلى المراجعات الحالية. في المرحلة التالية نضيف قائمة انتظار موحدة وعدادات مباشرة ونافذة مراجعة سريعة، بعد ربط كل نوع طلب بإجراء الاعتماد الأصلي الخاص به.</section>
      {groups.map(group => <section key={group.title} className="space-y-3">
        <div><h2 className="text-lg font-black text-slate-900">{group.title}</h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{group.items.map(item => { const Icon=item.icon; return <a key={item.label} href={item.href} className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          <div className="mb-3 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={22}/></span><ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-blue-700"/></div>
          <h3 className="font-extrabold text-slate-900">{item.label}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
        </a>})}</div>
      </section>)}
      <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">ملاحظة: لم يتم نقل أو حذف أي شاشة قديمة. الروابط تفتح إجراءات المراجعة المعتمدة حاليًا، للحفاظ على استقرار بيانات المنصة وسير العمل.</footer>
    </div>
  </main></>
}
