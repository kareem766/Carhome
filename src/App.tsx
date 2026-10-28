import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { ArrowLeft, Building2, CarFront, CheckCircle2, ShieldCheck, Users } from 'lucide-react'
import AuthPanel from './components/AuthPanel'
import RoleRegistrationPage, { RoleChooserPage } from './components/RoleRegistrationPage'
import LegalPages from './components/LegalPages'
const WorkspacePage = lazy(() => import('./components/WorkspacePage'))
const AdminReviewPage = lazy(() => import('./components/AdminReviewPage'))
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'))
const AdminManagementPage = lazy(() => import('./components/AdminManagementPage'))
const ManagedSourcingPage = lazy(() => import('./components/ManagedSourcingPage'))
const PlatformSettingsPage = lazy(() => import('./components/PlatformSettingsPage'))
const SubscriptionPlansPage = lazy(() => import('./components/SubscriptionPlansPage'))
const CompanySubscriptionsPage = lazy(() => import('./components/CompanySubscriptionsPage'))
const CompanySubscriptionPurchasePage = lazy(() => import('./components/CompanySubscriptionPurchasePage'))
const VehicleCatalogPage = lazy(() => import('./components/VehicleCatalogPage'))
const AutomotiveServicesPage = lazy(() => import('./components/AutomotiveServicesPage'))
const AdvertisingPlansAdminPage = lazy(() => import('./components/AdvertisingPlansAdminPage'))
const PlatformBannersAdminPage = lazy(() => import('./components/PlatformBannersAdminPage'))
const AccountNotificationsAdminPage = lazy(() => import('./components/AccountNotificationsAdminPage'))
const AdvertisingPlansPage = lazy(() => import('./components/AdvertisingPlansPage'))
const MessagingPage = lazy(() => import('./components/MessagingPage'))
const AuthCallbackPage = lazy(() => import('./components/AuthCallbackPage'))
import { isSupabaseConfigured, supabase } from './lib/supabase'
import PartnerLogoTicker from './components/PartnerLogoTicker'
import PlatformEntryBanner from './components/PlatformEntryBanner'
import GlobalAppNavigation from './components/GlobalAppNavigation'
import PlatformLoadingScreen from './components/PlatformLoadingScreen'

// Release trigger: rebuild the current My Car production branch on Vercel.
// Production retry commit: 2026-10-25; verify partner ticker and platform branding after build.

type PlatformSettings = {
  platform_name: string; tagline: string; description: string; logo_url: string | null; favicon_url: string | null;
  support_email: string | null; support_phone: string | null; website_url: string | null; address: string | null;
  footer_text: string; announcement_text: string | null; primary_color: string; secondary_color: string;
  registration_enabled: boolean; owner_registration_enabled: boolean; company_registration_enabled: boolean;
  supplier_registration_enabled: boolean; maintenance_mode: boolean
}
const defaults: PlatformSettings = {
  platform_name: 'My Car', tagline: 'منصة السيارات للشركات والأساطيل في مصر',
  description: 'منصة وسيطة تجمع ملاك السيارات وموردي الأساطيل مع الشركات التي تحتاج إلى تأجير شهري أو سنوي طويل الأجل، من خلال تجربة عربية منظمة.',
  logo_url: null, favicon_url: null, support_email: null, support_phone: null, website_url: null, address: null,
  footer_text: 'جميع الحقوق محفوظة.', announcement_text: null, primary_color: '#1d4ed8', secondary_color: '#0f172a',
  registration_enabled: true, owner_registration_enabled: true, company_registration_enabled: true,
  supplier_registration_enabled: true, maintenance_mode: false
}
const features = [
  { icon: CarFront, title: 'سيارات تناسب احتياجك', description: 'استعرض السيارات المتاحة للتأجير طويل الأجل.' },
  { icon: Building2, title: 'تواصل بين الشركات والموردين', description: 'إدارة أكثر وضوحًا لطلبات التأجير واستقبال عروض الموردين.' },
  { icon: ShieldCheck, title: 'خصوصية وأمان', description: 'صلاحيات وصول مبنية على الحساب وعضوية المؤسسة.' }
]

