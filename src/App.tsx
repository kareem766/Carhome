import { useState } from 'react'
import { ArrowLeft, Building2, CarFront, CheckCircle2, ShieldCheck, Users } from 'lucide-react'
import AuthPanel from './components/AuthPanel'
import RoleRegistrationPage, { RoleChooserPage } from './components/RoleRegistrationPage'
import WorkspacePage from './components/WorkspacePage'
import AdminReviewPage from './components/AdminReviewPage'
import { isSupabaseConfigured } from './lib/supabase'

const features = [
  { icon: CarFront, title: 'سيارات تناسب احتياجك', description: 'تجهيز مسار لاستعراض السيارات المتاحة والتأجير طويل الأجل.' },
  { icon: Building2, title: 'تواصل بين الشركات والموردين', description: 'مساحة منظمة لطلبات التأجير واستقبال العروض.' },
  { icon: ShieldCheck, title: 'خصوصية وأمان', description: 'صلاحيات وصول مبنية على الحساب وعضوية المؤسسة.' }
]

export default function App() {
  const [authOpen, setAuthOpen] = useState(() => window.location.search.includes('login=1'))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  function openAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const path = window.location.pathname
  if (path === '/register') return <RoleChooserPage onChoose={(role) => { window.location.href = '/register/' + (role === 'individual_owner' ? 'owner' : role === 'fleet_supplier' ? 'supplier' : 'company') }} onLogin={() => { window.location.href = '/?login=1' }} />
  if (path === '/register/owner') return <RoleRegistrationPage role="individual_owner" onBack={() => { window.location.href = '/register' }} />
  if (path === '/register/company') return <RoleRegistrationPage role="company" onBack={() => { window.location.href = '/register' }} />
  if (path === '/register/supplier') return <RoleRegistrationPage role="fleet_supplier" onBack={() => { window.location.href = '/register' }} />
  if (path === '/workspace/admin/vehicle-reviews') return <AdminReviewPage />
  if (path === '/workspace/company' || path.startsWith('/workspace/company/')) return <WorkspacePage role="company" />
  if (path.startsWith('/workspace/owner')) return <WorkspacePage role="owner" />
  if (path.startsWith('/workspace/supplier')) return <WorkspacePage role="supplier" />

  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-slate-800" dir="rtl">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href="/" className="flex shrink-0 items-center gap-3" aria-label="Carhome الرئيسية">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-navy text-white shadow-soft"><CarFront size={25} /></span>
          <span>
            <span className="block text-xl font-extrabold tracking-tight text-navy">Carhome</span>
            <span className="block text-xs font-semibold text-slate-500">تأجير السيارات للشركات</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          <button onClick={() => openAuth('signin')} className="min-h-10 rounded-xl px-3 text-sm font-bold text-navy hover:bg-white sm:px-4">دخول</button>
          <button onClick={() => { window.location.href = '/register' }} className="min-h-10 rounded-xl bg-carblue px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:px-5">إنشاء حساب</button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:pb-24 md:pt-16">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-carblue shadow-sm">
            <span className="h-2 w-2 rounded-full bg-cargreen" /> حلقة وصل واحدة لاحتياجات تأجير الشركات
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.35] tracking-tight text-navy sm:text-5xl lg:text-6xl">
            خلّي الوصول للسيارات المناسبة <span className="text-carblue">أسهل وأوضح.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
            Carhome منصة وسيطة تجمع ملاك السيارات وموردي الأساطيل مع الشركات التي تحتاج إلى تأجير شهري أو سنوي طويل الأجل، من خلال تجربة عربية منظمة.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openAuth('signup')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-carblue px-6 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">
              ابدأ بإنشاء حساب <ArrowLeft size={18} />
            </button>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-navy">
              <CheckCircle2 size={18} className="text-cargreen" /> اعرف طريقة العمل
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2"><Users size={17} /> ملاك وموردون وشركات</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> تسجيل آمن وصلاحيات واضحة</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-emerald-100 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white bg-white p-5 shadow-soft sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div><p className="text-sm font-semibold text-slate-500">مساحة عمل واحدة</p><h2 className="mt-1 text-xl font-extrabold text-navy">من الطلب إلى العرض</h2></div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-carblue"><CarFront size={26} /></span>
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-carblue"><Building2 size={22} /></span><div className="flex-1"><p className="font-bold text-navy">الشركة الطالبة</p><p className="mt-1 text-sm text-slate-500">تحدد نوع السيارة والمدة والمنطقة المطلوبة</p></div><span className="text-xs font-bold text-carblue">١</span></div></div>
              <div className="me-8 h-5 border-r-2 border-dashed border-blue-200" />
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-cargreen"><CarFront size={22} /></span><div className="flex-1"><p className="font-bold text-navy">المالك أو مورد الأسطول</p><p className="mt-1 text-sm text-slate-500">يراجع الطلب ويقدم عرضه من خلال المنصة</p></div><span className="text-xs font-bold text-cargreen">٢</span></div></div>
              <div className="me-8 h-5 border-r-2 border-dashed border-blue-200" />
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-carblue"><CheckCircle2 size={22} /></span><div className="flex-1"><p className="font-bold text-navy">تواصل منظم</p><p className="mt-1 text-sm text-slate-500">يتفق الطرفان مباشرة خارج أي تحصيل مالي عبر المنصة</p></div><span className="text-xs font-bold text-carblue">٣</span></div></div>
            </div>
            <p className="mt-5 text-center text-xs leading-6 text-slate-400">تصور مبدئي لطريقة العمل — لا توجد طلبات أو عروض حقيقية معروضة في هذه المرحلة.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-100 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-extrabold text-carblue">مصممة لاحتياجات السوق المصري</p><h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">تجربة أبسط لكل طرف</h2><p className="mt-4 leading-8 text-slate-600">ابدأ بحساب مناسب لدورك. سنضيف وظائف السيارات والطلبات والعروض والمراسلات في مراحل منفصلة.</p></div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-2xl border border-slate-100 bg-white p-6 transition hover:-translate-y-1 hover:shadow-soft"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-carblue"><Icon size={24} /></span><h3 className="mt-5 text-lg font-extrabold text-navy">{title}</h3><p className="mt-2 leading-7 text-slate-600">{description}</p></article>)}
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:p-8"><div><h3 className="text-xl font-extrabold">جاهز للبدء؟</h3><p className="mt-2 text-sm leading-6 text-blue-100">اختر نوع حسابك وسجّل بياناتك الأساسية.</p></div><button onClick={() => openAuth('signup')} className="min-h-12 rounded-xl bg-white px-6 font-extrabold text-navy transition hover:bg-blue-50">إنشاء حساب جديد</button></div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>© {new Date().getFullYear()} Carhome</span>
        <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-cargreen' : 'bg-amber-500'}`} />{isSupabaseConfigured ? 'إعدادات الاتصال موجودة' : 'إعدادات الاتصال تحتاج إلى ضبط'}</span>
      </footer>

      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} initialMode={authMode} />}
    </main>
  )
}
