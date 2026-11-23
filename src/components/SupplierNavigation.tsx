const links = [
  { href: '/assistant', label: 'مساعد My Car', match: (path: string) => path === '/assistant' },
  { href: '/workspace/supplier/vehicles', label: 'أسطولي', match: (path: string) => (path.startsWith('/workspace/supplier/vehicles') && path !== '/workspace/supplier/vehicles/new') || path === '/workspace/supplier' },
  { href: '/workspace/supplier/vehicles/new', label: 'إضافة سيارة', match: (path: string) => path === '/workspace/supplier/vehicles/new' },
  { href: '/workspace/supplier/requests', label: 'طلبات الشركات', match: (path: string) => path.startsWith('/workspace/supplier/requests') },
  { href: '/workspace/provider-employee-requests', label: 'طلبات الموظفين', match: (path: string) => path === '/workspace/provider-employee-requests' || path === '/workspace/supplier/employee-requests' },
  { href: '/workspace/supplier/offers', label: 'عروضي', match: (path: string) => path.startsWith('/workspace/supplier/offers') },
  { href: '/workspace/provider/managed-sourcing', label: 'تفويضات البحث', match: (path: string) => path === '/workspace/provider/managed-sourcing' },
  { href: '/workspace/supplier/insights', label: 'تقارير الأسطول', match: (path: string) => path.startsWith('/workspace/supplier/insights') },
  { href: '/workspace/catalog', label: 'كتالوج السيارات', match: (path: string) => path.startsWith('/workspace/catalog') },
  { href: '/workspace/advertising-plans', label: 'الإعلانات', match: (path: string) => path.startsWith('/workspace/advertising-plans') },
  { href: '/messages', label: 'المحادثات', match: (path: string) => path.startsWith('/messages') },
  { href: '/services', label: 'خدمات السيارات', match: (path: string) => path === '/services' || path === '/automotive-services' },
  { href: '/workspace/notifications', label: 'إعدادات الإشعارات', match: (path: string) => path === '/workspace/notifications' },
  { href: '/workspace/supplier/account', label: 'الحساب', match: (path: string) => path === '/workspace/supplier/account' },
]

export default function SupplierNavigation() {
  const path = window.location.pathname
  return <nav dir="rtl" aria-label="التنقل بين صفحات مورد الأسطول" className="mc-platform-page-nav mc-platform-page-nav--supplier">
      {links.map(({ href, label, match }) => {
        const active = match(path)
        return <a key={href} href={href} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : ''}>{label}</a>
      })}
  </nav>
}
