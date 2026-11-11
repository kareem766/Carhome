import { BarChart3, Bell, Building2, CarFront, ClipboardList, FileText, LayoutGrid, Megaphone, MessageCircle, Wrench } from 'lucide-react'

const links = [
  { href: '/workspace/supplier/vehicles', label: 'أسطولي', icon: CarFront, match: (path: string) => path.startsWith('/workspace/supplier/vehicles') || path === '/workspace/supplier' },
  { href: '/workspace/supplier/requests', label: 'طلبات الشركات', icon: Building2, match: (path: string) => path.startsWith('/workspace/supplier/requests') },
  { href: '/workspace/provider-employee-requests', label: 'طلبات الموظفين', icon: ClipboardList, match: (path: string) => path === '/workspace/provider-employee-requests' || path === '/workspace/supplier/employee-requests' },
  { href: '/workspace/supplier/offers', label: 'عروضي', icon: FileText, match: (path: string) => path.startsWith('/workspace/supplier/offers') },
  { href: '/workspace/supplier/insights', label: 'تقارير الأسطول', icon: BarChart3, match: (path: string) => path.startsWith('/workspace/supplier/insights') },
  { href: '/workspace/catalog', label: 'كتالوج السيارات', icon: LayoutGrid, match: (path: string) => path.startsWith('/workspace/catalog') },
  { href: '/workspace/advertising-plans', label: 'الإعلانات', icon: Megaphone, match: (path: string) => path.startsWith('/workspace/advertising-plans') },
  { href: '/messages', label: 'المحادثات', icon: MessageCircle, match: (path: string) => path.startsWith('/messages') },
  { href: '/services', label: 'خدمات السيارات', icon: Wrench, match: (path: string) => path === '/services' || path === '/automotive-services' },
  { href: '/workspace/notifications', label: 'إعدادات الإشعارات', icon: Bell, match: (path: string) => path === '/workspace/notifications' },
]

export default function SupplierNavigation() {
  const path = window.location.pathname
  return <nav dir="rtl" aria-label="التنقل بين صفحات مورد الأسطول" className="mc-supplier-navigation">
    <div className="mc-supplier-navigation-inner">
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = match(path)
        return <a key={href} href={href} aria-current={active ? 'page' : undefined} className={`mc-supplier-navigation-link ${active ? 'is-active' : ''}`}>
          <Icon size={18} strokeWidth={2}/>
          <span>{label}</span>
        </a>
      })}
    </div>
  </nav>
}
