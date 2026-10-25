import { useEffect, useState } from 'react'
import { CarFront } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Brand = { platform_name: string; tagline: string; logo_url: string | null }
const fallback: Brand = { platform_name: 'My Car', tagline: 'منصة السيارات للشركات والأساطيل في مصر', logo_url: null }

export default function PlatformBrand({ compact = false }: { compact?: boolean }) {
  const [brand, setBrand] = useState<Brand>(fallback)
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) return
      const { data } = await supabase.from('platform_settings').select('platform_name,tagline,logo_url').eq('id', true).maybeSingle()
      if (active && data) setBrand({ ...fallback, ...data } as Brand)
    }
    void load()
    window.addEventListener('platform-settings-updated', load)
    return () => { active = false; window.removeEventListener('platform-settings-updated', load) }
  }, [])
  if (compact) return <span className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
    {brand.logo_url ? <img src={brand.logo_url} alt="" className="h-6 w-6 rounded object-contain"/> : <CarFront size={17}/>}
    {brand.platform_name}
  </span>
  return <span className="inline-flex items-center gap-3">
    {brand.logo_url ? <img src={brand.logo_url} alt={brand.platform_name} className="h-10 w-10 rounded-lg object-contain"/> : <CarFront size={22}/>}
    <span><span className="block font-extrabold">{brand.platform_name}</span><span className="block text-xs font-medium text-slate-500">{brand.tagline}</span></span>
  </span>
}
