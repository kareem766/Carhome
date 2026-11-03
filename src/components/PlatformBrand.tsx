import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Brand = { platform_name: string; tagline: string; logo_url: string | null }
const fallback: Brand = { platform_name: 'My Car عربيتي', tagline: 'منصة السيارات للشركات والأساطيل في مصر', logo_url: 'https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png' }

export default function PlatformBrand({ compact = false }: { compact?: boolean }) {
  const [brand, setBrand] = useState<Brand>(fallback)
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) return
      const { data } = await supabase.from('public_platform_settings').select('platform_name,tagline,logo_url').eq('id', true).maybeSingle()
      if (active && data) setBrand({ ...fallback, ...data, platform_name: ['Carhome', 'My Car'].includes(data.platform_name) ? fallback.platform_name : (data.platform_name || fallback.platform_name), tagline: data.tagline === 'تأجير السيارات للشركات' ? fallback.tagline : (data.tagline || fallback.tagline) } as Brand)
    }
    void load()
    window.addEventListener('platform-settings-updated', load)
    return () => { active = false; window.removeEventListener('platform-settings-updated', load) }
  }, [])
  const wordmark = <span className="inline-flex flex-wrap items-baseline gap-x-2" dir="ltr"><span className="font-black tracking-tight text-[#123456]">My Car</span><span dir="rtl" className="font-black tracking-tight text-cyan-600">عربيتي</span></span>
  if (compact) return <span className="inline-flex items-center gap-2 text-sm">
    <img src={brand.logo_url || fallback.logo_url || ''} alt="" className="h-7 w-7 rounded object-contain" onError={event => { event.currentTarget.style.display = 'none' }}/>
    {wordmark}
  </span>
  return <span className="inline-flex items-center gap-3">
    <img src={brand.logo_url || fallback.logo_url || ''} alt={brand.platform_name} className="h-11 w-11 rounded-lg object-contain" onError={event => { event.currentTarget.style.display = 'none' }}/>
    <span><span className="block text-lg leading-tight">{wordmark}</span><span className="mt-1 block text-xs font-medium text-slate-500">{brand.tagline}</span></span>
  </span>
}