function RouteLoading() {
  return <PlatformLoadingScreen fullscreen />
}

function ServiceNotice({ title, message, settings }: { title: string; message: string; settings: PlatformSettings }) {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-5">
    <section className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm">
      <img src={settings.logo_url || "/mycar-logo.svg"} alt={settings.platform_name} className="mx-auto mb-5 h-20 max-w-40 object-contain"/>
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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authStateReady, setAuthStateReady] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthStateReady(true); return }
    let active = true
    const syncSession = (session: { user: { id: string } } | null) => {
      if (!active) return
      setIsAuthenticated(Boolean(session))
      setAuthStateReady(true)
      if (session) setAuthOpen(false)
    }
    void supabase.auth.getSession().then(({ data }) => syncSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session))
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    async function loadSettings() {
      if (!supabase) { setSettingsLoaded(true); return }
      const { data, error } = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle()
      if (active && !error && data) {
        const loadedSettings = { ...defaults, ...data, platform_name: data.platform_name === 'Carhome' ? 'My Car' : (data.platform_name || defaults.platform_name), tagline: data.tagline === 'تأجير السيارات للشركات' ? defaults.tagline : (data.tagline || defaults.tagline) } as PlatformSettings
        // Apply saved brand tokens synchronously before React is allowed to paint the page.
        // Updating them only in useEffect creates a visible frame with the fallback colors.
        document.documentElement.style.setProperty('--platform-primary', loadedSettings.primary_color || defaults.primary_color)
        document.documentElement.style.setProperty('--platform-secondary', loadedSettings.secondary_color || defaults.secondary_color)
        const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        if (themeMeta) themeMeta.content = loadedSettings.primary_color || defaults.primary_color
        document.title = loadedSettings.platform_name || defaults.platform_name
        setSettings(loadedSettings)
      }
      if (active) setSettingsLoaded(true)
    }
    void loadSettings()
    window.addEventListener('platform-settings-updated', loadSettings)
    return () => { active = false; window.removeEventListener('platform-settings-updated', loadSettings) }
  }, [])

  // Apply persisted branding before the browser paints, preventing a fallback-color flash.
  useLayoutEffect(() => {
    document.title = settings.platform_name || defaults.platform_name
    document.documentElement.dataset.platformLogo = settings.logo_url || '/mycar-logo.svg'
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (descriptionMeta) descriptionMeta.content = settings.description || defaults.description
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeMeta) themeMeta.content = settings.primary_color || defaults.primary_color
    document.documentElement.style.setProperty('--platform-primary', settings.primary_color || defaults.primary_color)
    document.documentElement.style.setProperty('--platform-secondary', settings.secondary_color || defaults.secondary_color)
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    const brandIcon = settings.favicon_url || settings.logo_url || '/mycar-logo.svg'
    if (brandIcon) {
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = brandIcon
    } else if (link && !link.href.endsWith('/mycar-logo.svg')) {
      link.href = '/mycar-logo.svg'
    }
  }, [settings])

  function openAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const path = window.location.pathname
  // Wait for saved platform identity to load before painting any route.
  // This prevents a default-theme flash before persisted brand colors are applied.
  if (!settingsLoaded) return <RouteLoading />
  if (settings.maintenance_mode && !path.startsWith('/workspace/admin') && path !== '/auth/callback') return <ServiceNotice settings={settings} title="المنصة تحت الصيانة" message="نعمل على تحسين الخدمة. يرجى المحاولة مرة أخرى لاحقًا." />
  if (path === '/privacy') return <LegalPages kind="privacy" />
  if (path === '/terms') return <LegalPages kind="terms" />
  if (path === '/auth/callback') return <Suspense fallback={<RouteLoading />}><AuthCallbackPage /></Suspense>
  if (path === '/workspace/admin/dashboard') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AdminDashboardPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/managed-sourcing') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><ManagedSourcingPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/company/managed-sourcing') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><ManagedSourcingPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/management') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AdminManagementPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/platform-settings') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><PlatformSettingsPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/subscription-plans') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><SubscriptionPlansPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/subscriptions') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><CompanySubscriptionsPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/company/subscription') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><CompanySubscriptionPurchasePage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/advertising-plans') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AdvertisingPlansAdminPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/banners') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><PlatformBannersAdminPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin/notifications') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AccountNotificationsAdminPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/catalog') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><VehicleCatalogPage /></Suspense></GlobalAppNavigation>
  if (path === '/services' || path === '/automotive-services') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AutomotiveServicesPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/advertising-plans') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AdvertisingPlansPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/admin' || path === '/workspace/admin/vehicle-reviews') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><AdminReviewPage /></Suspense></GlobalAppNavigation>
  if (path.includes('/messages')) return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><MessagingPage /></Suspense></GlobalAppNavigation>
  if (path === '/workspace/company' || path.startsWith('/workspace/company/')) return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><WorkspacePage role="company" /></Suspense></GlobalAppNavigation>
  if (path.startsWith('/workspace/owner')) return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><WorkspacePage role="owner" /></Suspense></GlobalAppNavigation>
  if (path.startsWith('/workspace/supplier')) return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><Suspense fallback={<RouteLoading />}><WorkspacePage role="supplier" /></Suspense></GlobalAppNavigation>

  if (!settingsLoaded && (path === '/register' || path.startsWith('/register/'))) return <RouteLoading />
  if ((path === '/register' || path.startsWith('/register/')) && !settings.registration_enabled) {
    return <ServiceNotice settings={settings} title="التسجيل متوقف مؤقتًا" message="لا نستقبل حسابات جديدة في الوقت الحالي. يمكنك التواصل مع إدارة المنصة للاستفسار." />
  }
  if (path === '/register/owner' && !settings.owner_registration_enabled) return <ServiceNotice settings={settings} title="تسجيل ملاك السيارات متوقف" message="التسجيل لهذا النوع من الحسابات غير متاح حاليًا." />
  if (path === '/register/company' && !settings.company_registration_enabled) return <ServiceNotice settings={settings} title="تسجيل الشركات متوقف" message="التسجيل لهذا النوع من الحسابات غير متاح حاليًا." />
  if (path === '/register/supplier' && !settings.supplier_registration_enabled) return <ServiceNotice settings={settings} title="تسجيل موردي الأساطيل متوقف" message="التسجيل لهذا النوع من الحسابات غير متاح حاليًا." />
  if (path === '/register') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><RoleChooserPage onChoose={(role) => {
    const enabled = role === 'individual_owner' ? settings.owner_registration_enabled : role === 'fleet_supplier' ? settings.supplier_registration_enabled : settings.company_registration_enabled
    if (!enabled) { window.alert('التسجيل لهذا النوع من الحسابات غير متاح حاليًا.'); return }
    window.location.href = '/register/' + (role === 'individual_owner' ? 'owner' : role === 'fleet_supplier' ? 'supplier' : 'company')
  }} onLogin={() => { window.location.href = '/?login=1' }} /></GlobalAppNavigation>
  if (path === '/register/owner') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><RoleRegistrationPage role="individual_owner" onBack={() => { window.location.href = '/register' }} /></GlobalAppNavigation>
  if (path === '/register/company') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><RoleRegistrationPage role="company" onBack={() => { window.location.href = '/register' }} /></GlobalAppNavigation>
  if (path === '/register/supplier') return <GlobalAppNavigation platformName={settings.platform_name} logoUrl={settings.logo_url}><RoleRegistrationPage role="fleet_supplier" onBack={() => { window.location.href = '/register' }} /></GlobalAppNavigation>

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#07172c] text-slate-800" dir="rtl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[760px] bg-[linear-gradient(180deg,rgba(4,16,33,.38)_0%,rgba(5,20,40,.62)_45%,#07172c_96%),url(https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2200&q=90)] bg-cover bg-[position:center_top]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-[520px] z-0 h-96 w-96 rounded-full bg-amber-400/10 blur-[100px]" />
      <div className="relative z-20"><PlatformEntryBanner /></div>
      {settings.announcement_text && <div className="px-5 py-2 text-center text-sm font-bold text-white" style={{ backgroundColor: settings.primary_color }}>{settings.announcement_text}</div>}
      <header className="relative sticky top-0 z-30 mx-auto flex w-full max-w-[90rem] flex-col items-stretch gap-3 border-b border-white/10 bg-[#07172c]/80 px-3 py-3 text-white shadow-[0_12px_35px_-30px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-4">
        <a href="/" className="flex w-full min-w-0 items-center gap-3 rounded-2xl py-1 sm:w-auto sm:shrink sm:gap-4" aria-label={settings.platform_name + ' الرئيسية'}>
          <img src={settings.logo_url || "/mycar-logo.svg"} alt={settings.platform_name} className="h-14 w-14 shrink-0 rounded-2xl object-contain sm:h-16 sm:w-16"/>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">{settings.platform_name}</span>
            <span className="mt-1 block truncate text-xs font-bold text-slate-300 sm:text-sm">{settings.tagline}</span>
          </span>
        </a>
        <div className="grid w-full grid-cols-2 items-stretch gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-2">
          <a href="/services" className="hidden min-h-10 items-center rounded-xl px-3 text-sm font-bold text-blue-700 hover:bg-white sm:inline-flex">خدمات السيارات</a>
{(!authStateReady || !isAuthenticated) && <>
          <button onClick={() => openAuth('signin')} className="inline-flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-xl border border-white/30 bg-white px-3 text-sm font-extrabold leading-none text-[#07172c] transition hover:bg-slate-100 sm:min-h-11 sm:w-auto sm:min-w-[132px] sm:px-4">تسجيل الدخول</button>
          {settings.registration_enabled && <button onClick={() => { window.location.href = '/register' }} className="inline-flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-extrabold leading-none text-[#07172c] ring-2 ring-amber-200 shadow-[0_8px_24px_-8px_rgba(245,158,11,.65)] transition hover:brightness-105 sm:min-h-11 sm:w-auto sm:min-w-[132px] sm:px-4" style={{ backgroundColor: settings.primary_color }}>إنشاء الحساب</button>}
          </>}
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-7 px-4 pb-12 pt-8 sm:gap-12 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:pb-24 md:pt-14">
        <div className="relative z-10 order-2 md:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-slate-950/70 px-3.5 py-2 text-xs font-extrabold text-amber-300 shadow-lg backdrop-blur-md sm:px-4 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-cargreen" /> حلول تأجير طويلة الأجل للشركات والأساطيل
          </span>
          <h1 className="mt-5 max-w-2xl text-[2.15rem] font-black leading-[1.28] tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)] sm:mt-6 sm:text-5xl lg:text-6xl">
            بنسهّل عليك الوصول للعربيات اللي تناسب شغلك.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-slate-200 sm:mt-6 sm:text-lg">{settings.description}</p>
          <div className="relative z-20 mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            {(!authStateReady || !isAuthenticated) && settings.registration_enabled && <button onClick={() => { window.location.href = '/register' }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 font-extrabold text-[#07172c] ring-2 ring-amber-200 shadow-[0_10px_30px_-10px_rgba(245,158,11,.65)] transition hover:brightness-105" style={{ backgroundColor: settings.primary_color }}>
              ابدأ بإنشاء حساب <ArrowLeft size={18} />
            </button>}
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-white/70 bg-[#07172c]/80 px-6 py-3 font-extrabold text-white shadow-lg backdrop-blur-md hover:bg-[#102b4b]">
              <CheckCircle2 size={18} style={{ color: settings.primary_color }} /> اعرف طريقة العمل
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold text-slate-200 sm:mt-8">
            <span className="inline-flex items-center gap-2"><Users size={17} /> ملاك وموردون وشركات</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> خصوصية في التواصل وصلاحيات واضحة</span>
          </div>
        </div>

        <div className="relative mx-auto order-1 w-full max-w-xl animate-fade-up md:order-2">
          <div className="absolute -right-7 -top-7 h-40 w-40 rounded-full bg-blue-300/30 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.6rem] border border-white/80 bg-slate-900 p-1.5 shadow-[0_28px_75px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-900/5 sm:rounded-[2rem] sm:p-2">
            <div className="relative min-h-[280px] overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-blue-950 via-slate-800 to-slate-950 sm:min-h-[440px] sm:rounded-[1.6rem]">
              <div aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_70%_35%,rgba(59,130,246,.32),transparent_45%),linear-gradient(135deg,#0f172a,#172554_55%,#020617)]"><CarFront size={190} strokeWidth={0.65} className="text-white/15 sm:h-60 sm:w-60" /><span className="absolute bottom-28 right-7 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100 backdrop-blur">كتالوج السيارات المعتمدة</span></div>
              <img onError={event => { event.currentTarget.style.display = "none" }} src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=90" alt="سيارة حديثة مناسبة للتنقلات والأعمال" className="absolute inset-0 h-full w-full object-cover motion-safe:animate-[catalogFloat_9s_ease-in-out_infinite]" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-slate-900/10" />
              <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/20 bg-slate-950/80 p-4 text-white shadow-2xl backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-200"><ShieldCheck size={15}/> تجربة منظمة وآمنة</div>
                <h2 className="mt-2 text-lg font-extrabold sm:text-2xl">من الاحتياج إلى العرض المناسب</h2>
                <p className="mt-2 text-xs leading-6 text-slate-200 sm:text-sm">اكتشف الخيارات المتاحة، أرسل طلبك، وتابع التواصل في مساحة واحدة.</p>
                <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">سيارات معتمدة</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">بيانات المالك محمية</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">للشركات والأساطيل</span></div>
              </div>
            </div>
          </div>
          <div className="absolute -right-3 top-8 hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-xl sm:block motion-safe:animate-[catalogFloat_6s_ease-in-out_infinite]"><span className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><CarFront size={18} className="text-blue-700"/> كتالوج موحّد</span><p className="mt-1 text-xs text-slate-500">اختيارات واضحة في مكان واحد</p></div>
          <div className="absolute -left-3 bottom-24 hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-xl sm:block motion-safe:animate-[catalogFloat_7s_ease-in-out_infinite]"><span className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><CheckCircle2 size={18} className="text-emerald-600"/> مراجعة واعتماد</span><p className="mt-1 text-xs text-slate-500">عرض السيارات المستوفية للشروط</p></div>
        </div>
      </section>

      <PartnerLogoTicker />

      <section id="how-it-works" className="relative z-10 border-y border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,.96),rgba(235,243,255,.94)),url(https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80)] bg-cover bg-center py-16 shadow-[0_25px_70px_-55px_rgba(0,0,0,0.65)] sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-extrabold" style={{ color: settings.primary_color }}>مصممة لاحتياجات السوق المصري</p><h2 className="mt-3 text-3xl font-black tracking-tight text-navy sm:text-4xl">سيارتك المناسبة، وفرصتك القادمة تبدأ من هنا.</h2><p className="mt-4 leading-8 text-slate-600">نوصلك بملاك السيارات وموردي الأساطيل في مكان واحد، لتكتشف خيارات تناسب احتياجك وتحوّل طلباتك إلى فرص عمل حقيقية.</p></div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-3xl border border-white bg-white/95 p-6 text-slate-800 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon size={24} /></span><h3 className="mt-5 text-lg font-extrabold text-navy">{title}</h3><p className="mt-2 leading-7 text-slate-600">{description}</p></article>)}
          </div>
          <div className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-2xl font-black text-navy">خدمات مصممة لكل شريك</h3><p className="mt-2 text-sm leading-7 text-slate-600">أدوات مناسبة لطبيعة عملك، من عرض السيارات وحتى متابعة الطلبات والعروض.</p></div><a href="/services" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 font-bold text-blue-800">استكشف خدمات السيارات <ArrowLeft size={16}/></a></div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl border border-white bg-white/95 p-5 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={22}/></span><h4 className="mt-4 text-lg font-extrabold">للشركات المستأجرة</h4><p className="mt-2 text-sm leading-7 text-slate-600">سواء محتاج عربية أو أسطول كامل، هتلاقي اختيارات تناسبك.</p>{authStateReady && !isAuthenticated && <a href="/register/company" className="mt-4 inline-flex items-center gap-2 font-extrabold text-blue-700">ابدأ حساب شركتك <ArrowLeft size={15}/></a>}</article>
              <article className="rounded-3xl border border-white bg-white/95 p-5 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CarFront size={22}/></span><h4 className="mt-4 text-lg font-extrabold">لموردي الأساطيل</h4><p className="mt-2 text-sm leading-7 text-slate-600">اعرض سيارات أسطولك، استقبل طلبات الشركات، وقدّم عروضًا منظمة تساعدك على الوصول لفرص مناسبة.</p>{authStateReady && !isAuthenticated && <a href="/register/supplier" className="mt-4 inline-flex items-center gap-2 font-extrabold text-blue-700">سجّل كمورد أسطول <ArrowLeft size={15}/></a>}</article>
              <article className="rounded-3xl border border-white bg-white/95 p-5 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl"><span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><Users size={22}/></span><h4 className="mt-4 text-lg font-extrabold">لملاك السيارات</h4><p className="mt-2 text-sm leading-7 text-slate-600">خلّي عربياتك توصل للشركات اللي بتدور عليها.</p>{authStateReady && !isAuthenticated && <a href="/register/owner" className="mt-4 inline-flex items-center gap-2 font-extrabold text-blue-700">اعرض سيارتك <ArrowLeft size={15}/></a>}</article>
            </div>
          </div>
          {authStateReady && !isAuthenticated && settings.registration_enabled && <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl p-6 text-white sm:flex-row sm:p-8" style={{ backgroundColor: settings.secondary_color }}><div><h3 className="text-xl font-extrabold">ابدأ بخطوتك التالية</h3><p className="mt-2 text-sm leading-6 text-blue-100">أنشئ حسابك المناسب وابدأ في استكشاف خدمات My Car.</p></div><button onClick={() => { window.location.href = '/register' }} className="min-h-12 rounded-xl bg-white px-6 font-extrabold transition hover:bg-blue-50" style={{ color: settings.secondary_color }}>إنشاء حساب جديد</button></div>}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div><span>© {new Date().getFullYear()} {settings.platform_name}. </span><span>{settings.footer_text}</span></div>
        <div className="flex flex-wrap items-center gap-3"><a href="/services" className="font-bold text-blue-700 underline-offset-4 hover:underline">خدمات السيارات</a><a href="/privacy" className="font-bold text-blue-700 underline-offset-4 hover:underline">سياسة الخصوصية</a><a href="/terms" className="font-bold text-blue-700 underline-offset-4 hover:underline">شروط الاستخدام</a>{settings.support_email && <a href={'mailto:'+settings.support_email}>{settings.support_email}</a>}{settings.support_phone && <a href={'tel:'+settings.support_phone}>{settings.support_phone}</a>}{settings.website_url && <a href={settings.website_url} target="_blank" rel="noreferrer">الموقع الرسمي</a>}{settings.address && <span>{settings.address}</span>}</div>
        <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-cargreen' : 'bg-amber-500'}`} />{isSupabaseConfigured ? 'إعدادات الاتصال موجودة' : 'إعدادات الاتصال تحتاج إلى ضبط'}</span>
      </footer>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} initialMode={authMode} />}
    </main>
  )
}
