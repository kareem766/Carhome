import { useEffect, useState } from 'react'
import PlatformLoadingScreen from './PlatformLoadingScreen'

/** Shared branded loading feedback for same-origin document navigation. */
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
      if (anchor.hasAttribute('data-no-navigation-loader') || anchor.getAttribute('role') === 'tab') return
      const next = new URL(anchor.href, window.location.href)
      if (next.pathname === window.location.pathname && next.search === window.location.search) return
      setPending(true)
    }
    const onPageShow = () => setPending(false)
    const onBeforeUnload = () => setPending(true)
    document.addEventListener('click', onClick)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPageShow)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPageShow)
    }
  }, [])

  if (!pending) return null
  return (
    <div className="mc-navigation-loading-backdrop" aria-hidden="false">
      <PlatformLoadingScreen fullscreen />
    </div>
  )
}
