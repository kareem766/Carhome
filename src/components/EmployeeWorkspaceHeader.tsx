import { useState } from 'react'
import { ChevronDown, CircleUserRound, LayoutDashboard, ClipboardList, MessageCircle, UserRound, LogOut, CarFront } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import { supabase } from '../lib/supabase'

type ActivePage = 'home' | 'requests' | 'messages' | 'account'
const links = [
 {key:'home',href:'/workspace/employee',label:'الرئيسية',icon:LayoutDashboard},
 {key:'requests',href:'/workspace/employee/requests',label:'طلباتي والعروض',icon:ClipboardList},
 {key:'messages',href:'/workspace/employee/messages',label:'المراسلات',icon:MessageCircle},
 {key:'account',href:'/workspace/employee/account',label:'بيانات الحساب',icon:UserRound}
] as const

export default function EmployeeWorkspaceHeader({active='home'}:{active?:ActivePage}){
 const [menuOpen,setMenuOpen]=useState(false)
 async function logout(){
  if(!supabase)return
  const {error}=await supabase.auth.signOut()
  if(!error)window.location.replace('/')
 }
 return <header dir="rtl" className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-[0_8px_28px_rgba(15,35,65,.07)] backdrop-blur-xl">
  <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-3 py-3 sm:px-5 lg:flex-nowrap lg:py-3.5">
   <a href="/workspace/employee" aria-label="My Car عربيتي - مساحة الموظف" className="group flex min-w-0 items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#123456] to-[#176b9a] p-1 shadow-md shadow-blue-950/15 ring-1 ring-white"><span className="grid h-full w-full place-items-center overflow-hidden rounded-xl bg-white"><PlatformBrand compact/></span></span>
    <span className="min-w-0"><span className="block truncate text-sm font-black tracking-tight text-slate-900 sm:text-base">مساحة الموظف</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500 sm:text-xs">My Car عربيتي · خدمات السيارات للشركات</span></span>
   </a>
   <div className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2 lg:order-2 lg:w-auto lg:flex-1 lg:justify-center lg:border-0 lg:pt-0">
    {links.map(({key,href,label,icon:Icon})=><a key={key} href={href} aria-current={active===key?'page':undefined} className={'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-extrabold transition sm:px-4 sm:text-sm '+(active===key?'bg-[#123456] text-white shadow-md shadow-blue-950/15':'text-slate-600 hover:bg-blue-50 hover:text-blue-800')}><Icon size={16}/>{label}</a>)}
    {active==='home'&&<a href="#new-request" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-extrabold text-orange-800 hover:bg-orange-100 sm:px-4 sm:text-sm"><CarFront size={16}/> طلب سيارة</a>}
   </div>
   <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
    <span className="hidden h-8 w-px bg-slate-200 sm:block"/>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-0.5"><AccountNotifications/></div>
    <div className="relative">
     <button type="button" aria-expanded={menuOpen} aria-haspopup="menu" onClick={()=>setMenuOpen(v=>!v)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 sm:px-3">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-800"><CircleUserRound size={18}/></span><span className="hidden sm:inline">الحساب</span><ChevronDown size={15} className={'transition '+(menuOpen?'rotate-180':'')}/>
     </button>
     {menuOpen&&<><button aria-label="إغلاق القائمة" className="fixed inset-0 z-40 cursor-default" onClick={()=>setMenuOpen(false)}/><div role="menu" className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
      <div className="mb-1 rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs font-black text-slate-800">حساب الموظف</p><p className="mt-0.5 text-[10px] text-slate-500">إدارة بياناتك وإعدادات الدخول</p></div>
      <a role="menuitem" href="/workspace/employee/account" onClick={()=>setMenuOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-700 hover:bg-blue-50"><UserRound size={16}/> بيانات الحساب</a>
      <button role="menuitem" type="button" onClick={()=>void logout()} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"><LogOut size={16}/> تسجيل الخروج</button>
     </div></>}
    </div>
   </div>
  </div>
 </header>
}
