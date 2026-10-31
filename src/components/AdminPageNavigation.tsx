import { LayoutDashboard, Palette, CreditCard, Megaphone, BellRing, Wallet, UserPlus, ClipboardCheck, BarChart3, Activity, BriefcaseBusiness } from 'lucide-react'
import { useState } from 'react'
import PlatformEntryBanner from './PlatformEntryBanner'

const groups = [
 { title:'الرئيسية', links:[{href:'/workspace/admin',label:'لوحة التحكم',icon:LayoutDashboard}] },
 { title:'إدارة المنصة', links:[
  {href:'/workspace/admin/vehicle-reviews',label:'المراجعات والطلبات',icon:ClipboardCheck},
  {href:'/workspace/admin/managed-sourcing',label:'خدمة البحث نيابة عن الشركات',icon:BriefcaseBusiness},
  {href:'/workspace/admin/managed-accounts',label:'حسابات المستخدمين',icon:UserPlus},
  {href:'/workspace/admin/communications',label:'الإشعارات والبانرات',icon:BellRing},
  {href:'/workspace/admin/analytics',label:'التقارير والتحليلات',icon:Activity}
 ]},
 { title:'الاشتراكات والإعدادات', links:[
  {href:'/workspace/admin/subscription-plans',label:'اشتراكات الشركات',icon:CreditCard},
  {href:'/workspace/admin/advertising-plans',label:'باقات الإعلانات',icon:Megaphone},
  {href:'/workspace/admin/payment-information',label:'معلومات الدفع',icon:Wallet},
  {href:'/workspace/admin/platform-settings',label:'هوية المنصة',icon:Palette}
 ]}
]
export default function AdminPageNavigation(){
 const path=window.location.pathname
 const [open,setOpen]=useState(false)
 return <>
  <PlatformEntryBanner/>
  <style>{`@media(min-width:1024px){body{padding-right:276px!important}} .mc-admin-sidebar{scrollbar-width:thin} @media(max-width:1023px){.mc-admin-sidebar{position:relative!important;width:100%!important;height:auto!important;top:auto!important;right:auto!important}.mc-admin-sidebar-inner{display:none}.mc-admin-sidebar[data-open="true"] .mc-admin-sidebar-inner{display:block}.mc-admin-sidebar .mc-admin-mobile-toggle{display:flex!important}} @media(min-width:1024px){.mc-admin-sidebar .mc-admin-mobile-toggle{display:none!important}}`}</style>
  <aside data-open={open?'true':'false'} className="mc-admin-sidebar fixed right-0 top-0 z-40 flex h-screen w-[256px] flex-col border-l border-slate-200 bg-[#102b47] p-4 text-white shadow-xl">
   <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-4"><a href="/workspace/admin" className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 font-black text-[#102b47]">MC</span><span><b className="block text-lg font-black">My Car</b><small className="text-xs text-slate-300">مركز الإدارة</small></span></a><button className="mc-admin-mobile-toggle hidden rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={()=>setOpen(!open)}>{open?'إغلاق':'القائمة'}</button></div>
   <div className="mc-admin-sidebar-inner mt-5 flex-1 space-y-6 overflow-y-auto">{groups.map(group=><section key={group.title}><p className="mb-2 px-3 text-[11px] font-extrabold text-cyan-300">{group.title}</p><div className="space-y-1">{group.links.map(({href,label,icon:Icon})=><a key={href} href={href} aria-current={path===href?'page':undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition ${path===href?'bg-cyan-400 text-[#102b47] shadow':'text-slate-200 hover:bg-white/10 hover:text-white'}`}><Icon size={18}/>{label}</a>)}</div></section>)}</div>
   <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-6 text-slate-300"><BarChart3 size={16} className="mb-1 text-cyan-300"/>لوحة متابعة تشغيلية مبنية على بيانات المنصة الفعلية.</div>
  </aside>
 </>
}
