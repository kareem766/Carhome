import { LayoutDashboard, Palette, CreditCard, Megaphone } from 'lucide-react'

const links = [
  { href: '/workspace/admin', label: 'مركز الإدارة', icon: LayoutDashboard },
  { href: '/workspace/admin/platform-settings', label: 'هوية المنصة', icon: Palette },
  { href: '/workspace/admin/subscription-plans', label: 'اشتراكات الشركات', icon: CreditCard },
  { href: '/workspace/admin/advertising-plans', label: 'باقات الإعلانات', icon: Megaphone }
]

export default function AdminPageNavigation() {
  const path = window.location.pathname
  return <nav aria-label="التنقل بين أقسام الإدارة" className="mc-admin-section-nav mt-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-sm backdrop-blur">
    {links.map(({ href, label, icon: Icon }) => <a key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${path === href ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'}`}>
      <Icon size={16} />{label}
    </a>)}
  </nav>
}
