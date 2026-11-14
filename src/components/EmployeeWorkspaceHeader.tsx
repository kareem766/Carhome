import { LayoutDashboard, ClipboardList, MessageCircle, UserRound, CarFront, Bot, CreditCard, Menu, X } from 'lucide-react'
import { useState } from 'react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type ActivePage = 'home' | 'requests' | 'messages' | 'account'
const links = [
 {key:'home',href:'/workspace/employee',label:'الرئيسية',icon:LayoutDashboard},
 {key:'assistant',href:'/assistant',label:'مساعد My Car',icon:Bot},
 {key:'subscriptions',href:'/workspace/subscriptions',label:'الاشتراكات',icon:CreditCard},
 {key:'requests',href:'/workspace/employee/requests',label:'طلباتي والعروض',icon:ClipboardList},
 {key:'messages',href:'/workspace/employee/messages',label:'المراسلات',icon:MessageCircle},
 {key:'account',href:'/workspace/employee/account',label:'بيانات الحساب',icon:UserRound}
] as const

export default function EmployeeWorkspaceHeader({active='home'}:{active?:ActivePage}){
 const [menuOpen,setMenuOpen]=useState(false)
 return <>
  <aside className="mc-employee-sidebar" dir="rtl">
   <a href="/workspace/employee" className="mb-5 flex items-center justify-between border-b border-white/15 pb-4"><PlatformBrand compact/><span className="text-xs font-bold text-cyan-200">مساحة الموظف</span></a>
   <nav aria-label="القائمة الجانبية للموظف" className="space-y-1">
    {links.map(({key,href,label,icon:Icon})=><a key={key} href={href} aria-current={window.location.pathname===href||key===active?'page':undefined}><Icon size={18}/>{label}</a>)}
   </nav>
   <a href="#new-request" className="mt-5 flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-3 text-sm font-extrabold text-white"><CarFront size={18}/> طلب سيارة</a>
  </aside>
  <header dir="rtl" className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-[0_8px_28px_rgba(15,35,65,.07)] backdrop-blur-xl">
   <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-3 py-3 sm:px-5 lg:flex-nowrap lg:py-3.5">
    <a href="/workspace/employee" aria-label="My Car عربيتي - مساحة الموظف" className="group flex min-w-0 items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><PlatformBrand/><span className="hidden rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-extrabold text-blue-800 xl:inline-flex">مساحة الموظف</span></a>
    <button type="button" onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 lg:hidden">{menuOpen?<X size={17}/>:<Menu size={17}/>} القائمة</button>
    {menuOpen&&<nav className="order-3 flex w-full flex-wrap gap-2 border-t border-slate-100 pt-2 lg:hidden">{links.map(({key,href,label,icon:Icon})=><a key={key} href={href} aria-current={window.location.pathname===href?'page':undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700"><Icon size={15}/>{label}</a>)}</nav>}
    <div className="flex shrink-0 items-center gap-2"><span className="hidden h-8 w-px bg-slate-200 sm:block"/><div className="rounded-xl border border-slate-200 bg-slate-50 p-0.5"><AccountNotifications/></div></div>
   </div>
  </header>
 </>
}
