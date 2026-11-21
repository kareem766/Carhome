import { LayoutDashboard, ClipboardList, MessageCircle, UserRound, CarFront, Bot, Bell } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type ActivePage = 'home' | 'assistant' | 'requests' | 'messages' | 'account' | 'notifications'
const links = [
 {key:'home',href:'/workspace/employee',label:'الرئيسية',icon:LayoutDashboard},
 {key:'assistant',href:'/assistant',label:'مساعد My Car',icon:Bot},
 {key:'requests',href:'/workspace/employee/requests',label:'طلباتي والعروض',icon:ClipboardList},
 {key:'messages',href:'/workspace/employee/messages',label:'المراسلات',icon:MessageCircle},
 {key:'account',href:'/workspace/employee/account',label:'بيانات الحساب',icon:UserRound},
 {key:'notifications',href:'/workspace/notifications',label:'الإشعارات',icon:Bell}
] as const

export default function EmployeeWorkspaceHeader({active='home'}:{active?:ActivePage}){
 return <header dir="rtl" className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-[0_5px_20px_rgba(15,35,65,.06)] backdrop-blur-xl">
  <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:px-5 lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between lg:gap-5 lg:py-3">
   <div className="flex min-w-0 items-center justify-between gap-3">
    <a href="/workspace/employee" aria-label="My Car عربيتي - مساحة الموظف" className="group flex min-w-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
     <span className="sm:hidden"><PlatformBrand compact/></span>
     <span className="hidden sm:inline-flex"><PlatformBrand/></span>
     <span className="mr-2 hidden rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-800 xl:inline-flex">مساحة الموظف</span>
    </a>
    <div className="flex shrink-0 items-center gap-2 lg:order-3">
     <AccountNotifications/>
    </div>
   </div>
   <nav aria-label="التنقل داخل مساحة الموظف" className="flex w-full items-center gap-1 overflow-x-auto overscroll-x-contain border-t border-slate-100 pt-2 [scrollbar-width:thin] lg:order-2 lg:w-auto lg:flex-1 lg:justify-center lg:border-0 lg:pt-0">
    {links.map(({key,href,label,icon:Icon})=><a key={key} href={href} aria-current={active===key?'page':undefined} className={'inline-flex min-h-10 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm '+(active===key?'bg-[#123456] text-white shadow-sm shadow-blue-950/15':'text-slate-600 hover:bg-blue-50 hover:text-blue-800')}><Icon size={16}/>{label}</a>)}
    {active==='home'&&<a href="#new-request" className="inline-flex min-h-10 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-extrabold text-orange-800 transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"><CarFront size={16}/> طلب سيارة</a>}
   </nav>
  </div>
 </header>
}
