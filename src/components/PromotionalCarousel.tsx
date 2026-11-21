import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

type PromoRole = 'individual_owner' | 'fleet_supplier' | 'employee'
type Slide = { id:string; title:string; image_url:string; click_url:string|null; display_order:number }
export default function PromotionalCarousel({ role }: { role: PromoRole }) {
 const [slides,setSlides]=useState<Slide[]>([])
 const [active,setActive]=useState(0)
 const [paused,setPaused]=useState(false)
 const [touchStart,setTouchStart]=useState<number|null>(null)
 useEffect(()=>{
  let mounted=true
  async function load(){
   if(!supabase)return
   const {data,error}=await supabase.from('platform_promo_slides').select('id,title,image_url,click_url,display_order,audience_roles,starts_at,ends_at').eq('enabled',true).contains('audience_roles',[role]).order('display_order',{ascending:true}).order('created_at',{ascending:false})
   if(!mounted||error||!data)return
   const now=Date.now()
   const eligible=(data as (Slide & {audience_roles:string[];starts_at?:string|null;ends_at?:string|null})[]).filter(item=>(!item.starts_at||new Date(item.starts_at).getTime()<=now)&&(!item.ends_at||new Date(item.ends_at).getTime()>now))
   setSlides(eligible)
  }
  void load()
  return()=>{mounted=false}
 },[role])
 useEffect(()=>{
  if(slides.length<2||paused)return
  const timer=window.setInterval(()=>setActive(index=>(index+1)%slides.length),5000)
  return()=>window.clearInterval(timer)
 },[slides.length,paused])
 useEffect(()=>{if(active>=slides.length)setActive(0)},[active,slides.length])
 if(!slides.length)return null
 const current=slides[active]
 const move=(direction:number)=>setActive(index=>(index+direction+slides.length)%slides.length)
 const validLink=(value:string|null)=>{if(!value)return null;try{const url=new URL(value,window.location.origin);return ['http:','https:'].includes(url.protocol)?value:null}catch{return value.startsWith('/')?value:null}}
 const link=validLink(current.click_url)
 const image=<img src={current.image_url} alt={current.title||'عرض جديد على My Car'} className="block h-auto w-full object-contain sm:absolute sm:inset-0 sm:h-full sm:object-cover sm:transition-transform sm:duration-700 sm:group-hover:scale-[1.015]" draggable={false}/>
 return <section dir="rtl" aria-label="العروض الجديدة على My Car" className="group relative mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_12px_35px_rgba(15,35,65,.12)] sm:rounded-3xl" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setPaused(false)}} onTouchStart={event=>setTouchStart(event.touches[0]?.clientX??null)} onTouchEnd={event=>{if(touchStart===null)return;const delta=event.changedTouches[0].clientX-touchStart;if(Math.abs(delta)>45)move(delta>0?-1:1);setTouchStart(null)}}>
  <div className="relative w-full overflow-hidden bg-slate-100 sm:aspect-[16/5] sm:min-h-[150px] sm:max-h-[310px]">
   {link?<a href={link} aria-label={current.title?'افتح العرض: '+current.title:'افتح العرض'} className="relative block w-full focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:absolute sm:inset-0">{image}</a>:image}
   <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/10"/>
   {slides.length>1&&<>
    <button type="button" onClick={()=>move(-1)} aria-label="العرض السابق" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-slate-950/55 text-white shadow-lg backdrop-blur transition hover:bg-slate-950/80 sm:right-4 sm:h-11 sm:w-11"><ChevronRight size={22}/></button>
    <button type="button" onClick={()=>move(1)} aria-label="العرض التالي" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-slate-950/55 text-white shadow-lg backdrop-blur transition hover:bg-slate-950/80 sm:left-4 sm:h-11 sm:w-11"><ChevronLeft size={22}/></button>
   </>}
   {slides.length>1&&<div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">{slides.map((slide,index)=><button key={slide.id} type="button" onClick={()=>setActive(index)} aria-label={'انتقل إلى العرض '+(index+1)} aria-current={index===active?'true':undefined} className={'h-2 rounded-full transition-all '+(index===active?'w-7 bg-white':'w-2 bg-white/60 hover:bg-white')}/>)}</div>}
  </div>
 </section>
}
