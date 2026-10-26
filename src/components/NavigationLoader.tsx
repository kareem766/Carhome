import { useEffect, useState } from 'react'

/**
 * Lightweight transition feedback for same-origin page navigation.
 * The app currently uses pathname-based route selection, so native navigation
 * remains intact; this overlay simply prevents an abrupt blank/loading flash.
 */
export default function NavigationLoader() {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (anchor.origin !== window.location.origin) return
      const next = new URL(anchor.href, window.location.href)
      if (next.pathname === window.location.pathname && next.search === window.location.search && next.hash) return
      if (next.pathname === window.location.pathname && next.search === window.location.search) return
      setPending(true)
    }
    const onPageShow = () => setPending(false)
    const onBeforeUnload = () => setPending(true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPageShow)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPageShow)
    }
  }, [])

  if (!pending) return null
  return (
    <div className="mc-route-loading-overlay" role="status" aria-label="جارٍ تحميل المنصة" aria-live="polite">
      <img src="/carhome-icon.svg" alt="" className="mc-route-loading-logo" />
      <span className="sr-only">جارٍ تحميل المنصة</span>
    </div>
  )
}
