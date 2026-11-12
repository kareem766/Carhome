import { useEffect, useState } from 'react'
import { X, ExternalLink, Megaphone } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Banner = { id:string; title:string; body:string; image_url:string|null; button_label:string|null; button_url:string|null; duration_seconds:number }
export default function PlatformEntryBanner() {
 const [banner,setBanner]=useState<Banner|null>(null)
 const [visible,setVisible]=useState(false)
 useEffect(()=>{
  let active=true
  if(!supabase)return
  // This component is a public-entry promotion only. Verify the real Supabase
  // session here as a second guard; the parent auth state can briefly lag during
  // initial hydration or an auth redirect.
  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session)=>{
   if(session?.user){active=false;setVisible(false);setBanner(null)}
  })
  async function load(){
   const {data: initialAuth}=await supabase.auth.getSession()
   if(!active||initialAuth.session?.user)return
   const {data,error}=await supabase.from('platform_banners').select('id,title,body,image_url,button_label,button_url,duration_seconds,starts_at,ends_at').eq('enabled',true).order('display_order',{ascending:true}).order('created_at',{ascending:false}).limit(20)
   if(!active||error||!data?.length)return
   const {data: latestAuth}=await supabase.auth.getSession()
   if(!active||latestAuth.session?.user)return
   const now=Date.now()
   const eligible=(data as (Banner & {starts_at:string|null;ends_at:string|null})[]).filter(item=>(!item.starts_at||new Date(item.starts_at).getTime()<=now)&&(!item.ends_at||new Date(item.ends_at).getTime()>now))
   let selected:Banner|undefined
   const nowMs=Date.now()
   for(const item of eligible){
    let lastShown=0
    try{lastShown=Number(localStorage.getItem('mycar-banner-last-shown-'+item.id)||0)}catch{}
    // Keep the banner from reopening during login redirects, auth refreshes,
    // or route remounts; allow it to appear again on a later visit.
    if(!lastShown||nowMs-lastShown>=30*60*1000){selected=item;break}
   }
   if(!selected)return
   try{localStorage.setItem('mycar-banner-last-shown-'+selected.id,String(nowMs))}catch{}
   setBanner(selected);setVisible(true)
   const duration=10
   window.setTimeout(()=>{if(active)setVisible(false)},duration*1000)
  }
  void load()
  return()=>{active=false;authListener.subscription.unsubscribe()}
 },[])
 if(!visible||!banner)return null
 return <div dir="rtl" className="fixed inset-0 z-[300] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mycar-entry-banner-title">
  <section className="relative w-full max-w-2xl overflow-hidden mc-entry-banner-frame relative rounded-3xl border-2 border-sky-400 bg-white shadow-2xl">
   <button type="button" onClick={()=>setVisible(false)} aria-label="إغلاق الإعلان" className="absolute left-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-slate-950/75 text-white hover:bg-slate-950"><X size={20}/></button>
   {banner.image_url&&<img src={banner.image_url} alt="" className="max-h-72 w-full object-cover"/>}
   <div className="p-6 sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800"><Megaphone size={14}/> إعلان من My Car</span><h2 id="mycar-entry-banner-title" className="mt-4 text-2xl font-black text-slate-950">{banner.title}</h2><p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-600">{banner.body}</p>{banner.button_label&&banner.button_url&&<a href={banner.button_url} onClick={()=>setVisible(false)} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 font-black text-white hover:bg-blue-800">{banner.button_label}<ExternalLink size={16}/></a>}<p className="mt-4 text-[11px] text-slate-400">سيُغلق الإعلان تلقائيًا بعد 10 ثوانٍ.</p></div>
  </section>
 </div>
}
