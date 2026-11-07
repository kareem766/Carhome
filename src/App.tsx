import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { ArrowLeft, Building2, CarFront, ShieldCheck, Menu, X, UserRound, UserRoundPlus, MapPin, CalendarDays, Search, Star, HandCoins, Headset, BusFront, RefreshCw, MessageCircle, Wrench, Megaphone, Bot } from 'lucide-react'
import AuthPanel from './components/AuthPanel'
import PlatformLoading from './components/PlatformLoading'
import AccountNotifications from './components/AccountNotifications'
import SupplierPageShell from './components/SupplierPageShell'
import PlatformEntryBanner from './components/PlatformEntryBanner'
import MyCarAssistantPage from './components/MyCarAssistantPage'
const SupportCenterPage = lazy(() => import('./components/SupportCenterPage'))
import RoleRegistrationPage, { RoleChooserPage } from './components/RoleRegistrationPage'
import LegalPages from './components/LegalPages'
const WorkspacePage = lazy(() => import('./components/WorkspacePage'))
const EmployeeRegistrationPage = lazy(() => import('./components/EmployeeRegistrationPage'))
const EmployeeWorkspacePage = lazy(() => import('./components/EmployeeWorkspacePage'))
const EmployeeRequestsOffersPage = lazy(() => import('./components/EmployeeRequestsOffersPage'))
const EmployeeAccountPage = lazy(() => import('./components/EmployeeAccountPage'))
const EmployeeRentalMessagesPage = lazy(() => import('./components/EmployeeRentalMessagesPage'))
const EmployeeProviderRequestsPage = lazy(() => import('./components/EmployeeProviderRequestsPage'))
const EmployeeAdminRequestsPage = lazy(() => import('./components/EmployeeAdminRequestsPage'))
const CompanyInsightsPage = lazy(() => import('./components/CompanyInsightsPage'))
const CompanyTeamPage = lazy(() => import('./components/CompanyTeamPage'))
const ManagedSourcingPage = lazy(() => import('./components/ManagedSourcingPage'))
const AdminReviewPage = lazy(() => import('./components/AdminReviewPage'))
const AdminAnalyticsPage = lazy(() => import('./components/AdminAnalyticsPage'))
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'))
const PlatformSettingsPage = lazy(() => import('./components/PlatformSettingsPage'))
const SubscriptionPlansPage = lazy(() => import('./components/SubscriptionPlansPage'))
const VehicleCatalogPage = lazy(() => import('./components/VehicleCatalogPage'))
const AutomotiveServicesPage = lazy(() => import('./components/AutomotiveServicesPage'))
const ServiceProviderRegistrationPage = lazy(() => import('./components/ServiceProviderRegistrationPage'))
const AdvertisingPlansAdminPage = lazy(() => import('./components/AdvertisingPlansAdminPage'))
const PaymentInformationPage = lazy(() => import('./components/PaymentInformationPage'))
const AdminManagedAccountsPage = lazy(() => import('./components/AdminManagedAccountsPage'))
const FirstLoginPasswordPage = lazy(() => import('./components/FirstLoginPasswordPage'))
const AdminCommunicationsPage = lazy(() => import('./components/AdminCommunicationsPage'))
const AdvertisingPlansPage = lazy(() => import('./components/AdvertisingPlansPage'))
const MessagingPage = lazy(() => import('./components/MessagingPage'))
const AuthCallbackPage = lazy(() => import('./components/AuthCallbackPage'))
const GoogleProfileCompletionPage = lazy(() => import('./components/GoogleProfileCompletionPage'))
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'))
const NotificationPreferencesPage = lazy(() => import('./components/NotificationPreferencesPage'))
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
  platform_name: 'My Car عربيتي', tagline: 'منصة السيارات للشركات والأساطيل في مصر',
  description: 'منصة وسيطة تجمع ملاك السيارات وموردي الأساطيل مع الشركات التي تحتاج إلى تأجير شهري أو سنوي طويل الأجل، من خلال تجربة عربية منظمة.',
  logo_url: null, favicon_url: null, support_email: null, support_phone: null, website_url: null, address: null,
  footer_text: 'جميع الحقوق محفوظة.', announcement_text: null, primary_color: '#1d4ed8', secondary_color: '#0f172a',
  registration_enabled: true, owner_registration_enabled: true, company_registration_enabled: true,
  supplier_registration_enabled: true, maintenance_mode: false
}
function pathIsHome(path: string) { return path === '/' || path === '' }
const HOME_CAR_IMAGES = [
  [
    'https://www.mannfleetpartners.com/serviceimages/PHOTO-2026-05-28-11-53-44.jpg',
    'https://corporate.autovermietung-arndt.de/fileadmin/corporate-page/img/arndt_corporate23.jpg',
    'https://phoenixrentalcars.com/phoenix-car-rental-vehicle-lineup.webp'
  ],
  [
    'https://bmkltsly13vb.compat.objectstorage.ap-mumbai-1.oraclecloud.com/cdn.ft.lk/assets/uploads/image_e2653488f5.jpg',
    'https://www.mannfleetpartners.com/serviceimages/PHOTO-2026-05-28-11-53-44.jpg',
    'https://corporate.autovermietung-arndt.de/fileadmin/corporate-page/img/arndt_corporate23.jpg'
  ],
  [
    'https://ireland.apollo.olxcdn.com/v1/files/bjh0fmv4qbah1-PT/image',
    'https://phoenixrentalcars.com/phoenix-car-rental-vehicle-lineup.webp',
    'https://www.mannfleetpartners.com/serviceimages/PHOTO-2026-05-28-11-53-44.jpg'
  ]
]
function OwnerPersistentBar() {
  const links = [
    { href: '/workspace/owner/vehicles', label: 'سياراتي', icon: <CarFront size={17}/> },
    { href: '/services', label: 'خدمات السيارات', icon: <Wrench size={17}/> },
    { href: '/workspace/advertising-plans', label: 'باقات الإعلانات', icon: <Megaphone size={17}/> },
    { href: '/messages', label: 'المراسلات', icon: <MessageCircle size={17}/> },
    { href: '/workspace/provider-employee-requests', label: 'طلبات الموظفين', icon: <UserRound size={17}/> },
    { href: '/assistant', label: 'مساعد My Car', icon: <Bot size={17}/> },
  ]
  return <header dir="rtl" className="mc-owner-persistent-bar">
    <a href="/workspace/owner/vehicles" className="mc-owner-bar-brand"><span className="mc-owner-bar-mark"><CarFront size={21}/></span><span><strong>My Car <span className="text-cyan-300">عربيتي</span></strong><small>مساحة مالك السيارة</small></span></a>
    <nav aria-label="التنقل الرئيسي" className="mc-owner-main-links">{links.map(link => <a key={link.href} href={link.href} className="mc-owner-main-link">{link.icon}<span>{link.label}</span></a>)}</nav>
    <div className="mc-owner-bar-actions">
      <button type="button" aria-label="تحديث الصفحة" title="تحديث الصفحة" onClick={()=>window.location.reload()} className="mc-owner-bar-action"><RefreshCw size={18}/><span>تحديث</span></button>
      <AccountNotifications/>
    </div>
  </header>
}


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
  const [adminLookupError, setAdminLookupError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [homeImageUrls, setHomeImageUrls] = useState<string[]>([])
  const [homeImagesReady, setHomeImagesReady] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthLoaded(true); return }
    let active = true
    let syncSequence = 0
    async function syncSession(user: User | null) {
      const sequence = ++syncSequence
      if (!active) return
      setAuthUser(user)
      setAdminLookupError(null)
      if (!user) {
        setIsPlatformAdmin(false)
        setAuthLoaded(true)
        return
      }
      setAuthLoaded(false)
      // Resolve the trusted admin roster only after the auth event has released its internal lock.
      const { data, error } = await supabase!.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
      if (!active || sequence !== syncSequence) return
      if (error) {
        console.error('Platform admin role lookup failed:', error)
        setIsPlatformAdmin(false)
        setAdminLookupError('تعذر التحقق من صلاحيات مدير المنصة. لم يتم تحويلك إلى مساحة مالك السيارة حفاظًا على صلاحيات الحساب.')
      } else {
        setIsPlatformAdmin(Boolean(data))
      }
      setAuthLoaded(true)
    }
    void supabase.auth.getSession().then(({ data }) => syncSession(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase recommends deferring follow-up client calls outside the auth callback.
      window.setTimeout(() => { void syncSession(session?.user ?? null) }, 0)
    })
    return () => { active = false; syncSequence++; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    async function loadSettings() {
      if (!supabase) { setSettingsLoaded(true); return }
      const { data, error } = await supabase.from('public_platform_settings').select('*').eq('id', true).maybeSingle()
      if (active && !error && data) {
        const loadedSettings = { ...defaults, ...data, platform_name: ['Carhome', 'My Car'].includes(data.platform_name) ? defaults.platform_name : (data.platform_name || defaults.platform_name), tagline: data.tagline === 'تأجير السيارات للشركات' ? defaults.tagline : (data.tagline || defaults.tagline) } as PlatformSettings
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

  useEffect(() => {
    if (!pathIsHome(window.location.pathname)) { setHomeImagesReady(true); return }
    let active = true
    const loadImage = (sources: string[]) => new Promise<string>((resolve, reject) => {
      let index = 0
      const tryNext = () => {
        const source = sources[index++]
        if (!source) {
          reject(new Error('Homepage vehicle photography could not be loaded.'))
          return
        }
        const image = new Image()
        image.onload = () => { void image.decode().catch(() => undefined).then(() => resolve(source)) }
        image.onerror = tryNext
        image.src = source
      }
      tryNext()
    })
    void Promise.all(HOME_CAR_IMAGES.map(loadImage)).then((urls) => {
      if (!active) return
      setHomeImageUrls(urls)
      setHomeImagesReady(true)
    }).catch((error) => {
      // Fail closed: the homepage stays on its branded loader instead of showing empty or broken vehicle cards.
      console.error(error)
    })
    return () => { active = false }
  }, [])

  const path = window.location.pathname
  useEffect(() => {
    if (authUser?.app_metadata?.must_change_password === true) {
      if (path !== '/first-login-password') window.location.replace('/first-login-password')
      return
    }
    if (!authUser) return
    // Wait until the platform-admin lookup finishes before choosing a workspace.
    // Otherwise the initial false admin state can redirect the owner to the car-owner area.
    if (!authLoaded) return
    // Never guess an admin's business role when the trusted admin lookup fails.
    if (adminLookupError) return
    // Incomplete Google signups must be allowed to choose their account type before workspace routing.
    const needsGoogleOnboarding = authUser.app_metadata?.provider === 'google' && Number(authUser.user_metadata?.onboarding_version || 0) < 2
    if (needsGoogleOnboarding && path.startsWith('/register')) return
    // Authenticated users should never see sign-in/sign-up prompts or the registration chooser.
    setAuthOpen(false)
    const destination = isPlatformAdmin ? '/workspace/admin' : authUser.user_metadata?.organization_type === 'employee' ? '/workspace/employee' : authUser.user_metadata?.organization_type === 'company' ? '/workspace/company' : authUser.user_metadata?.organization_type === 'fleet_supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'
    if (isPlatformAdmin && path.startsWith('/workspace/') && !path.startsWith('/workspace/admin')) window.location.replace('/workspace/admin')
    if (path === '/register' || path.startsWith('/register/')) window.location.replace(destination)
    if (path === '/workspace') window.location.replace(destination)
    // Owners land directly on their vehicle portfolio after every successful sign-in.
    if ((path === '/' || pathIsHome(path)) && !isPlatformAdmin && authUser.user_metadata?.organization_type !== 'company' && authUser.user_metadata?.organization_type !== 'fleet_supplier' && authUser.user_metadata?.organization_type !== 'employee') window.location.replace('/workspace/owner/vehicles')
  }, [authLoaded, authUser, isPlatformAdmin, path])

  useEffect(() => {
    if (path === '/workspace' && authLoaded && !authUser) window.location.replace('/?login=1')
  }, [authLoaded, authUser, path])
  // Wait for saved platform identity to load before painting any route.
  // This prevents a default-theme flash before persisted brand colors are applied.
  if (!settingsLoaded) return <PlatformLoading />
  // Resolve the persisted login state before showing homepage navigation, preventing auth-button flash.
  if (pathIsHome(window.location.pathname) && !authLoaded) return <PlatformLoading />
  // Keep the public homepage behind the branded loader until every hero vehicle visual has decoded.
  if (pathIsHome(window.location.pathname) && !homeImagesReady) return <PlatformLoading />
  if (authUser?.app_metadata?.must_change_password === true && path !== '/first-login-password') return <Suspense fallback={<PlatformLoading />}><FirstLoginPasswordPage /></Suspense>
  if (authUser && adminLookupError) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white"><section className="w-full max-w-xl rounded-3xl border border-amber-400/30 bg-slate-900 p-8 text-center shadow-2xl"><ShieldCheck className="mx-auto mb-4 text-amber-400" size={42}/><h1 className="text-xl font-black">تعذر التحقق من صلاحيات لوحة التحكم</h1><p className="mt-3 leading-8 text-slate-300">{adminLookupError}</p><button type="button" onClick={()=>window.location.reload()} className="mt-6 rounded-xl bg-amber-400 px-6 py-3 font-black text-slate-950">إعادة المحاولة</button></section></main>
  if (path === '/assistant') return authUser ? <MyCarAssistantPage /> : <ServiceNotice settings={settings} title="سجّل الدخول لاستخدام المساعد" message="مساعد My Car متاح للمستخدمين المسجلين فقط، ويعمل وفق صلاحيات الحساب." />
  if (path === '/privacy') return <LegalPages kind="privacy" />
  if (path === '/terms') return <LegalPages kind="terms" />
  if (path === '/workspace' && !authLoaded) return <PlatformLoading />
  if (path === '/workspace') return <PlatformLoading />
  if (path === '/first-login-password') return <Suspense fallback={<PlatformLoading />}><FirstLoginPasswordPage /></Suspense>
  if (path === '/reset-password') return <Suspense fallback={<PlatformLoading />}><ResetPasswordPage /></Suspense>
  if (path === '/auth/callback') return <Suspense fallback={<PlatformLoading />}><AuthCallbackPage /></Suspense>
  if (path === '/complete-profile') return <Suspense fallback={<PlatformLoading />}><GoogleProfileCompletionPage /></Suspense>
  if (path === '/workspace/notifications') return authUser ? authUser.user_metadata?.organization_type === 'fleet_supplier' ? <SupplierPageShell><Suspense fallback={<PlatformLoading />}><NotificationPreferencesPage /></Suspense></SupplierPageShell> : <Suspense fallback={<PlatformLoading />}><NotificationPreferencesPage /></Suspense> : <ServiceNotice settings={settings} title="سجّل الدخول لإعداد الإشعارات" message="يمكنك التحكم في قنوات الإشعارات بعد تسجيل الدخول." />
  if (path === '/support') return authUser ? <Suspense fallback={<PlatformLoading />}><SupportCenterPage /></Suspense> : <ServiceNotice settings={settings} title="سجّل الدخول لمركز الدعم" message="مركز الدعم الفني متاح للمستخدمين المسجلين لمتابعة تذاكرهم والردود." />
  if (path === '/workspace/admin/support') return authUser ? <Suspense fallback={<PlatformLoading />}><SupportCenterPage admin /></Suspense> : <ServiceNotice settings={settings} title="سجّل الدخول لإدارة الدعم" message="هذه الصفحة مخصصة لفريق إدارة المنصة." />
  if (path === '/workspace/employee/messages' || path === '/workspace/provider/employee-messages') return <Suspense fallback={<PlatformLoading />}><EmployeeRentalMessagesPage /></Suspense>
  if (path === '/workspace/employee/account') return <Suspense fallback={<PlatformLoading />}><EmployeeAccountPage /></Suspense>
  if (path === '/workspace/employee/requests') return <Suspense fallback={<PlatformLoading />}><EmployeeRequestsOffersPage /></Suspense>
  if (path === '/workspace/employee') return <Suspense fallback={<PlatformLoading />}><EmployeeWorkspacePage /></Suspense>
  if (path === '/workspace/provider-employee-requests' || path === '/workspace/owner/employee-requests' || path === '/workspace/supplier/employee-requests') return <Suspense fallback={<PlatformLoading />}><EmployeeProviderRequestsPage /></Suspense>
  if (path === '/workspace/admin/employee-requests') return <Suspense fallback={<PlatformLoading />}><EmployeeAdminRequestsPage /></Suspense>
  if (path === '/workspace/company/team') return <Suspense fallback={<PlatformLoading />}><CompanyTeamPage /></Suspense>
  if (path === '/workspace/company/insights') return <Suspense fallback={<PlatformLoading />}><CompanyInsightsPage /></Suspense>
  if (path === '/workspace/admin/managed-sourcing') return <Suspense fallback={<PlatformLoading />}><ManagedSourcingPage admin /></Suspense>
  if (path === '/workspace/company/managed-sourcing') return <Suspense fallback={<PlatformLoading />}><ManagedSourcingPage /></Suspense>
  if (path === '/workspace/admin/platform-settings') return <Suspense fallback={<PlatformLoading />}><PlatformSettingsPage /></Suspense>
  if (path === '/workspace/admin/managed-accounts') return <Suspense fallback={<PlatformLoading />}><AdminManagedAccountsPage /></Suspense>
  if (path === '/workspace/admin/payment-information') return <Suspense fallback={<PlatformLoading />}><PaymentInformationPage /></Suspense>
  if (path === '/workspace/admin/subscription-plans') return <Suspense fallback={<PlatformLoading />}><SubscriptionPlansPage /></Suspense>
  if (path === '/workspace/admin/advertising-plans') return <Suspense fallback={<PlatformLoading />}><AdvertisingPlansAdminPage /></Suspense>
  if (path === '/workspace/admin/communications') return <Suspense fallback={<PlatformLoading />}><AdminCommunicationsPage /></Suspense>
  if (path === '/workspace/catalog') {
    if (!authLoaded) return <PlatformLoading />
    if (authUser?.user_metadata?.organization_type === 'individual_owner') {
      window.location.replace('/workspace/owner/vehicles')
      return <PlatformLoading />
    }
    if (!authUser || !['company','fleet_supplier'].includes(String(authUser.user_metadata?.organization_type || ''))) return <ServiceNotice settings={settings} title="الكتالوج متاح للشركات وموردي الأساطيل" message="سجّل الدخول بحساب شركة أو مورد أسطول لاستعراض السيارات المعتمدة." />
    return authUser.user_metadata?.organization_type === 'fleet_supplier' ? <SupplierPageShell><Suspense fallback={<PlatformLoading />}><VehicleCatalogPage /></Suspense></SupplierPageShell> : <Suspense fallback={<PlatformLoading />}><VehicleCatalogPage /></Suspense>
  }
  if (path === '/services/provider/register') return <>{authUser?.user_metadata?.organization_type === 'individual_owner' && <OwnerPersistentBar/>}<Suspense fallback={<PlatformLoading />}><ServiceProviderRegistrationPage /></Suspense></>
  if (path === '/services' || path === '/automotive-services') return <>{authUser?.user_metadata?.organization_type === 'individual_owner' && <OwnerPersistentBar/>}{authUser?.user_metadata?.organization_type === 'fleet_supplier' ? <SupplierPageShell><Suspense fallback={<PlatformLoading />}><AutomotiveServicesPage /></Suspense></SupplierPageShell> : <Suspense fallback={<PlatformLoading />}><AutomotiveServicesPage /></Suspense>}</>
  if (path === '/workspace/advertising-plans') {
    if (!authLoaded) return <PlatformLoading />
    if (authUser?.user_metadata?.organization_type === 'company') return <Suspense fallback={<PlatformLoading />}><ManagedSourcingPage /></Suspense>
    return <>{authUser?.user_metadata?.organization_type === 'individual_owner' && <OwnerPersistentBar/>}{authUser?.user_metadata?.organization_type === 'fleet_supplier' ? <SupplierPageShell><Suspense fallback={<PlatformLoading />}><AdvertisingPlansPage /></Suspense></SupplierPageShell> : <Suspense fallback={<PlatformLoading />}><AdvertisingPlansPage /></Suspense>}</>
  }
  if (path === '/workspace/admin') return <Suspense fallback={<PlatformLoading />}><AdminDashboardPage /></Suspense>
  if (path === '/workspace/admin/analytics') return <Suspense fallback={<PlatformLoading />}><AdminAnalyticsPage /></Suspense>
  if (path === '/workspace/admin/vehicle-reviews') return <Suspense fallback={<PlatformLoading />}><AdminReviewPage /></Suspense>
  if (path.includes('/messages')) return <>{authUser?.user_metadata?.organization_type === 'fleet_supplier' ? <SupplierPageShell><Suspense fallback={<PlatformLoading />}><MessagingPage /></Suspense></SupplierPageShell> : <Suspense fallback={<PlatformLoading />}>{authUser && authUser.user_metadata?.organization_type === 'individual_owner' && <OwnerPersistentBar/>}<MessagingPage /></Suspense>}</>
  if (path === '/workspace/company' || path.startsWith('/workspace/company/')) return <Suspense fallback={<PlatformLoading />}><WorkspacePage role="company" /></Suspense>
  if (path.startsWith('/workspace/owner')) return <><OwnerPersistentBar/><Suspense fallback={<PlatformLoading />}><WorkspacePage role="owner" /></Suspense></>
  if (path.startsWith('/workspace/supplier')) return <Suspense fallback={<PlatformLoading />}><WorkspacePage role="supplier" /></Suspense>

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
  if (path === '/register/employee') return <Suspense fallback={<PlatformLoading />}><EmployeeRegistrationPage /></Suspense>
  if (path === '/register') return <RoleChooserPage onChoose={(role) => {
    const enabled = role === 'employee' ? true : role === 'individual_owner' ? settings.owner_registration_enabled : role === 'fleet_supplier' ? settings.supplier_registration_enabled : settings.company_registration_enabled
    if (!enabled) { window.alert('التسجيل لهذا النوع من الحسابات غير متاح حاليًا.'); return }
    const needsGoogleOnboarding = authUser?.app_metadata?.provider === 'google' && Number(authUser.user_metadata?.onboarding_version || 0) < 2
    if (needsGoogleOnboarding) {
      sessionStorage.setItem('mycar_google_pending_role', role)
      window.location.href = '/complete-profile?role=' + encodeURIComponent(role)
      return
    }
    window.location.href = role === 'employee' ? '/register/employee' : '/register/' + (role === 'individual_owner' ? 'owner' : role === 'fleet_supplier' ? 'supplier' : 'company')
  }} onLogin={() => { window.location.href = '/?login=1' }} />
  if (path === '/register/owner') return <RoleRegistrationPage role="individual_owner" onBack={() => { window.location.href = '/register' }} />
  if (path === '/register/company') return <RoleRegistrationPage role="company" onBack={() => { window.location.href = '/register' }} />
  if (path === '/register/supplier') return <RoleRegistrationPage role="fleet_supplier" onBack={() => { window.location.href = '/register' }} />

  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#061b36] text-slate-900">{!authUser && <PlatformEntryBanner/>}
      {settings.announcement_text && <div className="px-4 py-2 text-center text-sm font-bold text-white" style={{backgroundColor:settings.primary_color}}>{settings.announcement_text}</div>}
      <section className="mc-home-hero-section relative isolate overflow-hidden bg-[#061b36] text-white">
        <div className="absolute inset-0 -z-20 bg-cover bg-center" style={{backgroundImage:"url(https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=2200&q=90)"}}/>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#071b31]/80 via-[#0b2743]/40 to-[#071b31]"/>
        <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
          {authUser && <button aria-label={mobileNavOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={mobileNavOpen} aria-controls="mobile-main-navigation" onClick={()=>setMobileNavOpen(value=>!value)} className="order-3 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 text-white hover:bg-white/10 sm:hidden">{mobileNavOpen ? <X size={23}/> : <Menu size={23}/>}</button>}
          <div className="mc-brand-group order-1 flex min-w-0 items-center gap-3 sm:order-1"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#ffad0a]/70 bg-white/10 p-1 sm:h-16 sm:w-16">{<img src={settings.logo_url || "https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png"} alt={`${settings.platform_name || "My Car"} logo`} className="h-full w-full object-contain" onError={event => { event.currentTarget.style.display = "none" }} />}</div><div className="mc-brand-lockup text-right"><div className="mc-brand-name">{(settings.platform_name || "My Car عربيتي") === "My Car عربيتي" ? <><span dir="ltr">My Car</span><span className="mc-brand-arabic">عربيتي</span></> : settings.platform_name || "My Car عربيتي"}</div><div className="mc-brand-tagline">{settings.tagline || "منصة السيارات للشركات والأساطيل في مصر"}</div></div></div>
          {authUser && <nav aria-label="التنقل الرئيسي" className="order-2 hidden items-center gap-5 text-sm font-bold text-white/90 lg:flex"><a href="/" className="hover:text-[#ffad0a]">الرئيسية</a><a href="/workspace" className="hover:text-[#ffad0a]">مساحة العمل</a>{['company','fleet_supplier'].includes(String(authUser.user_metadata?.organization_type || '')) && <a href="/workspace/catalog" className="hover:text-[#ffad0a]">استكشف السيارات</a>}<a href="/services" className="hover:text-[#ffad0a]">خدماتنا</a>{authUser.user_metadata?.organization_type === 'company' ? <a href="/workspace/company/managed-sourcing" className="hover:text-[#ffad0a]">خدمة البحث نيابةً عنك</a> : <a href="/workspace/advertising-plans" className="hover:text-[#ffad0a]">باقات الإعلانات</a>}</nav>}
          <div className="order-2 flex items-center gap-2 sm:order-3">{authUser ? <><a aria-label={isPlatformAdmin ? 'لوحة الإدارة' : 'مساحة العمل'} href={isPlatformAdmin ? '/workspace/admin' : authUser.user_metadata?.organization_type === 'employee' ? '/workspace/employee' : authUser.user_metadata?.organization_type === 'company' ? '/workspace/company' : authUser.user_metadata?.organization_type === 'fleet_supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffad0a] px-3 text-xs font-black text-[#142b43] shadow-lg hover:bg-amber-300 sm:min-h-12 sm:px-5 sm:text-sm"><UserRound size={17}/><span className="hidden sm:inline">{isPlatformAdmin ? 'لوحة الإدارة' : 'مساحة العمل'}</span></a><AccountNotifications/></> : <><button aria-label="تسجيل الدخول" onClick={()=>openAuth('signin')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/80 bg-[#102c49]/60 px-3 text-xs font-extrabold text-white hover:bg-white/10 sm:min-h-12 sm:px-5 sm:text-sm"><UserRound size={17}/><span className="hidden sm:inline">تسجيل الدخول</span></button>{settings.registration_enabled&&<a aria-label="إنشاء حساب" href="/register" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffad0a] px-3 text-xs font-black text-[#142b43] shadow-lg hover:bg-amber-300 sm:min-h-12 sm:px-5 sm:text-sm"><UserRoundPlus size={17}/><span className="hidden sm:inline">إنشاء حساب</span></a>}</>}</div>
        </header>
        {authUser && mobileNavOpen && <nav id="mobile-main-navigation" aria-label="التنقل الرئيسي للهاتف" className="mx-4 mb-2 grid gap-1 rounded-2xl border border-white/15 bg-[#0b223b]/95 p-2 shadow-xl backdrop-blur-xl sm:mx-8 lg:hidden"><a onClick={()=>setMobileNavOpen(false)} href="/" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">الرئيسية</a><a onClick={()=>setMobileNavOpen(false)} href="/workspace" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">مساحة العمل</a>{['company','fleet_supplier'].includes(String(authUser.user_metadata?.organization_type || '')) && <a onClick={()=>setMobileNavOpen(false)} href="/workspace/catalog" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">استكشف السيارات</a>}<a onClick={()=>setMobileNavOpen(false)} href="/services" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">خدمات السيارات</a>{authUser.user_metadata?.organization_type === 'company' ? <a onClick={()=>setMobileNavOpen(false)} href="/workspace/company/managed-sourcing" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">خدمة البحث نيابةً عنك</a> : <a onClick={()=>setMobileNavOpen(false)} href="/workspace/advertising-plans" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">باقات الإعلانات</a>}<a onClick={()=>setMobileNavOpen(false)} href="/privacy" className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">سياسة الخصوصية</a></nav>}
        <div className="mc-home-content mx-auto max-w-[1400px] px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
          <div className="mc-home-hero-layout">
            <div className="mc-home-hero-visual" aria-label="سيارة مناسبة لتشغيل الشركات">
              <img src={homeImageUrls[0]} alt="سيارة سيدان مناسبة لتشغيل الشركات" loading="eager" decoding="async"/>
              <span className="mc-home-hero-glow" aria-hidden="true"/>
            </div>
            <div className="mc-home-copy">
              <p className="text-sm font-bold text-white/90 sm:text-lg">منصة <span className="text-[#ffad0a]">My Car عربيتي</span></p>
              <h1 className="mt-3 text-4xl font-black leading-[1.35] tracking-tight sm:text-6xl lg:text-7xl">نربطك بأفضل<br/><span className="text-[#ffad0a]">السيارات في مصر</span></h1>
              <span className="mc-home-title-underline" aria-hidden="true"/>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-8 text-white/90 sm:text-lg">سواء كنت شركة تبحث عن سيارات تناسب تشغيلك، أو مالكًا يريد الوصول إلى فرص تأجير طويلة الأجل، أو موردًا يدير أسطولًا كاملًا؛ My Car عربيتي تجمع احتياجات سوق تأجير السيارات للشركات في مكان واحد.</p>
            </div>
          </div>
          <div className="mc-home-vehicle-gallery mx-auto mt-8 grid w-full max-w-6xl grid-cols-3 gap-3 sm:mt-10 sm:gap-5" aria-label="فئات السيارات">
            {homeImageUrls.map((src, index) => <a key={src + index} href={authUser && ['company','fleet_supplier'].includes(String(authUser.user_metadata?.organization_type || '')) ? '/workspace/catalog' : '/register/company'} className={`mc-home-vehicle-card group relative isolate block h-32 overflow-hidden rounded-2xl border bg-[#102b47] shadow-[0_18px_45px_rgba(0,0,0,.24)] sm:h-52 lg:h-64 ${index === 1 ? 'mc-home-vehicle-card-featured' : ''}`}>
              <img src={src} alt={['سيارات سيدان','سيارات SUV','سيارات نقل وخدمات'][index]} loading="eager" decoding="async" fetchPriority="high" width="1200" height="800" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"/>
              <div className="absolute inset-0 bg-gradient-to-t from-[#06172a]/95 via-[#06172a]/15 to-transparent"/>
              {index === 1 && <span className="mc-home-popular-badge"><Star size={15} fill="currentColor"/> الأكثر طلبًا</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2 pb-3 text-right text-[11px] font-black text-white sm:px-4 sm:pb-4 sm:text-base"><span>{['سيارات سيدان','سيارات SUV','سيارات نقل وخدمات'][index]}</span><span className="mc-home-card-arrow"><ArrowLeft size={17}/></span></div>
            </a>)}
          </div>
          {authUser?.user_metadata?.organization_type === 'company' && <form onSubmit={(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);const params=new URLSearchParams();['governorate','vehicle_type','duration'].forEach(key=>{const value=String(data.get(key)||'');if(value)params.set(key,value)});window.location.href='/workspace/catalog'+(params.toString()?'?'+params.toString():'')}} className="relative z-20 mx-auto mt-7 max-w-5xl rounded-3xl border border-white/70 bg-white p-3 text-slate-700 shadow-2xl sm:mt-8 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4"><MapPin className="shrink-0 text-[#173553]" size={21}/><span className="flex-1"><span className="block text-xs text-slate-500">المحافظة</span><select name="governorate" defaultValue="" className="w-full bg-transparent text-sm font-extrabold outline-none"><option value="">كل المحافظات</option>{['القاهرة','الجيزة','الإسكندرية','الشرقية','الغربية','الدقهلية','البحيرة','المنوفية','القليوبية','بورسعيد','السويس','أسيوط'].map(x=><option key={x} value={x}>{x}</option>)}</select></span></label>
              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4"><CarFront className="shrink-0 text-[#173553]" size={21}/><span className="flex-1"><span className="block text-xs text-slate-500">نوع السيارة</span><select name="vehicle_type" defaultValue="" className="w-full bg-transparent text-sm font-extrabold outline-none"><option value="">كل أنواع السيارات</option><option value="sedan">سيدان</option><option value="suv">SUV</option><option value="van">فان / ميكروباص</option><option value="bus">أتوبيس</option><option value="truck">نقل</option></select></span></label>
              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4"><CalendarDays className="shrink-0 text-[#173553]" size={21}/><span className="flex-1"><span className="block text-xs text-slate-500">مدة الإيجار</span><select name="duration" defaultValue="" className="w-full bg-transparent text-sm font-extrabold outline-none"><option value="">كل المدد</option><option value="monthly">شهري</option><option value="yearly">سنوي</option><option value="long-term">طويل الأجل</option></select></span></label>
            </div><button type="submit" className="mt-2 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#ffad0a] px-5 text-base font-black text-[#172d45] hover:bg-amber-300 sm:mt-3"><Search size={22}/> ابحث عن سيارة</button>
          </form>}
          <div className="mc-home-benefits mx-auto mt-9 grid max-w-6xl grid-cols-2 gap-3 text-center sm:mt-12 sm:grid-cols-4 sm:gap-4">{[{icon:Star,title:'خيارات متعددة',desc:'بأسعار تنافسية'},{icon:HandCoins,title:'شركاء معتمدون',desc:'ملاك وموردون موثوقون'},{icon:Headset,title:'دعم مستمر',desc:'على مدار الساعة'},{icon:ShieldCheck,title:'مصداقية وأمان',desc:'تعامل موثوق'}].map(({icon:Icon,title,desc})=><div key={title} className="flex flex-col items-center border-white/15 px-2 sm:border-l"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-[#ffad0a] ring-1 ring-white/10 sm:h-14 sm:w-14"><Icon size={25}/></span><strong className="mt-2 text-sm font-extrabold sm:text-base">{title}</strong><span className="mt-1 text-xs text-white/70 sm:text-sm">{desc}</span></div>)}</div>
        </div>
      </section>
      <section id="services" className="relative rounded-t-[2.5rem] bg-[#f7f9fc] px-4 pb-16 pt-12 sm:px-8 sm:pt-16"><div className="mx-auto max-w-7xl">
        <div className="text-right"><p className="font-extrabold text-[#f5a400]">منظومة واحدة لاحتياجات السيارات</p><h2 className="mt-2 text-3xl font-black text-[#102b47] sm:text-4xl">كل ما تحتاجه شركتك أو أسطولك في مكان واحد</h2><span className="mt-3 block h-1.5 w-20 rounded-full bg-[#ffad0a]"></span><p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">My Car عربيتي منصة متخصصة في ربط الشركات بملاك السيارات وموردي الأساطيل، وتنظيم رحلة البحث عن السيارات والتواصل وتبادل العروض، مع أدوات تساعد كل طرف على إدارة احتياجه بسهولة.</p></div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[{icon:Search,title:'كتالوج سيارات معتمد للشركات',desc:'استكشف السيارات المعتمدة وابحث حسب المحافظة ونوع السيارة ومدة الإيجار، من سيارة واحدة إلى احتياج أسطول.'},{icon:MessageCircle,title:'طلبات وعروض ومراسلات',desc:'أرسل طلبات التأجير واستقبل عروض الملاك وموردي الأساطيل، وتابع الردود والتحديثات من داخل المنصة.'},{icon:Building2,title:'تفويض My Car للبحث نيابةً عنك',desc:'فوّض فريق My Car للبحث عن السيارات المناسبة لاحتياج شركتك ومتابعة رحلة التجهيز معك.'},{icon:CarFront,title:'إدارة السيارات وتفاصيلها',desc:'أضف سياراتك وصورها وبياناتها، وتابع المراجعة والطلبات وتجديد البيانات مثل تاريخ انتهاء رخصة السيارة.'},{icon:UserRound,title:'بوابة الموظفين وطلبات السائقين',desc:'أنشئ حسابات مستقلة للموظفين، واستقبل طلبات تأجير شهرية بسيارة مع سائق وتابع العروض ومراجعة الطلب.'},{icon:Megaphone,title:'باقات إعلانية ودليل خدمات',desc:'زِد ظهور سياراتك أمام الشركات، واكتشف خدمات الصيانة والتأمين وقطع الغيار وخدمات الأساطيل.'}].map(({icon:Icon,title,desc})=><article key={title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg sm:p-6"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#eaf2ff] text-[#174a82] ring-1 ring-blue-100 transition group-hover:bg-[#102b47] group-hover:text-[#ffad0a]"><Icon size={24}/></span><h3 className="mt-4 text-lg font-black text-[#102b47]">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p></article>)}
        </div>

        <div className="mt-12 grid gap-6 rounded-3xl bg-[#102b47] p-6 text-white shadow-xl sm:p-9 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="text-right"><p className="font-extrabold text-[#ffad0a]">ابدأ بخطوات واضحة</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">من التسجيل إلى التواصل… رحلتك منظمة</h2><p className="mt-3 text-sm leading-8 text-white/75">أنشئ حسابك المناسب، أضف احتياجك أو سياراتك، ثم تابع الطلبات والعروض والمراسلات من مكان واحد.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">{[{n:'01',title:'أنشئ حسابك',desc:'اختر نوع الحساب المناسب لنشاطك.'},{n:'02',title:'أضف احتياجك',desc:'اطلب سيارات أو سجّل سياراتك وأساطيلك.'},{n:'03',title:'تابع وتواصل',desc:'استقبل العروض وتابع المحادثات والطلبات.'}].map(step=><div key={step.n} className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-right"><span className="text-sm font-black text-[#ffad0a]">{step.n}</span><h3 className="mt-2 font-extrabold">{step.title}</h3><p className="mt-1 text-xs leading-6 text-white/70">{step.desc}</p></div>)}</div>
        </div>

        <div className="mt-12 text-right"><p className="font-extrabold text-[#f5a400]">مصمم لكل طرف في سوق السيارات</p><h2 className="mt-2 text-3xl font-black text-[#102b47] sm:text-4xl">اختر حسابك وابدأ الاستفادة</h2><p className="mt-3 text-sm leading-7 text-slate-500">تجربة مناسبة لدورك، وأدوات تساعدك على الوصول لهدفك.</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[{icon:Building2,title:'للشركات',desc:'ابحث عن سيارات للإيجار الشهري أو السنوي أو طويل الأجل، استعرض الكتالوج، أرسل طلباتك وعروضك، أو فوّض My Car عربيتي في البحث نيابةً عنك.',href:'/register/company',cta:'أنشئ حساب شركتك'},{icon:CarFront,title:'لملاك السيارات',desc:'سجّل سياراتك، أضف الصور والتفاصيل، تابع حالة التسجيل والطلبات، وتعرّف على باقات الإعلان لزيادة ظهور سياراتك.',href:'/register/owner',cta:'سجّل كمالك سيارة'},{icon:BusFront,title:'لموردي الأساطيل',desc:'اعرض سيارات أسطولك أمام الشركات، ونظّم بيانات المركبات وتابع فرص التواصل والطلبات من حساب المورد.',href:'/register/supplier',cta:'سجّل كمورد أسطول'},{icon:UserRound,title:'للموظفين',desc:'أنشئ حسابًا مستقلًا واطلب سيارة شهرية بسائق، واستقبل عروضًا من ملاك السيارات وموردي الأساطيل وقارن بينها بسهولة.',href:'/register/employee',cta:'أنشئ حساب موظف'}].map(({icon:Icon,title,desc,href,cta})=><article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><Icon size={27} className="text-[#f5a400]"/><h3 className="mt-3 text-xl font-black text-[#102b47]">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p><a href={href} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#102b47] px-4 font-extrabold text-white transition hover:bg-[#174a82]">{cta}<ArrowLeft size={16}/></a></article>)}
        </div>

        <div className="mt-10 grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"><div className="text-right"><h3 className="text-lg font-black text-[#102b47]">وكمان تقدر تستكشف خدمات السيارات</h3><p className="mt-1 text-sm leading-7 text-slate-600">تعرّف على خدمات الصيانة والتأمين وقطع الغيار وخدمات الأساطيل، واقترح مقدم خدمة لإضافته بعد مراجعة بياناته.</p></div><a href="/services" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#173553] px-4 font-extrabold text-[#173553] hover:bg-white">استكشف خدمات السيارات<ArrowLeft size={16}/></a></div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-right"><p className="text-sm leading-7 text-slate-700"><strong className="text-[#102b47]">وضوح وثقة في التعامل:</strong> My Car منصة وسيطة للتواصل وتنظيم الطلبات والعروض بين الشركات وملاك السيارات وموردي الأساطيل. لا تتولى المنصة تحصيل قيمة الإيجار أو إدارة المدفوعات بين أطراف التعاقد، ولا تضمن تشغيل السيارة أو تنفيذ الاتفاق؛ وتظل شروط التعاقد والتنفيذ مسؤولية الأطراف المعنية.</p></div>

        {!authUser && settings.registration_enabled && <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-l from-[#102b47] to-[#174a82] p-6 text-white shadow-xl sm:flex-row sm:items-center sm:p-9"><div><p className="font-extrabold text-[#ffad0a]">خطوتك الأولى تبدأ هنا</p><h3 className="mt-2 text-2xl font-black">جاهز تلاقي السيارة المناسبة أو تعرض سياراتك؟</h3><p className="mt-2 text-sm leading-7 text-white/75">أنشئ حسابك مجانًا وابدأ استكشاف تجربة My Car عربيتي.</p></div><a href="/register" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ffad0a] px-6 font-black text-[#102b47] shadow-lg hover:bg-amber-300">إنشاء حساب جديد<UserRoundPlus size={18}/></a></div>}
      </div></section>
      <footer className="bg-[#071b31] px-5 py-7 text-sm text-white/70 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>© {new Date().getFullYear()} {settings.platform_name}. {settings.footer_text}</div><div className="flex flex-wrap items-center gap-4"><a href="/services" className="hover:text-[#ffad0a]">خدمات السيارات</a><a href="/privacy" className="hover:text-[#ffad0a]">سياسة الخصوصية</a><a href="/terms" className="hover:text-[#ffad0a]">شروط الاستخدام</a>{settings.support_email&&<a href={'mailto:'+settings.support_email}>{settings.support_email}</a>}{settings.support_phone&&<a href={'tel:'+settings.support_phone}>{settings.support_phone}</a>}</div></div></footer>
      {authOpen&&<AuthPanel onClose={()=>setAuthOpen(false)} initialMode={authMode}/>}
    </main>
  )
}
