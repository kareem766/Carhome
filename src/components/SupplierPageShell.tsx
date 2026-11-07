import { ArrowLeft, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import SupplierNavigation from './SupplierNavigation'

export default function SupplierPageShell({ children }: { children: ReactNode }) {
  function goBack() {
    const fallback = '/workspace/supplier/vehicles'
    if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) window.history.back()
    else window.location.assign(fallback)
  }
  return <div dir="rtl" className="mc-supplier-page-shell">
    <header className="mc-supplier-topbar">
      <a href="/workspace/supplier/vehicles" aria-label="My Car عربيتي" className="mc-supplier-brand"><PlatformBrand compact/></a>
      <div className="mc-workspace-header-actions">
        <a href="/messages" aria-label="المحادثات" title="المحادثات" className="mc-top-icon"><MessageCircle size={19}/></a>
        <AccountNotifications/>
      </div>
    </header>
    <SupplierNavigation/>
    <div className="mc-supplier-page-back"><button type="button" onClick={goBack}><ArrowLeft size={17}/> رجوع</button></div>
    <div className="mc-supplier-page-content">{children}</div>
  </div>
}
