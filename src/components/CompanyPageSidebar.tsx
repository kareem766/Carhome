import { BarChart3, Building2, LayoutDashboard, Search, Users } from 'lucide-react'
import PlatformBrand from './PlatformBrand'

type Section = 'team' | 'insights' | 'managed-sourcing'

const links = [
  { id: 'overview', href: '/workspace/company', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'team', href: '/workspace/company/team', label: 'إدارة موظفي الشركة', icon: Users },
  { id: 'insights', href: '/workspace/company/insights', label: 'المؤشرات والتقارير', icon: BarChart3 },
  { id: 'managed-sourcing', href: '/workspace/company/managed-sourcing', label: 'فوّض My Car للبحث', icon: Search },
  { id: 'catalog', href: '/workspace/catalog', label: 'كتالوج السيارات', icon: Building2 },
]

export default function CompanyPageSidebar({ active }: { active: Section }) {
  return <aside dir="rtl" className="mc-company-sidebar" aria-label="قائمة مساحة الشركة">
    <a href="/workspace/company" className="mc-company-sidebar-brand">
      <span className="mc-company-sidebar-logo"><PlatformBrand compact /></span>
      <span className="mc-company-sidebar-brand-copy"><strong>مساحة الشركة</strong><small>إدارة ومتابعة أعمالك</small></span>
    </a>
    <div className="mc-company-sidebar-divider" />
    <p className="mc-company-sidebar-label">القائمة الرئيسية</p>
    <nav className="mc-company-sidebar-nav">
      {links.map(link => {
        const Icon = link.icon
        const selected = link.id === active || (link.id === 'overview' && active === 'team' && window.location.pathname === '/workspace/company')
        return <a key={link.id} href={link.href} aria-current={selected ? 'page' : undefined} className={'mc-company-sidebar-link' + (selected ? ' is-active' : '')}>
          <Icon size={19} strokeWidth={2.1} />
          <span>{link.label}</span>
        </a>
      })}
    </nav>
    <div className="mc-company-sidebar-footer">
      <span className="mc-company-sidebar-footer-mark">MC</span>
      <span><strong>My Car عربيتي</strong><small>منصة السيارات للشركات والأساطيل</small></span>
    </div>
  </aside>
}
