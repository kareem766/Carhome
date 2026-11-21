import { Bot, Building2, CarFront, ClipboardList, FileText, LogOut, MessageCircle, Plus, Search, UserRound, Users, Wrench, CreditCard, BellRing, Bell } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

type Section = 'overview' | 'assistant' | 'team' | 'insights' | 'managed-sourcing' | 'subscriptions' | 'alerts' | 'notifications' | 'requests' | 'new-request' | 'catalog' | 'services' | 'messages' | 'account'

const links = [
  { id: 'assistant', href: '/assistant', label: 'مساعد My Car', icon: Bot },
  { id: 'overview', href: '/workspace/company', label: 'الرئيسية', icon: Building2 },
  { id: 'team', href: '/workspace/company/team', label: 'إدارة موظفي الشركة', icon: Users },
  { id: 'subscriptions', href: '/workspace/company/subscriptions', label: 'اشتراك الشركة والباقات', icon: CreditCard },
  { id: 'alerts', href: '/workspace/company/alerts', label: 'التنبيهات الذكية', icon: BellRing },
  { id: 'insights', href: '/workspace/company/insights', label: 'المؤشرات والتقارير', icon: FileText },
  { id: 'requests', href: '/workspace/company/requests', label: 'طلبات التأجير', icon: ClipboardList },
  { id: 'new-request', href: '/workspace/company/requests/new', label: 'طلب جديد', icon: Plus },
  { id: 'managed-sourcing', href: '/workspace/company/managed-sourcing', label: 'فوّض My Car للبحث', icon: Search },
  { id: 'catalog', href: '/workspace/catalog', label: 'السيارات المتاحة', icon: CarFront },
  { id: 'services', href: '/services', label: 'خدمات السيارات', icon: Wrench },
  { id: 'messages', href: '/messages', label: 'المحادثات', icon: MessageCircle },
  { id: 'account', href: '/workspace/company/account', label: 'الحساب', icon: UserRound },
  { id: 'notifications', href: '/workspace/notifications', label: 'إعدادات الإشعارات', icon: Bell },
]

export default function CompanyPageSidebar({ active, employeeView = false }: { active: Section; employeeView?: boolean }) {
  const visibleLinks = employeeView ? links.filter(link => ['assistant', 'overview', 'requests', 'new-request', 'catalog', 'services', 'messages', 'notifications'].includes(link.id)) : links
  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  const currentPath = window.location.pathname
  const exactMatch = visibleLinks.find(link => link.href === currentPath)
  const renderMobileLink = ({ id, href, label, icon: Icon }: typeof links[number]) => {
    const selected = exactMatch ? id === exactMatch.id : id === active
    return <a key={id} href={href} aria-current={selected ? 'page' : undefined} className={'mc-company-mobile-link ' + (selected ? 'is-active' : '')}>
      <Icon size={17} />
      <span>{label}</span>
    </a>
  }
  const primaryMobileLinks = visibleLinks.filter(link => ['overview', 'requests', 'new-request', 'catalog', 'messages'].includes(link.id))
  const secondaryMobileLinks = visibleLinks.filter(link => !['overview', 'requests', 'new-request', 'catalog', 'messages'].includes(link.id))
  return <>
    <aside dir="rtl" className="mc-workspace-sidebar mc-company-shared-sidebar" aria-label="قائمة مساحة العمل">
      <div className="mc-sidebar-brand">
        <PlatformBrand compact />
        <span className="mc-sidebar-tag">مساحة العمل</span>
      </div>
      <nav aria-label="التنقل داخل مساحة العمل" className="mc-sidebar-nav">
        {visibleLinks.map(({ id, href, label, icon: Icon }) => {
          const selected = exactMatch ? id === exactMatch.id : id === active
          return <a key={id} href={href} aria-current={selected ? 'page' : undefined} className={'mc-sidebar-link ' + (selected ? 'is-active' : '')}>
            <Icon size={19} />
            <span>{label}</span>
          </a>
        })}
        <div className="mc-sidebar-divider" />
        <button type="button" onClick={() => void signOut()} className="mc-sidebar-link mc-sidebar-logout">
          <LogOut size={19} />
          <span>تسجيل الخروج</span>
        </button>
      </nav>
      {!employeeView && <div className="mc-sidebar-promo">
        <CarFront size={27} />
        <strong>كل خدمات السيارات في مكان واحد</strong>
        <p>إدارة أسهل وفرص تشغيل أكثر مع My Car.</p>
        <a href="/workspace/catalog">استكشف الكتالوج ←</a>
      </div>}
    </aside>
    <nav dir="rtl" aria-label="التنقل داخل مساحة الشركة" className="mc-company-mobile-nav">
      {primaryMobileLinks.map(renderMobileLink)}
      <details className="mc-company-mobile-more">
        <summary aria-label="المزيد من صفحات الشركة"><span>المزيد</span></summary>
        <div className="mc-company-mobile-more-menu">
          {secondaryMobileLinks.map(renderMobileLink)}
        </div>
      </details>
    </nav>
  </>
}
