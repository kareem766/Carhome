import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowLeft, BellRing, Building2, CarFront, CheckCircle2, ClipboardCheck, CreditCard, Gauge, Megaphone, RefreshCw, Settings2, ShieldCheck, Users, Wallet, BriefcaseBusiness, Headset, FileBarChart, UserCheck, Tags, LayoutGrid } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type Counts = { users:number; organizations:number; companyAccounts:number; pendingOrganizations:number; vehicles:number; approvedVehicles:number; pendingVehicles:number; pendingPayments:number; subscriptions:number; activeAds:number; requests:number; suppliers:number; employees:number; employeeRequests:number; pendingEmployeeRequests:number; promotions:number; tickets:number; sourcing:number }
const initial:Counts={users:0,organizations:0,companyAccounts:0,pendingOrganizations:0,vehicles:0,approvedVehicles:0,pendingVehicles:0,pendingPayments:0,subscriptions:0,activeAds:0,requests:0,suppliers:0,employees:0,employeeRequests:0,pendingEmployeeRequests:0,promotions:0,tickets:0,sourcing:0}
const sections=[
 {title:'مركز المراجعات والتشغيل',description:'ابدأ من الطلبات ذات الأولوية وأنهِ المراجعات من مساراتها المعتمدة.',items:[
  {href:'/workspace/admin/review-center',title:'مركز المراجعات الموحد',desc:'كل الطلبات المعلقة في قائمة واحدة مع البحث والتصفية.',icon:ClipboardCheck,accent:'blue'},
  {href:'/workspace/admin/vehicle-reviews',title:'السيارات والتحويلات',desc:'مراجعة تسجيل السيارات وإثباتات الدفع والإعلانات.',icon:CarFront,accent:'cyan'},
  {href:'/workspace/admin/company-subscriptions',title:'اشتراكات الشركات',desc:'طلبات الاشتراك والتحويلات وتفعيل الباقات.',icon:CreditCard,accent:'green'},
  {href:'/workspace/admin/employee-requests',title:'طلبات الموظفين',desc:'مراجعة طلبات السيارات الشهرية بالسائق.',icon:UserCheck,accent:'violet'},
  {href:'/workspace/admin/managed-sourcing',title:'تفويض البحث',desc:'التفويضات والاشتراكات والطلبات المقدمة للشركات.',icon:BriefcaseBusiness,accent:'orange'},
  {href:'/workspace/admin/support',title:'الدعم والتذاكر',desc:'متابعة استفسارات المستخدمين والمشكلات.',icon:Headset,accent:'rose'},
 ]},
 {title:'إدارة الحسابات والأصول',description:'إدارة أطراف المنصة ومحتوى الكتالوج والبيانات التشغيلية.',items:[
  {href:'/workspace/admin/managed-accounts',title:'المستخدمون والحسابات',desc:'إنشاء الحسابات وتعديلها وإيقافها وإدارة العضويات.',icon:Users,accent:'blue'},
  {href:'/workspace/admin/vehicle-reviews',title:'إدارة السيارات',desc:'متابعة السيارات وحالات اعتمادها وربطها بملاكها.',icon:CarFront,accent:'cyan'},
  {href:'/workspace/admin/employee-requests',title:'الموظفون والطلبات',desc:'حسابات الموظفين وطلبات التأجير المرتبطة بها.',icon:UserCheck,accent:'violet'},
  {href:'/workspace/admin/communications',title:'الإشعارات والبانرات',desc:'رسائل الإدارة والتنبيهات والبانرات داخل المنصة.',icon:BellRing,accent:'rose'},
  {href:'/workspace/admin/analytics',title:'التقارير والتحليلات',desc:'مؤشرات النشاط والتقارير وتصدير البيانات.',icon:FileBarChart,accent:'green'},
  
 ]},
 {title:'الإدارة المالية والتجارية',description:'إعدادات المنتجات والباقات والمدفوعات الخاصة بخدمات المنصة.',items:[
  {href:'/workspace/admin/subscription-plans',title:'باقات الشركات',desc:'إعداد الباقات الشهرية والسنوية وأسعارها.',icon:CreditCard,accent:'green'},
  {href:'/workspace/admin/advertising-plans',title:'باقات الإعلانات',desc:'إدارة الباقات العادية والمميزة ومددها وأسعارها.',icon:Megaphone,accent:'orange'},
  {href:'/workspace/admin/payment-information',title:'معلومات الدفع',desc:'بيانات التحويل المعتمدة ورسائل تعليمات السداد.',icon:Wallet,accent:'cyan'},
  {href:'/workspace/admin/discount-codes',title:'أكواد الخصم',desc:'إنشاء أكواد الخصم وضبط صلاحيتها واستخدامها.',icon:Tags,accent:'violet'},
 ]},
 {title:'الإعدادات والحوكمة',description:'إعداد هوية المنصة وأدوات المتابعة والتحكم.',items:[
  {href:'/workspace/admin/platform-settings',title:'إعدادات وهوية المنصة',desc:'هوية My Car وإعدادات التسجيل والتشغيل.',icon:Settings2,accent:'blue'},
  {href:'/workspace/admin/analytics',title:'تقارير الإدارة',desc:'تقارير المستخدمين والسيارات والطلبات والإعلانات والخدمات.',icon:Activity,accent:'green'},
 ]}
]
const palette:Record<string,string>={blue:'bg-blue-50 text-blue-700 ring-blue-100',cyan:'bg-cyan-50 text-cyan-700 ring-cyan-100',green:'bg-emerald-50 text-emerald-700 ring-emerald-100',violet:'bg-violet-50 text-violet-700 ring-violet-100',orange:'bg-orange-50 text-orange-700 ring-orange-100',rose:'bg-rose-50 text-rose-700 ring-rose-100'}
export default function AdminDashboardPage(){
 const [authorized,setAuthorized]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[counts,setCounts]=useState<Counts>(initial),[updatedAt,setUpdatedAt]=useState('')
 const load=useCallback(async()=>{
  if(!supabase){window.location.replace('/?login=1');return}
  setLoading(true);setError('')
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user){window.location.replace('/?login=1');return}
  const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
  if(adminError||!admin){setAuthorized(false);setError(adminError?.message||'هذا الحساب غير مصرح له بدخول لوحة الإدارة.');setLoading(false);return}
  setAuthorized(true)
  const count=async(table:string,column?:string,value?:string)=>{
   let q=supabase!.from(table).select('*',{count:'exact',head:true})
   if(column&&value)q=q.eq(column,value)
   const result=await q
   if(result.error)throw new Error(table+': '+result.error.message)
   return result.count||0
  }
  const activeAds=async()=>{
   const now=new Date().toISOString()
   const result=await supabase!.from('vehicle_promotions').select('*',{count:'exact',head:true}).eq('status','approved').in('payment_status',['verified','waived']).or('starts_at.is.null,starts_at.lte.'+now).or('ends_at.is.null,ends_at.gt.'+now)
   if(result.error)throw new Error('vehicle_promotions: '+result.error.message)
   return result.count||0
  }
  try{
   const values=await Promise.all([
    count('profiles'),count('organizations'),count('organizations','organization_type','company'),count('organizations','approval_status','pending_review'),
    count('vehicles'),count('vehicles','review_status','approved'),count('vehicles','review_status','pending_payment'),
    (async()=>{const r=await supabase!.from('vehicle_payment_submissions').select('*',{count:'exact',head:true}).in('review_status',['pending','pending_review']);if(r.error)throw new Error(r.error.message);return r.count||0})(),
    count('company_subscriptions'),activeAds(),count('rental_requests'),count('organizations','organization_type','fleet_supplier'),
    count('employee_accounts'),count('employee_rental_requests'),count('employee_rental_requests','status','pending_review'),
    count('vehicle_promotions','status','pending_review'),
    (async()=>{const r=await supabase!.from('support_tickets').select('*',{count:'exact',head:true}).in('status',['open','in_progress','waiting_user']);if(r.error)throw new Error(r.error.message);return r.count||0})(),
    count('managed_sourcing_subscriptions','status','pending_review')
   ])
   setCounts({users:values[0],organizations:values[1],companyAccounts:values[2],pendingOrganizations:values[3],vehicles:values[4],approvedVehicles:values[5],pendingVehicles:values[6],pendingPayments:values[7],subscriptions:values[8],activeAds:values[9],requests:values[10],suppliers:values[11],employees:values[12],employeeRequests:values[13],pendingEmployeeRequests:values[14],promotions:values[15],tickets:values[16],sourcing:values[17]})
   setUpdatedAt(new Date().toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}))
  }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل بعض مؤشرات الإدارة.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 const pendingTotal=counts.pendingOrganizations+counts.pendingVehicles+counts.pendingPayments+counts.pendingEmployeeRequests+counts.promotions+counts.tickets+counts.sourcing
 const metrics=[
  {label:'السيارات المسجلة',value:counts.vehicles,note:counts.approvedVehicles+' سيارة معتمدة',icon:CarFront,href:'/workspace/admin/vehicle-reviews',tone:'cyan'},
  {label:'حسابات الشركات',value:counts.companyAccounts,note:'الشركات فقط دون موردي الأساطيل',icon:Building2,href:'/workspace/admin/managed-accounts',tone:'blue'},
  {label:'ملفات المستخدمين',value:counts.users,note:'جميع الملفات المسجلة',icon:Users,href:'/workspace/admin/managed-accounts',tone:'violet'},
  {label:'الإعلانات النشطة',value:counts.activeAds,note:'إعلانات معتمدة ومدفوعة وسارية',icon:Megaphone,href:'/workspace/admin/advertising-plans',tone:'orange'},
  {label:'اشتراكات الشركات',value:counts.subscriptions,note:'إجمالي سجلات الاشتراك',icon:CreditCard,href:'/workspace/admin/company-subscriptions',tone:'green'},
  {label:'طلبات التأجير',value:counts.requests,note:'طلبات التأجير المسجلة',icon:ClipboardCheck,href:'/workspace/admin/employee-requests',tone:'rose'}
 ]
 if(loading&&!authorized)return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><p className="font-bold text-slate-600">جارٍ التحقق من صلاحيات الإدارة...</p></main>
 return <main dir="rtl" className="min-h-screen bg-[#f3f7fc] text-slate-900"><div className="mx-auto max-w-[1720px] px-3 py-4 sm:px-6 lg:px-8">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><PlatformBrand/><div className="flex items-center gap-2"><span className="hidden rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 sm:inline-flex sm:items-center sm:gap-2"><ShieldCheck size={15}/> مركز الإدارة الشامل</span><button onClick={()=>void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/> تحديث</button><AccountNotifications/></div></header>
  <AdminPageNavigation/>
  {!authorized&&!loading?<section className="mt-6 rounded-2xl border border-red-200 bg-white p-6 font-bold text-red-700">{error||'غير مصرح بالدخول.'}</section>:<>
   <section className="relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-l from-[#071d35] via-[#103a60] to-[#176ba7] px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9"><div className="pointer-events-none absolute -left-10 -top-20 h-64 w-64 rounded-full border-[28px] border-white/5"/><div className="relative flex flex-wrap items-end justify-between gap-5"><div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><Gauge size={15}/> MY CAR · ADMIN COMMAND CENTER</div><h1 className="mt-4 text-3xl font-black sm:text-4xl">مركز قيادة وإدارة المنصة</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base">إدارة ومتابعة جميع عمليات My Car عربيتي من مكان واحد؛ من مراجعة التسجيلات والمدفوعات إلى الحسابات والاشتراكات والإعلانات والدعم والتقارير.</p></div><div className="min-w-[210px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xs text-blue-100">حالة الاتصال</p><p className="mt-1 flex items-center gap-2 font-extrabold"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300"/>{error?'يوجد تنبيه في تحميل البيانات':'تم التحقق من صلاحيات الإدارة'}</p><p className="mt-1 text-[11px] text-blue-100/80">{updatedAt?'آخر تحديث: '+updatedAt:'يتم تحميل البيانات الفعلية'}</p></div></div></section>
   {error&&<div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">تعذر تحميل بعض المؤشرات: {error}</div>}
   <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(({label,value,note,icon:Icon,href,tone})=><a key={label} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-3 text-3xl font-black tabular-nums text-[#102b47]">{loading?'—':value.toLocaleString('ar-EG')}</p></div><span className={'grid h-12 w-12 place-items-center rounded-2xl ring-1 '+palette[tone]}><Icon size={22}/></span></div><p className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{note}</span><ArrowLeft size={15} className="transition group-hover:-translate-x-1"/></p></a>)}</section>
   <section className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black text-[#102b47]"><ClipboardCheck size={21} className="text-blue-700"/> صندوق الأعمال المطلوب مراجعتها</h2><p className="mt-1 text-sm text-slate-500">أعداد مباشرة من قاعدة البيانات حسب حالات المراجعة الحالية.</p></div><span className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">{loading?'—':pendingTotal.toLocaleString('ar-EG')} عنصر</span></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{[{label:'حسابات تنتظر الاعتماد',value:counts.pendingOrganizations},{label:'سيارات تنتظر المراجعة',value:counts.pendingVehicles},{label:'تحويلات تسجيل السيارات',value:counts.pendingPayments},{label:'طلبات الموظفين',value:counts.pendingEmployeeRequests},{label:'طلبات الإعلانات',value:counts.promotions},{label:'تفويضات البحث',value:counts.sourcing},{label:'تذاكر الدعم المفتوحة',value:counts.tickets}].map(row=><a key={row.label} href="/workspace/admin/review-center" className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 text-sm transition hover:border-blue-200 hover:bg-blue-50"><span className="text-slate-600">{row.label}</span><b className={'min-w-9 rounded-lg px-2 py-1 text-center '+(row.value?'bg-amber-100 text-amber-800':'bg-emerald-50 text-emerald-700')}>{loading?'—':row.value.toLocaleString('ar-EG')}</b></a>)}</div><a href="/workspace/admin/review-center" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102b47] px-4 text-sm font-extrabold text-white hover:bg-blue-800">فتح مركز المراجعات الموحد<ArrowLeft size={16}/></a></div>
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-xl font-black text-[#102b47]"><LayoutGrid size={20} className="text-blue-700"/> ملخص موارد المنصة</h2><div className="mt-4 grid grid-cols-2 gap-3">{[{label:'موردو الأساطيل',value:counts.suppliers},{label:'الموظفون',value:counts.employees},{label:'طلبات الموظفين',value:counts.employeeRequests},{label:'حسابات المؤسسات',value:counts.organizations}].map(x=><div key={x.label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{x.label}</p><p className="mt-1 text-2xl font-black text-[#102b47]">{loading?'—':x.value.toLocaleString('ar-EG')}</p></div>)}</div><p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-950">عدد حسابات الشركات يُحتسب من نوع الحساب company فقط، ويظل موردو الأساطيل في مؤشر مستقل. لا تتضمن المؤشرات أي مبالغ تخص معاملات التأجير بين المالك والشركة.</p></aside></section>
   {sections.map(section=><section key={section.title} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4"><h2 className="text-xl font-black text-[#102b47]">{section.title}</h2><p className="mt-1 text-sm text-slate-500">{section.description}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{section.items.map(({href,title,desc,icon:Icon,accent})=><a key={title} href={href} className="group flex min-h-[112px] items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"><span className={'grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 '+palette[accent]}><Icon size={20}/></span><span className="min-w-0 flex-1"><b className="block text-sm font-extrabold text-slate-800">{title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{desc}</span></span><ArrowLeft size={16} className="mt-1 shrink-0 text-slate-400 transition group-hover:-translate-x-1 group-hover:text-blue-700"/></a>)}</div></section>)}
   <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> مركز إدارة My Car عربيتي</span><span>لوحة تشغيل شاملة · بيانات تشغيلية فعلية · تصميم متجاوب</span></footer>
  </>}
 </div></main>
}
