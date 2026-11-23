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
 return <header dir="rtl" className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_6px_24px_rgba(15,35,65,.07)] backdrop-blur-xl">
  <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-5 lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between lg:gap-5 lg:py-3">
   <div className="flex min-w-0 items-center justify-between gap-3">
    <a href="/workspace/employee" aria-label="My Car عربيتي - مساحة الموظف المستقل" className="group flex min-w-0 flex-col items-start gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
     <PlatformBrand compact/>
     <span className="pr-9 text-[10px] font-extrabold leading-tight tracking-wide text-slate-600 sm:pr-10 sm:text-[11px]">اطلب سيارتك وبالسعر اللي تحدده</span>
    </a>
    <div className="flex shrink-0 items-center gap-2 lg:order-3">
     <AccountNotifications/>
    </div>
   </div>
   <nav aria-label="التنقل داخل مساحة الموظف المستقل" className="mc-platform-page-nav mc-platform-page-nav--employee">
    {links.map(({key,href,label,icon:Icon})=><a key={key} href={href} aria-current={active===key?'page':undefined} className={active===key?'is-active':''}><Icon size={16}/>{label}</a>)}
    {active==='home'&&<a href="#new-request" className="mc-employee-nav-cta"><CarFront size={16}/> طلب سيارة</a>}
   </nav>
  </div>
 </header>
}
