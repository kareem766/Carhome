import { ArrowLeft, Bell, Bot, Building2, CarFront, ClipboardList, FileText, Home, LogOut, MessageCircle, Plus, Search, UserRound, Users, Wrench, CreditCard, BellRing } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

type Section = 'overview' | 'assistant' | 'team' | 'insights' | 'managed-sourcing' | 'subscriptions' | 'alerts' | 'notifications' | 'requests' | 'new-request' | 'catalog' | 'services' | 'messages' | 'account'

const links = [
  { id: 'overview', href: '/workspace/company', label: 'الرئيسية', icon: Building2 },
  { id: 'new-request', href: '/workspace/company/requests/new', label: 'طلب جديد', icon: Plus },
  { id: 'requests', href: '/workspace/company/requests', label: 'طلبات التأجير', icon: ClipboardList },
  { id: 'catalog', href: '/workspace/catalog', label: 'السيارات المتاحة', icon: CarFront },
  { id: 'managed-sourcing', href: '/workspace/company/managed-sourcing', label: 'فوّض My Car للبحث', icon: Search },
  { id: 'team', href: '/workspace/company/team', label: 'إدارة موظفي الشركة', icon: Users },
  { id: 'subscriptions', href: '/workspace/company/subscriptions', label: 'اشتراك الشركة والباقات', icon: CreditCard },
  { id: 'alerts', href: '/workspace/company/alerts', label: 'التنبيهات الذكية', icon: BellRing },
  { id: 'insights', href: '/workspace/company/insights', label: 'المؤشرات والتقارير', icon: FileText },
  { id: 'messages', href: '/messages', label: 'المحادثات', icon: MessageCircle },
  { id: 'assistant', href: '/assistant', label: 'مساعد My Car', icon: Bot },
  { id: 'services', href: '/services', label: 'خدمات السيارات', icon: Wrench },
  { id: 'account', href: '/workspace/company/account', label: 'بيانات الشركة', icon: UserRound },
  { id: 'notifications', href: '/workspace/notifications', label: 'إعدادات الإشعارات', icon: Bell },
]

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/workspace/company/team': { title: 'إدارة فريق الشركة', subtitle: 'إدارة أعضاء الشركة وصلاحيات الوصول' },
  '/workspace/company/subscriptions': { title: 'اشتراك الشركة والباقات', subtitle: 'الباقات، الفوترة، وطلبات تفعيل الاشتراك' },
  '/workspace/company/alerts': { title: 'التنبيهات الذكية', subtitle: 'تابع السيارات التي تطابق احتياجات شركتك' },
  '/workspace/company/managed-sourcing': { title: 'تفويض البحث عن السيارات', subtitle: 'تابع طلبات البحث والعروض المقدمة لشركتك' },
  '/workspace/company/account': { title: 'بيانات الشركة', subtitle: 'راجع بيانات شركتك ومعلومات الحساب' },
  '/workspace/notifications': { title: 'إعدادات الإشعارات', subtitle: 'تحكم في تنبيهات وتحديثات حساب الشركة' },
}

export default function CompanyPageSidebar({ active }: { active: Section }) {
  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  const currentPath = window.location.pathname
  const exactMatch = links.find(link => link.href === currentPath)
  const meta = pageMeta[currentPath]
  const showGlobalTopbar = Boolean(meta)
  const renderMobileLink = ({ id, href, label, icon: Icon }: typeof links[number]) => {
    const selected = exactMatch ? id === exactMatch.id : id === active
    return <a key={id} href={href} aria-current={selected ? 'page' : undefined} className={'mc-company-mobile-link ' + (selected ? 'is-active' : '')}>
      <Icon size={17} />
      <span>{label}</span>
    </a>
  }
  const primaryMobileLinks = links.filter(link => ['overview', 'new-request', 'requests', 'catalog', 'messages'].includes(link.id))
  const secondaryMobileLinks = links.filter(link => !['overview', 'new-request', 'requests', 'catalog', 'messages'].includes(link.id))

  return <>
    <aside dir="rtl" className="mc-workspace-sidebar mc-company-shared-sidebar" aria-label="قائمة مساحة العمل">
      <div className="mc-sidebar-brand">
        <PlatformBrand compact />
        <span className="mc-sidebar-tag">مساحة الشركة</span>
      </div>
      <nav aria-label="التنقل داخل مساحة العمل" className="mc-sidebar-nav">
        <span className="mc-sidebar-section-label">إدارة الشركة</span>
        {links.slice(0, 5).map(({ id, href, label, icon: Icon }) => {
          const selected = exactMatch ? id === exactMatch.id : id === active
          return <a key={id} href={href} aria-current={selected ? 'page' : undefined} className={'mc-sidebar-link ' + (selected ? 'is-active' : '')}>
            <Icon size={19} /><span>{label}</span>
          </a>
        })}
        <span className="mc-sidebar-section-label mc-sidebar-section-label--spaced">الخدمات والتقارير</span>
        {links.slice(5).map(({ id, href, label, icon: Icon }) => {
          const selected = exactMatch ? id === exactMatch.id : id === active
          return <a key={id} href={href} aria-current={selected ? 'page' : undefined} className={'mc-sidebar-link ' + (selected ? 'is-active' : '')}>
            <Icon size={19} /><span>{label}</span>
          </a>
        })}
        <div className="mc-sidebar-divider" />
        <button type="button" onClick={() => void signOut()} className="mc-sidebar-link mc-sidebar-logout">
          <LogOut size={19} /><span>تسجيل الخروج</span>
        </button>
      </nav>
      <div className="mc-sidebar-promo">
        <CarFront size={27} />
        <strong>كل خدمات السيارات في مكان واحد</strong>
        <p>إدارة أسهل وفرص تشغيل أكثر مع My Car.</p>
        <a href="/workspace/catalog">استكشف الكتالوج ←</a>
      </div>
    </aside>
    {showGlobalTopbar && <header dir="rtl" className="mc-company-global-topbar">
      <div className="mc-company-global-heading">
        <span>MY CAR · مساحة الشركة</span>
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
      </div>
      <div className="mc-company-global-actions">
        <a href="/workspace/company" aria-label="لوحة الشركة" title="لوحة الشركة"><Home size={17}/><span>لوحة الشركة</span></a>
        <a href="/messages" aria-label="المحادثات" title="المحادثات"><MessageCircle size={17}/><span>المحادثات</span></a>
        <a href="/workspace/notifications" aria-label="الإشعارات" title="الإشعارات"><Bell size={17}/><span>الإشعارات</span></a>
        <a href="/workspace/company" className="mc-company-global-back"><ArrowLeft size={16}/><span>الرئيسية</span></a>
      </div>
    </header>}
    <nav dir="rtl" aria-label="التنقل داخل مساحة الشركة" className={'mc-company-mobile-nav' + (showGlobalTopbar ? ' mc-company-mobile-nav--with-topbar' : '')}>
      {primaryMobileLinks.map(renderMobileLink)}
      <details className="mc-company-mobile-more">
        <summary aria-label="المزيد من صفحات الشركة"><span>المزيد</span></summary>
        <div className="mc-company-mobile-more-menu">{secondaryMobileLinks.map(renderMobileLink)}</div>
      </details>
    </nav>
  </>
}
