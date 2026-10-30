import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { ArrowLeft, Building2, CarFront, ShieldCheck, Users, Menu, X, UserRound, UserRoundPlus, MapPin, CalendarDays, Search, Star, HandCoins, Headset, BusFront, Building, UsersRound } from 'lucide-react'
import AuthPanel from './components/AuthPanel'
import AccountNotifications from './components/AccountNotifications'
import PlatformEntryBanner from './components/PlatformEntryBanner'
import RoleRegistrationPage, { RoleChooserPage } from './components/RoleRegistrationPage'
import LegalPages from './components/LegalPages'
const WorkspacePage = lazy(() => import('./components/WorkspacePage'))
const AdminReviewPage = lazy(() => import('./components/AdminReviewPage'))
const PlatformSettingsPage = lazy(() => import('./components/PlatformSettingsPage'))
const SubscriptionPlansPage = lazy(() => import('./components/SubscriptionPlansPage'))
const VehicleCatalogPage = lazy(() => import('./components/VehicleCatalogPage'))
const AutomotiveServicesPage = lazy(() => import('./components/AutomotiveServicesPage'))
const AdvertisingPlansAdminPage = lazy(() => import('./components/AdvertisingPlansAdminPage'))
const AdminCommunicationsPage = lazy(() => import('./components/AdminCommunicationsPage'))
const AdvertisingPlansPage = lazy(() => import('./components/AdvertisingPlansPage'))
const MessagingPage = lazy(() => import('./components/MessagingPage'))
const AuthCallbackPage = lazy(() => import('./components/AuthCallbackPage'))
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'))
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'

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
function RouteLoading({ logoUrl }: { logoUrl?: string | null }) {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_48%),#f8fafc] px-5 text-slate-600">
    <div className="flex flex-col items-center gap-4" role="status" aria-label="جارٍ تحميل منصة My Car">
      <div className="relative grid h-28 w-28 place-items-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full border-[4px] border-orange-100 shadow-[0_0_35px_rgba(249,115,22,0.16)]" />
        <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[4px] border-transparent border-t-orange-500 border-l-amber-400" />
        <span aria-hidden="true" className="absolute inset-2 animate-pulse rounded-full bg-orange-500/10" />
        <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center overflow-hidden rounded-full border-2 border-orange-400 bg-white shadow-[0_0_22px_rgba(249,115,22,0.25)]">
          {logoUrl ? <img src={logoUrl} alt="" className="h-14 w-14 object-contain" /> : <span aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />}
        </span>
      </div>
      <p className="text-sm font-extrabold tracking-wide text-slate-700">جارٍ تجهيز تجربتك على My Car...</p>
      <span className="h-1 w-28 overflow-hidden rounded-full bg-orange-100"><span className="block h-full w-1/2 animate-pulse rounded-full bg-orange-500" /></span>
    </div>
  </main>
}

