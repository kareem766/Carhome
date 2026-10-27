import { useEffect, useState } from 'react'

export default function ConnectivityStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [showRestored, setShowRestored] = useState(false)

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | undefined

    const onOffline = () => {
      if (restoredTimer) clearTimeout(restoredTimer)
      setShowRestored(false)
      setOnline(false)
    }
    const onOnline = () => {
      setOnline(true)
      setShowRestored(true)
      if (restoredTimer) clearTimeout(restoredTimer)
      restoredTimer = setTimeout(() => setShowRestored(false), 3500)
    }

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      if (restoredTimer) clearTimeout(restoredTimer)
    }
  }, [])

  if (online && !showRestored) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-xl items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-lg backdrop-blur-md sm:inset-x-auto sm:min-w-[360px] ${online ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800' : 'border-amber-300 bg-amber-50/95 text-amber-900'}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`} aria-hidden="true" />
      {online ? 'عاد الاتصال بالإنترنت' : 'الاتصال بالإنترنت غير متاح — قد لا تُحفظ التغييرات حتى يعود الاتصال'}
    </div>
  )
}
