import type { ReactNode } from 'react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import SupplierNavigation from './SupplierNavigation'

export default function SupplierPageShell({ children }: { children: ReactNode }) {
  return <div dir="rtl" className="mc-supplier-page-shell">
    <div className="mc-supplier-sticky-chrome">
      <header className="mc-supplier-topbar">
        <a href="/workspace/supplier/vehicles" aria-label="My Car عربيتي" className="mc-supplier-brand"><PlatformBrand compact/></a>
        <div className="mc-workspace-header-actions">
          <AccountNotifications/>
        </div>
      </header>
      <SupplierNavigation/>
    </div>
    <div className="mc-supplier-page-content">{children}</div>
  </div>
}
