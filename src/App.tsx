import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CarFront, CheckCircle2, ShieldCheck, Users } from 'lucide-react'
import AuthPanel from './components/AuthPanel'
import RoleRegistrationPage, { RoleChooserPage } from './components/RoleRegistrationPage'
import WorkspacePage from './components/WorkspacePage'
import AdminReviewPage from './components/AdminReviewPage'
import PlatformSettingsPage from './components/PlatformSettingsPage'
import SubscriptionPlansPage from './components/SubscriptionPlansPage'
import VehicleCatalogPage from './components/VehicleCatalogPage'
import AdvertisingPlansAdminPage from './components/AdvertisingPlansAdminPage'
import MessagingPage from './components/MessagingPage'
import AuthCallbackPage from './components/AuthCallbackPage'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type PlatformSettings = {
  platform_name: string; tagline: string; description: string; logo_url: string | null; favicon_url: string | null;
  support_email: string | null; support_phone: string | null; website_url: string | null; address: string | null;
  footer_text: string; announcement_text: string | null; primary_color: string; secondary_color: string;
  registration_enabled: boolean; owner_registration_enabled: boolean; company_registration_enabled: boolean;
  supplier_registration_enabled: boolean; maintenance_mode: boolean
}
const defaults: PlatformSettings = {
  platform_name: 'Carhome', tagline: 'تأجير السيارات للشركات',
  description: 'منصة وسيطة تجمع ملاك السيارات وموردي الأساطيل مع الشركات التي تحتاج إلى تأجير شهري أو سنوي طويل الأجل، من خلال تجربة عربية منظمة.',
  logo_url: null, favicon_url: null, support_email: null, support_phone: null, website_url: null, address: null,
  footer_text: 'جميع الحقوق محفوظة.', announcement_text: null, primary_color: '#1d4ed8', secondary_color: '#0f172a',
  registration_enabled: true, owner_registration_enabled: true, company_registration_enabled: true,
  supplier_registration_enabled: true, maintenance_mode: false
}
const features = [
  { icon: CarFront, title: 'سيارات تناسب احتياجك', description: 'استعرض السيارات المتاحة للتأجير طويل الأجل.' },
  { icon: Building2, title: 'تواصل بين الشركات والموردين', description: 'مساحة منظمة لطلبات التأجير واستقبال العروض.' },
  { icon: ShieldCheck, title: 'خصوصية وأمان', description: 'صلاحيات وصول مبنية على الحساب وعضوية المؤسسة.' }
]

function ServiceNotice({ title, message, settings }: { title: string; message: string; settings: PlatformSettings }) {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-5">
    <section className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm">
      {settings.logo_url && <img src={settings.logo_url} alt={settings.platform_name} className="mx-auto mb-5 h-20 max-w-40 object-contain"/>}
      <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
      <p className="mt-3 leading-8 text-slate-600">{message}</p>
      {(settings.support_email || settings.support_phone) && <p className="mt-4 text-sm text-slate-500">{settings.support_email || ''}{settings.support_email && settings.support_phone ? ' · ' : ''}{settings.support_phone || ''}</p>}
      <a href="/" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">العودة للرئيسية</a>
    </section>
  </main>
}

