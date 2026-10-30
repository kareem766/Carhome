import { useEffect, useState } from 'react'
import { Building2, ShieldCheck } from 'lucide-react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

type Partner = { name: string; logo_url: string; website_url?: string }

export default function PartnerLogoTicker() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [duration, setDuration] = useState(28)
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) return
      const { data } = await supabase.from('public_platform_settings').select('partner_logos,partner_ticker_seconds').eq('id', true).maybeSingle()
      if (!active || !data) return
      const rows = Array.isArray(data.partner_logos) ? data.partner_logos : []
      setPartners(rows.filter((p: Partner) => p && typeof p.name === 'string' && typeof p.logo_url === 'string' && /^https:\/\//i.test(p.logo_url)))
      const seconds = Number(data.partner_ticker_seconds)
      setDuration(Number.isFinite(seconds) ? Math.min(90, Math.max(12, seconds)) : 28)
    }
    void load()
    window.addEventListener('platform-settings-updated', load)
    return () => { active = false; window.removeEventListener('platform-settings-updated', load) }
  }, [])
  if (!partners.length) return null
  const items = [...partners, ...partners]
  return <section aria-label="الشركات الشريكة" className="overflow-hidden border-y border-slate-200/80 bg-white py-8 sm:py-10">
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="mb-6 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-right">
        <div><p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide text-blue-700"><ShieldCheck size={15}/> شبكة شركائنا</p><h2 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">شركات تثق في My Car</h2><p className="mt-2 text-sm leading-6 text-slate-500">شعارات شركائنا من الشركات المسجلة على المنصة.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><Building2 size={15}/> شركاء المنصة</span>
      </div>
      <div className="partner-ticker group relative" dir="ltr" style={{'--ticker-duration': duration+'s'} as CSSProperties}>
        <div className="partner-ticker-track group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {items.map((partner, index) => <div key={partner.name+'-'+index} className="flex h-24 min-w-40 items-center justify-center rounded-2xl border border-slate-100 bg-white px-6 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:min-w-48">
            {partner.website_url ? <a href={partner.website_url} target="_blank" rel="noreferrer" aria-label={partner.name} className="flex h-full w-full items-center justify-center"><img src={partner.logo_url} alt={partner.name} loading="lazy" className="max-h-14 max-w-36 object-contain sm:max-w-40"/></a> : <img src={partner.logo_url} alt={partner.name} loading="lazy" className="max-h-14 max-w-36 object-contain sm:max-w-40"/>}
          </div>)}
        </div>
      </div>
    </div>
    <style>{`@keyframes partnerTickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } } .partner-ticker { overflow: hidden; mask-image: linear-gradient(to right, transparent, black 7%, black 93%, transparent); } .partner-ticker-track { display:flex; width:max-content; gap:1rem; animation: partnerTickerScroll var(--ticker-duration, 28s) linear infinite; } @media (prefers-reduced-motion: reduce) { .partner-ticker-track { animation:none; flex-wrap:wrap; width:100%; justify-content:center; } }`}</style>
  </section>
}