function pathIsHome(path: string) { return path === '/' || path === '' }

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
  const [authOpen, setAuthOpen] = useState(() => window.location.search.includes('login=1') || window.location.search.includes('reset-password=1'))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [settings, setSettings] = useState<PlatformSettings>(defaults)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthLoaded(true); return }
    let active = true
    async function syncSession(user: User | null) {
      if (!active) return
      setAuthUser(user)
      if (!user) {
        setIsPlatformAdmin(false)
        setAuthLoaded(true)
        return
      }
      const { data } = await supabase!.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
      if (!active) return
      setIsPlatformAdmin(Boolean(data))
      setAuthLoaded(true)
    }
    void supabase.auth.getSession().then(({ data }) => syncSession(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.user ?? null)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    async function loadSettings() {
      if (!supabase) { setSettingsLoaded(true); return }
      const { data, error } = await supabase.from('public_platform_settings').select('*').eq('id', true).maybeSingle()
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
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (descriptionMeta) descriptionMeta.content = settings.description || defaults.description
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeMeta) themeMeta.content = settings.primary_color || defaults.primary_color
    document.documentElement.style.setProperty('--platform-primary', settings.primary_color || defaults.primary_color)
    document.documentElement.style.setProperty('--platform-secondary', settings.secondary_color || defaults.secondary_color)
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    const brandIcon = settings.favicon_url || settings.logo_url
    if (brandIcon) {
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = brandIcon
    } else if (link && !link.href.endsWith('/carhome-icon.svg')) {
      link.href = '/carhome-icon.svg'
    }
  }, [settings])

  function openAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const path = window.location.pathname
  useEffect(() => {
    if (!authUser) return
    // Authenticated users should never see sign-in/sign-up prompts or the registration chooser.
    setAuthOpen(false)
    const destination = isPlatformAdmin ? '/workspace/admin' : authUser.user_metadata?.organization_type === 'company' ? '/workspace/company' : authUser.user_metadata?.organization_type === 'fleet_supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'
    if (path === '/register' || path.startsWith('/register/')) window.location.replace(destination)
    if (path === '/workspace') window.location.replace(destination)
  }, [authUser, isPlatformAdmin, path])

  useEffect(() => {
    if (path === '/workspace' && authLoaded && !authUser) window.location.replace('/?login=1')
  }, [authLoaded, authUser, path])
  // Wait for saved platform identity to load before painting any route.
  // This prevents a default-theme flash before persisted brand colors are applied.
  if (!settingsLoaded) return <RouteLoading logoUrl={settings.logo_url} />
  // Resolve the persisted login state before showing homepage navigation, preventing auth-button flash.
  if (pathIsHome(window.location.pathname) && !authLoaded) return <RouteLoading logoUrl={settings.logo_url} />
  if (path === '/privacy') return <LegalPages kind="privacy" />
  if (path === '/terms') return <LegalPages kind="terms" />
  if (path === '/workspace' && !authLoaded) return <RouteLoading logoUrl={settings.logo_url} />
  if (path === '/workspace') return <RouteLoading logoUrl={settings.logo_url} />
  if (path === '/reset-password') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><ResetPasswordPage /></Suspense>
  if (path === '/auth/callback') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><AuthCallbackPage /></Suspense>
  if (path === '/workspace/admin/platform-settings') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><PlatformSettingsPage /></Suspense>
  if (path === '/workspace/admin/subscription-plans') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><SubscriptionPlansPage /></Suspense>
  if (path === '/workspace/admin/advertising-plans') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><AdvertisingPlansAdminPage /></Suspense>
  if (path === '/workspace/admin/communications') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><AdminCommunicationsPage /></Suspense>
  if (path === '/workspace/catalog') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><VehicleCatalogPage /></Suspense>
  if (path === '/services' || path === '/automotive-services') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><AutomotiveServicesPage /></Suspense>
  if (path === '/workspace/advertising-plans') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><AdvertisingPlansPage /></Suspense>
  if (path === '/workspace/admin' || path === '/workspace/admin/vehicle-reviews') return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><AdminReviewPage /></Suspense>
  if (path.includes('/messages')) return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><MessagingPage /></Suspense>
  if (path === '/workspace/company' || path.startsWith('/workspace/company/')) return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><WorkspacePage role="company" /></Suspense>
  if (path.startsWith('/workspace/owner')) return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><WorkspacePage role="owner" /></Suspense>
  if (path.startsWith('/workspace/supplier')) return <Suspense fallback={<RouteLoading logoUrl={settings.logo_url} />}><WorkspacePage role="supplier" /></Suspense>

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
    <main dir="rtl" className="min-h-screen overflow-hidden bg-white text-slate-900">{!authUser && <PlatformEntryBanner/>}
      {settings.announcement_text && <div className="px-4 py-2 text-center text-sm font-bold text-white" style={{backgroundColor:settings.primary_color}}>{settings.announcement_text}</div>}
      <section className="relative isolate overflow-hidden bg-[#09213b] text-white">
        <div className="absolute inset-0 -z-20 bg-cover bg-center" style={{backgroundImage:"url(https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=2200&q=90)"}}/>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#071b31]/80 via-[#0b2743]/40 to-[#071b31]"/>
        <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
          {authUser && <button aria-label={mobileNavOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={mobileNavOpen} aria-controls="mobile-main-navigation" onClick={()=>setMobileNavOpen(value=>!value)} className="order-3 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 text-white hover:bg-white/10 sm:hidden">{mobileNavOpen ? <X size={23}/> : <Menu size={23}/>}</button>}
          <div className="order-1 flex min-w-0 items-center gap-2 sm:order-1"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#ffad0a]/70 bg-white/10 p-1 sm:h-16 sm:w-16">{settings.logo_url ? <img src={settings.logo_url} alt={`${settings.platform_name} logo`} className="h-full w-full object-contain" /> : <img src="/carhome-icon.svg" alt="My Car" className="h-full w-full object-contain" />}</div><div className="text-right"><div className="text-2xl font-black leading-none text-[#ffad0a] sm:text-4xl">{settings.platform_name || "My Car"}</div><div className="mt-1 text-[10px] font-bold text-white/85 sm:text-xs">{settings.tagline || "منصة تأجير السيارات"}</div></div></div>
          {authUser && <nav aria-label="التنقل الرئيسي" className="order-2 hidden items-center gap-5 text-sm font-bold text-white/90 lg:flex"><a href="/" className="hover:text-[#ffad0a]">الرئيسية</a><a href="/workspace" className="hover:text-[#ffad0a]">مساحة العمل</a><a href="/workspace/catalog" className="hover:text-[#ffad0a]">استكشف السيارات</a><a href="/services" className="hover:text-[#ffad0a]">خدماتنا</a><a href="/workspace/advertising-plans" className="hover:text-[#ffad0a]">باقات الإعلانات</a></nav>}
          <div className="order-2 flex items-center gap-2 sm:order-3">{authUser ? <><a aria-label={isPlatformAdmin ? 'لوحة الإدارة' : 'مساحة العمل'} href={isPlatformAdmin ? '/workspace/admin' : authUser.user_metadata?.organization_type === 'company' ? '/workspace/company' : authUser.user_metadata?.organization_type === 'fleet_supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffad0a] px-3 text-xs font-black text-[#142b43] shadow-lg hover:bg-amber-300 sm:min-h-12 sm:px-5 sm:text-sm"><UserRound size={17}/><span className="hidden sm:inline">{isPlatformAdmin ? 'لوحة الإدارة' : 'مساحة العمل'}</span></a><AccountNotifications/></> : <><button aria-label="تسجيل الدخول" onClick={()=>openAuth('signin')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/80 bg-[#102c49]/60 px-3 text-xs font-extrabold text-white hover:bg-white/10 sm:min-h-12 sm:px-5 sm:text-sm"><UserRound size={17}/><span className="hidden sm:inline">تسجيل الدخول</span></button>{settings.registration_enabled&&<a aria-label="إنشاء حساب" href="/register" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffad0a] px-3 text-xs font-black text-[#142b43] shadow-lg hover:bg-amber-300 sm:min-h-12 sm:px-5 sm:text-sm"><UserRoundPlus size={17}/><span className="hidden sm:inline">إنشاء حساب</span></a>}</>}</div>
        </header>
        {authUser && mobileNavOpen && <nav id="mobile-main-navigation" aria-label="التنقل الرئيسي للهاتف" className="mx-4 mb-2 grid gap-1 rounded-2xl border border-white/15 bg-[#0b223b]/95 p-2 shadow-xl backdrop-blur-xl sm:mx-8 lg:hidden"><a onClick={()=>setMobileNavOpen(false)} href="/" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">الرئيسية</a><a onClick={()=>setMobileNavOpen(false)} href="/workspace" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">مساحة العمل</a><a onClick={()=>setMobileNavOpen(false)} href="/workspace/catalog" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">استكشف السيارات</a><a onClick={()=>setMobileNavOpen(false)} href="/services" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">خدمات السيارات</a><a onClick={()=>setMobileNavOpen(false)} href="/workspace/advertising-plans" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">باقات الإعلانات</a><a onClick={()=>setMobileNavOpen(false)} href="/privacy" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">سياسة الخصوصية</a></nav>}
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-8 sm:px-8 sm:pt-12">
          <div className="mr-0 w-full max-w-3xl text-right"><p className="text-sm font-bold text-white/90 sm:text-lg">منصة <span className="text-[#ffad0a]">My Car</span></p><h1 className="mt-3 text-4xl font-black leading-[1.35] tracking-tight sm:text-6xl lg:text-7xl">نربطك بأفضل<br/><span className="text-[#ffad0a]">السيارات في مصر</span></h1><p className="mt-5 max-w-xl text-sm font-semibold leading-8 text-white/90 sm:text-lg">منصة تجمع بين ملاك السيارات وموردي الأساطيل لتسهيل التأجير طويل الأجل.</p></div>
          <div className="mx-auto mt-8 flex w-full max-w-5xl items-end justify-center gap-2 sm:mt-6 sm:gap-4"><img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=90" alt="سيارة حديثة" className="h-28 min-w-0 flex-1 rounded-xl object-cover shadow-xl sm:h-44 sm:rounded-2xl lg:h-52"/><img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1100&q=90" alt="سيارة مناسبة للأعمال" className="h-36 min-w-0 flex-[1.2] rounded-xl object-cover shadow-2xl sm:h-52 sm:rounded-2xl lg:h-60"/><img src="https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1000&q=90" alt="سيارة فاخرة" className="h-28 min-w-0 flex-1 rounded-xl object-cover shadow-xl sm:h-44 sm:rounded-2xl lg:h-52"/></div>
          <form onSubmit={(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);const params=new URLSearchParams();['governorate','vehicle_type','duration'].forEach(key=>{const value=String(data.get(key)||'');if(value)params.set(key,value)});window.location.href='/workspace/catalog'+(params.toString()?'?'+params.toString():'')}} className="relative z-20 mx-auto mt-7 max-w-5xl rounded-3xl border border-white/70 bg-white p-3 text-slate-700 shadow-2xl sm:mt-8 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4"><MapPin className="shrink-0 text-[#173553]" size={21}/><span className="flex-1"><span className="block text-xs text-slate-500">المحافظة</span><select name="governorate" defaultValue="" className="w-full bg-transparent text-sm font-extrabold outline-none"><option value="">كل المحافظات</option>{['القاهرة','الجيزة','الإسكندرية','الشرقية','الغربية','الدقهلية','البحيرة','المنوفية','القليوبية','بورسعيد','السويس','أسيوط'].map(x=><option key={x} value={x}>{x}</option>)}</select></span></label>
              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4"><CarFront className="shrink-0 text-[#173553]" size={21}/><span className="flex-1"><span className="block text-xs text-slate-500">نوع السيارة</span><select name="vehicle_type" defaultValue="" className="w-full bg-transparent text-sm font-extrabold outline-none"><option value="">كل أنواع السيارات</option><option value="sedan">سيدان</option><option value="suv">SUV</option><option value="van">فان / ميكروباص</option><option value="bus">أتوبيس</option><option value="truck">نقل</option></select></span></label>
              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4"><CalendarDays className="shrink-0 text-[#173553]" size={21}/><span className="flex-1"><span className="block text-xs text-slate-500">مدة الإيجار</span><select name="duration" defaultValue="" className="w-full bg-transparent text-sm font-extrabold outline-none"><option value="">كل المدد</option><option value="monthly">شهري</option><option value="yearly">سنوي</option><option value="long-term">طويل الأجل</option></select></span></label>
            </div><button type="submit" className="mt-2 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#ffad0a] px-5 text-base font-black text-[#172d45] hover:bg-amber-300 sm:mt-3"><Search size={22}/> ابحث عن سيارة</button>
          </form>
          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-4 text-center sm:grid-cols-4 sm:gap-5">{[{icon:Star,title:'خيارات متعددة',desc:'بأسعار تنافسية'},{icon:HandCoins,title:'شركاء معتمدون',desc:'ملاك وموردون موثوقون'},{icon:Headset,title:'دعم مستمر',desc:'على مدار الساعة'},{icon:ShieldCheck,title:'مصداقية وأمان',desc:'تعامل موثوق'}].map(({icon:Icon,title,desc})=><div key={title} className="flex flex-col items-center border-white/15 px-2 sm:border-l"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-[#ffad0a] ring-1 ring-white/10 sm:h-14 sm:w-14"><Icon size={25}/></span><strong className="mt-2 text-sm font-extrabold sm:text-base">{title}</strong><span className="mt-1 text-xs text-white/70 sm:text-sm">{desc}</span></div>)}</div>
        </div>
      </section>
      <section id="services" className="relative rounded-t-[2.5rem] bg-[#f7f9fc] px-4 pb-16 pt-12 sm:px-8 sm:pt-16"><div className="mx-auto max-w-7xl">
        <div className="text-right"><p className="font-extrabold text-[#f5a400]">خدماتنا</p><h2 className="mt-2 text-3xl font-black text-[#102b47] sm:text-4xl">جميع احتياجاتك من السيارات</h2><span className="mt-3 block h-1.5 w-20 rounded-full bg-[#ffad0a]"></span><p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">نوفر لك مجموعة واسعة من السيارات المناسبة لجميع الاستخدامات</p></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[{title:'أسطول كامل لشركتك',desc:'حلول مرنة لاحتياجاتك المتنوعة',img:'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85',icon:Building},{title:'سيارات لموظفي شركتك',desc:'نقل الموظفين بأمان وراحة',img:'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=85',icon:UsersRound},{title:'سيارات للتوصيل والتشغيل',desc:'شاحنات التوصيل والخدمات اللوجستية',img:'https://images.unsplash.com/photo-1519003722824-194d4455a60f?auto=format&fit=crop&w=900&q=85',icon:BusFront}].map(({title,desc,img,icon:Icon})=><a key={title} href="/register/company" className="group relative isolate flex min-h-[250px] items-end overflow-hidden rounded-2xl bg-[#102b47] p-5 text-white shadow-lg"><img src={img} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-500 group-hover:scale-105"/><div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#08223d] via-[#08223d]/65 to-transparent"/><span className="w-full"><Icon size={27} className="mb-3 text-[#ffad0a]"/><strong className="block text-lg">{title}</strong><span className="mt-1 block text-sm text-white/80">{desc}</span><span className="mt-4 inline-flex rounded-full bg-white/15 p-2"><ArrowLeft size={18}/></span></span></a>)}
        </div>
        {!authUser && <><div className="mt-8 grid gap-4 sm:grid-cols-3">{[{icon:Building2,title:'للشركات المستأجرة',desc:'اطلب سيارة أو أسطولًا كاملًا حسب احتياج نشاطك.',href:'/register/company',cta:'ابدأ حساب شركتك'},{icon:CarFront,title:'لموردي الأساطيل',desc:'اعرض سياراتك واستقبل طلبات الشركات وعروضها.',href:'/register/supplier',cta:'سجّل كمورد أسطول'},{icon:Users,title:'لملاك السيارات',desc:'وصل سيارتك بالشركات الباحثة عن التأجير طويل الأجل.',href:'/register/owner',cta:'اعرض سيارتك'}].map(({icon:Icon,title,desc,href,cta})=><article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon size={25} className="text-[#f5a400]"/><h3 className="mt-3 text-lg font-black text-[#102b47]">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p><a href={href} className="mt-4 inline-flex items-center gap-2 font-extrabold text-[#173553]">{cta}<ArrowLeft size={16}/></a></article>)}</div>
        {settings.registration_enabled&&<div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#102b47] p-6 text-white sm:flex-row sm:items-center sm:p-8"><div><h3 className="text-xl font-extrabold">ابدأ رحلتك مع My Car</h3><p className="mt-2 text-sm leading-6 text-white/75">أنشئ حسابك واستكشف خدمات السيارات للشركات والأساطيل.</p></div><a href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ffad0a] px-6 font-black text-[#102b47]">إنشاء حساب جديد</a></div>}</>}
      </div></section>
      <footer className="bg-[#071b31] px-5 py-7 text-sm text-white/70 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>© {new Date().getFullYear()} {settings.platform_name}. {settings.footer_text}</div><div className="flex flex-wrap items-center gap-4"><a href="/services" className="hover:text-[#ffad0a]">خدمات السيارات</a><a href="/privacy" className="hover:text-[#ffad0a]">سياسة الخصوصية</a><a href="/terms" className="hover:text-[#ffad0a]">شروط الاستخدام</a>{settings.support_email&&<a href={'mailto:'+settings.support_email}>{settings.support_email}</a>}{settings.support_phone&&<a href={'tel:'+settings.support_phone}>{settings.support_phone}</a>}</div></div></footer>
      {authOpen&&<AuthPanel onClose={()=>setAuthOpen(false)} initialMode={authMode}/>}
    </main>
  )
}