export default function App() {
  const [authOpen, setAuthOpen] = useState(() => window.location.search.includes('login=1'))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [settings, setSettings] = useState<PlatformSettings>(defaults)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    let active = true
    async function loadSettings() {
      if (!supabase) { setSettingsLoaded(true); return }
      const { data, error } = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle()
      if (active && !error && data) setSettings({ ...defaults, ...data } as PlatformSettings)
      if (active) setSettingsLoaded(true)
    }
    void loadSettings()
    return () => { active = false }
  }, [])

  useEffect(() => {
    document.title = settings.platform_name || defaults.platform_name
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (descriptionMeta) descriptionMeta.content = settings.description || defaults.description
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeMeta) themeMeta.content = settings.primary_color || defaults.primary_color
    document.documentElement.style.setProperty('--platform-primary', settings.primary_color || defaults.primary_color)
    document.documentElement.style.setProperty('--platform-secondary', settings.secondary_color || defaults.secondary_color)
    if (settings.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = settings.favicon_url
    }
  }, [settings])

  function openAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const path = window.location.pathname
  if (path === '/auth/callback') return <AuthCallbackPage />
  if (path === '/workspace/admin/platform-settings') return <PlatformSettingsPage />
  if (path === '/workspace/admin/subscription-plans') return <SubscriptionPlansPage />
  if (path === '/workspace/admin/advertising-plans') return <AdvertisingPlansAdminPage />
  if (path === '/workspace/catalog') return <VehicleCatalogPage />
  if (path === '/workspace/admin' || path === '/workspace/admin/vehicle-reviews') return <AdminReviewPage />
  if (path.includes('/messages')) return <MessagingPage />
  if (path === '/workspace/company' || path.startsWith('/workspace/company/')) return <WorkspacePage role="company" />
  if (path.startsWith('/workspace/owner')) return <WorkspacePage role="owner" />
  if (path.startsWith('/workspace/supplier')) return <WorkspacePage role="supplier" />

  if (!settingsLoaded && (path === '/register' || path.startsWith('/register/'))) return <main dir="rtl" className="grid min-h-screen place-items-center">جارٍ تحميل إعدادات المنصة...</main>
  if (settings.maintenance_mode && (path === '/' || path === '/register' || path.startsWith('/register/'))) {
    return <ServiceNotice settings={settings} title="المنصة تحت الصيانة" message="نعمل على تحسين الخدمة. يرجى المحاولة مرة أخرى لاحقًا." />
  }
  if ((path === '/register' || path.startsWith('/register/')) && !settings.registration_enabled) {
    return <ServiceNotice settings={settings} title="التسجيل متوقف مؤقتًا" message="لا نستقبل حسابات جديدة في الوقت الحالي. يمكنك التواصل مع إدارة المنصة للاستفسار." />
  }
  if (path === '/register/owner' && !settings.owner_registration_enabled) return <ServiceNotice settings={settings} title="تسجيل ملاك السيارات متوقف" message="التسجيل لهذا النوع من الحسابات غير متاح حاليًا." />
  if (path === '/register/company' && !settings.company_registration_enabled) return <ServiceNotice settings={settings} title="تسجيل الشركات متوقف" message="التسجيل لهذا النوع من الحسابات غير متاح حاليًا." />
  if (path === '/register/supplier' && !settings.supplier_registration_enabled) return <ServiceNotice settings={settings} title="تسجيل موردي الأساطيل متوقف" message="التسجيل لهذا النوع من الحسابات غير متاح حاليًا." />
  if (path === '/register') return <RoleChooserPage onChoose={(role) => {
    const enabled = role === 'individual_owner' ? settings.owner_registration_enabled : role === 'fleet_supplier' ? settings.supplier_registration_enabled : settings.company_registration_enabled
    if (!enabled) { window.alert('التسجيل لهذا النوع من الحسابات غير متاح حاليًا.'); return }
    window.location.href = '/register/' + (role === 'individual_owner' ? 'owner' : role === 'fleet_supplier' ? 'supplier' : 'company')
  }} onLogin={() => { window.location.href = '/?login=1' }} />
  if (path === '/register/owner') return <RoleRegistrationPage role="individual_owner" onBack={() => { window.location.href = '/register' }} />
  if (path === '/register/company') return <RoleRegistrationPage role="company" onBack={() => { window.location.href = '/register' }} />
  if (path === '/register/supplier') return <RoleRegistrationPage role="fleet_supplier" onBack={() => { window.location.href = '/register' }} />

  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-slate-800" dir="rtl">
      {settings.announcement_text && <div className="px-5 py-2 text-center text-sm font-bold text-white" style={{ backgroundColor: settings.primary_color }}>{settings.announcement_text}</div>}
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href="/" className="flex shrink-0 items-center gap-3" aria-label={settings.platform_name + ' الرئيسية'}>
          {settings.logo_url ? <img src={settings.logo_url} alt={settings.platform_name} className="h-11 w-11 rounded-xl object-contain"/> : <span className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-soft" style={{ backgroundColor: settings.secondary_color }}><CarFront size={25} /></span>}
          <span>
            <span className="block text-xl font-extrabold tracking-tight text-navy">{settings.platform_name}</span>
            <span className="block text-xs font-semibold text-slate-500">{settings.tagline}</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          <button onClick={() => openAuth('signin')} className="min-h-10 rounded-xl px-3 text-sm font-bold text-navy hover:bg-white sm:px-4">دخول</button>
          {settings.registration_enabled && <button onClick={() => { window.location.href = '/register' }} className="min-h-10 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition sm:px-5" style={{ backgroundColor: settings.primary_color }}>إنشاء حساب</button>}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:pb-24 md:pt-16">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-bold shadow-sm" style={{ color: settings.primary_color }}>
            <span className="h-2 w-2 rounded-full bg-cargreen" /> حلقة وصل واحدة لاحتياجات تأجير الشركات
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.35] tracking-tight text-navy sm:text-5xl lg:text-6xl">
            خلّي الوصول للسيارات المناسبة <span style={{ color: settings.primary_color }}>أسهل وأوضح.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{settings.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {settings.registration_enabled && <button onClick={() => { window.location.href = '/register' }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white shadow-lg transition" style={{ backgroundColor: settings.primary_color }}>
              ابدأ بإنشاء حساب <ArrowLeft size={18} />
            </button>}
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-navy">
              <CheckCircle2 size={18} style={{ color: settings.primary_color }} /> اعرف طريقة العمل
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2"><Users size={17} /> ملاك وموردون وشركات</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> تسجيل آمن وصلاحيات واضحة</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl animate-fade-up">
          <div className="absolute -right-7 -top-7 h-40 w-40 rounded-full bg-blue-300/30 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-slate-900 p-2 shadow-2xl">
            <div className="relative min-h-[360px] overflow-hidden rounded-[1.6rem] sm:min-h-[440px]">
              <img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=90" alt="سيارة حديثة مناسبة للتنقلات والأعمال" className="absolute inset-0 h-full w-full object-cover motion-safe:animate-[catalogFloat_9s_ease-in-out_infinite]" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-slate-900/10" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-slate-950/75 p-5 text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-200"><ShieldCheck size={15}/> تجربة منظمة وآمنة</div>
                <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">من البحث عن السيارة إلى التواصل</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">كتالوج معتمد، عروض واضحة، ومحادثات داخل المنصة.</p>
                <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">سيارات معتمدة</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">بيانات المالك محمية</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">للشركات والأساطيل</span></div>
              </div>
            </div>
          </div>
          <div className="absolute -right-3 top-8 hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-xl sm:block motion-safe:animate-[catalogFloat_6s_ease-in-out_infinite]"><span className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><CarFront size={18} className="text-blue-700"/> كتالوج موحّد</span><p className="mt-1 text-xs text-slate-500">اختيارات واضحة في مكان واحد</p></div>
          <div className="absolute -left-3 bottom-24 hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-xl sm:block motion-safe:animate-[catalogFloat_7s_ease-in-out_infinite]"><span className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><CheckCircle2 size={18} className="text-emerald-600"/> مراجعة واعتماد</span><p className="mt-1 text-xs text-slate-500">عرض السيارات المستوفية للشروط</p></div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-100 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-extrabold" style={{ color: settings.primary_color }}>مصممة لاحتياجات السوق المصري</p><h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">تجربة أبسط لكل طرف</h2><p className="mt-4 leading-8 text-slate-600">ابدأ بحساب مناسب لدورك واستفد من مسار واضح للسيارات والطلبات والعروض والمراسلات.</p></div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-2xl border border-slate-100 bg-white p-6 transition hover:-translate-y-1 hover:shadow-soft"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50" style={{ color: settings.primary_color }}><Icon size={24} /></span><h3 className="mt-5 text-lg font-extrabold text-navy">{title}</h3><p className="mt-2 leading-7 text-slate-600">{description}</p></article>)}
          </div>
          {settings.registration_enabled && <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl p-6 text-white sm:flex-row sm:p-8" style={{ backgroundColor: settings.secondary_color }}><div><h3 className="text-xl font-extrabold">جاهز للبدء؟</h3><p className="mt-2 text-sm leading-6 text-blue-100">اختر نوع حسابك وسجّل بياناتك الأساسية.</p></div><button onClick={() => { window.location.href = '/register' }} className="min-h-12 rounded-xl bg-white px-6 font-extrabold transition hover:bg-blue-50" style={{ color: settings.secondary_color }}>إنشاء حساب جديد</button></div>}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div><span>© {new Date().getFullYear()} {settings.platform_name}. </span><span>{settings.footer_text}</span></div>
        <div className="flex flex-wrap gap-3">{settings.support_email && <a href={'mailto:'+settings.support_email}>{settings.support_email}</a>}{settings.support_phone && <a href={'tel:'+settings.support_phone}>{settings.support_phone}</a>}{settings.website_url && <a href={settings.website_url} target="_blank" rel="noreferrer">الموقع الرسمي</a>}{settings.address && <span>{settings.address}</span>}</div>
        <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-cargreen' : 'bg-amber-500'}`} />{isSupabaseConfigured ? 'إعدادات الاتصال موجودة' : 'إعدادات الاتصال تحتاج إلى ضبط'}</span>
      </footer>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} initialMode={authMode} />}
    </main>
  )
}
