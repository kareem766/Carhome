import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Banner = { id: string; title: string; body: string; image_url: string | null; button_label: string | null; button_url: string | null; duration_seconds: number; starts_at: string | null; ends_at: string | null }

export default function PlatformEntryBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let alive = true
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      if (!supabase || window.location.pathname.startsWith('/workspace/admin')) return
      try {
        if (window.sessionStorage.getItem('mycar-entry-banner-shown') === '1') return
        const { data, error } = await supabase.from('platform_banners')
          .select('id,title,body,image_url,button_label,button_url,duration_seconds,starts_at,ends_at')
          .eq('enabled', true).order('display_order', { ascending: true })
        if (error || !data?.length || !alive) return
        const now = Date.now()
        const scheduled = (data as Banner[]).find(item => {
          const starts = item.starts_at ? new Date(item.starts_at).getTime() : Number.NEGATIVE_INFINITY
          const ends = item.ends_at ? new Date(item.ends_at).getTime() : Number.POSITIVE_INFINITY
          const hasContent = Boolean(item.title?.trim() || item.body?.trim())
          return hasContent && starts <= now && ends > now
        })
        if (!scheduled) return
        const activeBanner = scheduled
        setBanner(activeBanner)
        setVisible(true)
        window.sessionStorage.setItem('mycar-entry-banner-shown', '1')
        closeTimer = setTimeout(() => { if (alive) setVisible(false) }, Math.max(1, Math.min(30, activeBanner.duration_seconds || 5)) * 1000)
      } catch {
        // Banner is optional: never block the main platform when storage or the banner table is unavailable.
      }
    }
    void load()
    return () => { alive = false; if (closeTimer) clearTimeout(closeTimer) }
  }, [])

  if (!visible || !banner) return null
  return <div className="mc-banner-backdrop" dir="rtl" role="dialog" aria-modal="true" aria-label="إعلان المنصة">
    <section className="mc-entry-banner">
      <button type="button" className="mc-banner-close" aria-label="إغلاق الإعلان" onClick={() => setVisible(false)}><X size={19}/></button>
      {banner.image_url && <img src={banner.image_url} alt="" className="mc-entry-banner-image" onError={event => { event.currentTarget.style.display = 'none' }}/>}
      <div className="mc-entry-banner-copy">
        <span className="text-xs font-black uppercase tracking-widest text-blue-600">إعلان من المنصة</span>
        {banner.title && <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{banner.title}</h2>}
        {banner.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">{banner.body}</p>}
        {banner.button_label && banner.button_url && <a href={banner.button_url} className="mc-neon-button mc-neon-primary mt-5 w-fit">{banner.button_label}<ExternalLink size={16}/></a>}
      </div>
      <div className="mc-banner-progress" style={{ animationDuration: `${Math.max(1, Math.min(30, banner.duration_seconds || 5))}s` }}/>
    </section>
  </div>
}
