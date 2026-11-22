import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type AudienceRole='individual_owner'|'fleet_supplier'|'employee'|'company'|'company_employee'
type Banner={id:string;title:string;image_url:string;click_url:string|null;display_order:number}
export default function HomepageBanner({role}:{role:AudienceRole}){
 const [banner,setBanner]=useState<Banner|null>(null)
 useEffect(()=>{
  let active=true
  async function load(){
   if(!supabase)return
   const {data,error}=await supabase.from('platform_homepage_banners').select('id,title,image_url,click_url,display_order').eq('enabled',true).contains('audience_roles',[role]).order('display_order',{ascending:true}).order('created_at',{ascending:false}).limit(1)
   if(active&&!error)setBanner((data?.[0] as Banner|undefined)||null)
  }
  void load()
  return()=>{active=false}
 },[role])
 if(!banner)return null
 const image=<img src={banner.image_url} alt={banner.title||'بانر My Car'} className="block h-auto max-h-[260px] w-full object-cover sm:max-h-[320px]"/>
 if(banner.click_url){
  let href=banner.click_url
  try{const parsed=new URL(href,window.location.origin);if(!['http:','https:'].includes(parsed.protocol))href='/'}catch{if(!href.startsWith('/'))href='/'}
  return <section dir="rtl" aria-label={banner.title||'بانر الصفحة الرئيسية'} className="mx-auto mt-5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,35,65,.10)] sm:rounded-3xl"><a href={href} className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-500">{image}</a></section>
 }
 return <section dir="rtl" aria-label={banner.title||'بانر الصفحة الرئيسية'} className="mx-auto mt-5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,35,65,.10)] sm:rounded-3xl">{image}</section>
}
