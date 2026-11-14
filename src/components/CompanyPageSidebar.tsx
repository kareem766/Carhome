import { Bot, Building2, CarFront, ClipboardList, FileText, LogOut, Megaphone, MessageCircle, Plus, Search, UserRound, Users, Wrench, CreditCard, BellRing } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

type Section = 'team' | 'insights' | 'managed-sourcing' | 'subscriptions' | 'alerts'

const links = [
  { id: 'assistant', href: '/assistant', label: 'مساعد My Car', icon: Bot },
  { id: 'overview', href: '/workspace/company', label: 'الرئيسية', icon: Building2 },
  { id: 'team', href: '/workspace/company/team', label: 'إدارة موظفي الشركة', icon: Users },
  { id: 'subscriptions', href: '/workspace/subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { id: 'alerts', href: '/workspace/company/alerts', label: 'التنبيهات الذكية', icon: BellRing },
  { id: 'insights', href: '/workspace/company/insights', label: 'المؤشرات والتقارير', icon: FileText },
  { id: 'requests', href: '/workspace/company/requests', label: 'طلبات التأجير', icon: ClipboardList },
  { id: 'new-request', href: '/workspace/company/requests/new', label: 'طلب جديد', icon: Plus },
  { id: 'managed-sourcing', href: '/workspace/company/managed-sourcing', label: 'فوّض My Car للبحث', icon: Search },
  { id: 'catalog', href: '/workspace/catalog', label: 'السيارات المتاحة', icon: CarFront },
  { id: 'services', href: '/services', label: 'خدمات السيارات', icon: Wrench },
  { id: 'messages', href: '/messages', label: 'المحادثات', icon: MessageCircle },
  { id: 'ads', href: '/workspace/advertising-plans', label: 'باقات الإعلانات', icon: Megaphone },
  { id: 'account', href: '/workspace/company/account', label: 'الحساب', icon: UserRound },
]

export default function CompanyPageSidebar({ active }: { active: Section }) {
  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  const currentPath = window.location.pathname
  return <aside dir="rtl" className="mc-workspace-sidebar mc-company-shared-sidebar" aria-label="قائمة مساحة العمل">
    <div className="mc-sidebar-brand">
      <PlatformBrand compact />
      <span className="mc-sidebar-tag">مساحة العمل</span>
    </div>
    <nav aria-label="التنقل داخل مساحة العمل" className="mc-sidebar-nav">
      {links.map(({ id, href, label, icon: Icon }) => {
        const selected = id === active || currentPath === href
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
    <div className="mc-sidebar-promo">
      <CarFront size={27} />
      <strong>كل خدمات السيارات في مكان واحد</strong>
      <p>إدارة أسهل وفرص تشغيل أكثر مع My Car.</p>
      <a href="/workspace/catalog">استكشف الكتالوج ←</a>
    </div>
  </aside>
}
