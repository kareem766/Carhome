import { useEffect, useState } from 'react'
import { Building2, CarFront, CreditCard, Megaphone, Percent, ReceiptText, Search, ShieldCheck, Wallet } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type LinkItem={href:string;title:string;description:string;icon:typeof CreditCard;group:string}
const accountLinks:Record<string,LinkItem[]> = {
 company:[
  {href:'/workspace/company/subscriptions',title:'اشتراك استخدام المنصة',description:'الباقات الشهرية والسنوية ومتابعة الاشتراك الحالي وسجل الدفع',icon:CreditCard,group:'اشتراكات المنصة'},
  {href:'/workspace/company/managed-sourcing',title:'خدمة البحث نيابة عن شركتك',description:'باقات البحث والتوفير الشهرية وتفويض فريق My Car',icon:Search,group:'خدمات إضافية'},
  {href:'/workspace/advertising-plans',title:'باقات الإعلانات',description:'اختر باقة ظهور إعلاني عادي أو مميز لسياراتك',icon:Megaphone,group:'خدمات إضافية'}
 ],
 owner:[
  {href:'/workspace/advertising-plans',title:'باقات الإعلانات',description:'ترويج سياراتك وزيادة ظهورها في كتالوج المنصة',icon:Megaphone,group:'الخدمات المدفوعة'},
  {href:'/workspace/owner/vehicles/new',title:'تسجيل سيارة ورسومها',description:'إضافة سيارة جديدة واستكمال بيانات التسجيل والدفع',icon:CarFront,group:'الخدمات المدفوعة'}
 ],
 supplier:[
  {href:'/workspace/advertising-plans',title:'باقات الإعلانات',description:'ترويج سيارات الأسطول وزيادة ظهورها أمام الشركات',icon:Megaphone,group:'الخدمات المدفوعة'},
  {href:'/workspace/supplier/vehicles/new',title:'تسجيل سيارة ورسومها',description:'إضافة سيارة للأسطول واستكمال بيانات التسجيل والدفع',icon:CarFront,group:'الخدمات المدفوعة'}
 ],
 employee:[
  {href:'/services',title:'خدمات المنصة',description:'استعرض الخدمات المتاحة للموظفين وتفاصيل استخدامها',icon:Building2,group:'الخدمات'}
 ],
 admin:[
  {href:'/workspace/admin/subscription-plans',title:'باقات اشتراك المنصة',description:'إدارة باقات الشركات وأسعار الاشتراك الشهري والسنوي',icon:CreditCard,group:'إدارة الاشتراكات'},
  {href:'/workspace/admin/company-subscriptions',title:'طلبات الاشتراك',description:'مراجعة التحويلات والاشتراكات وتفعيلها أو رفضها',icon:ReceiptText,group:'إدارة الاشتراكات'},
  {href:'/workspace/admin/managed-sourcing',title:'باقات خدمة البحث',description:'إدارة باقات البحث والتفويضات والاشتراكات الشهرية',icon:Search,group:'إدارة الاشتراكات'},
  {href:'/workspace/admin/advertising-plans',title:'باقات الإعلانات',description:'إدارة أسعار وخطط الإعلان العادي والمميز',icon:Megaphone,group:'إدارة الاشتراكات'},
  {href:'/workspace/admin/discount-codes',title:'أكواد الخصم والبروموكود',description:'إنشاء الأكواد وتحديد الخدمات والصلاحيات والحدود',icon:Percent,group:'أدوات الدفع'},
  {href:'/workspace/admin/payment-information',title:'بيانات التحويل',description:'إدارة أرقام InstaPay وVodafone Cash المعروضة للعملاء',icon:Wallet,group:'أدوات الدفع'}
 ]
}
export default function SubscriptionHubPage({admin=false}:{admin?:boolean}){
 const [role,setRole]=useState(admin?'admin':'')
 const [loading,setLoading]=useState(!admin)
 useEffect(()=>{if(admin)return;let active=true;async function load(){if(!supabase){setLoading(false);return}const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.replace('/?login=1');return}const metadata=String(user.user_metadata?.organization_type||'');const normalized=metadata==='individual_owner'?'owner':metadata==='fleet_supplier'?'supplier':metadata==='employee'?'employee':metadata==='company'?'company':'company';if(active)setRole(normalized);setLoading(false)}void load();return()=>{active=false}},[admin])
 const links=accountLinks[role]||[]
 const navigation: [string,string][] = role==='company'?[['الرئيسية','/workspace/company'],['الاشتراكات','/workspace/subscriptions'],['طلبات التأجير','/workspace/company/requests'],['خدمة البحث','/workspace/company/managed-sourcing'],['السيارات المتاحة','/workspace/catalog'],['باقات الإعلانات','/workspace/advertising-plans'],['الحساب','/workspace/company/account']]:role==='supplier'?[['الرئيسية','/workspace/supplier/vehicles'],['الاشتراكات','/workspace/subscriptions'],['طلبات الشركات','/workspace/supplier/requests'],['طلبات الموظفين','/workspace/provider-employee-requests'],['عروضي','/workspace/supplier/offers'],['باقات الإعلانات','/workspace/advertising-plans'],['الحساب','/workspace/supplier/account']]:role==='owner'?[['الرئيسية','/workspace/owner/vehicles'],['الاشتراكات','/workspace/subscriptions'],['سياراتي','/workspace/owner/vehicles'],['طلبات الشركات','/workspace/owner/requests'],['عروضي','/workspace/owner/offers'],['باقات الإعلانات','/workspace/advertising-plans'],['الحساب','/workspace/owner/account']]:[['الرئيسية','/workspace/employee'],['الاشتراكات','/workspace/subscriptions'],['طلباتي والعروض','/workspace/employee/requests'],['المراسلات','/workspace/employee/messages'],['بيانات الحساب','/workspace/employee/account']]
 const groups=[...new Set(links.map(x=>x.group))]
 return <>{admin&&<AdminPageNavigation/>}<main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#f3f7fc,#f8fafc)] px-4 py-6 text-slate-900 sm:px-6"><div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">{!admin&&<aside className="hidden h-fit rounded-3xl bg-[#102b47] p-4 text-white shadow-xl lg:sticky lg:top-5 lg:block"><div className="mb-4 border-b border-white/15 pb-4"><PlatformBrand compact/><p className="mt-2 text-xs font-bold text-cyan-200">القائمة الرئيسية</p></div><nav aria-label="التنقل الجانبي للاشتراكات" className="space-y-1">{navigation.map(([label,href])=><a key={href} href={href} aria-current={href==='/workspace/subscriptions'?'page':undefined} className={'flex min-h-11 items-center rounded-xl px-3 text-sm font-bold '+(href==='/workspace/subscriptions'?'bg-cyan-400 text-[#102b47]':'text-slate-200 hover:bg-white/10')}>{label}</a>)}</nav></aside>}<div className="min-w-0">
  <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-[#0b2545] via-[#123b68] to-[#176b9a] p-6 text-white shadow-xl sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><PlatformBrand compact/><span className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100">مركز موحّد للخدمات المالية</span><h1 className="mt-3 text-3xl font-black">الاشتراكات</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">كل الباقات والاشتراكات والخدمات المدفوعة المرتبطة بحسابك في مكان واحد، مع وصول مباشر للتفاصيل والدفع وسجل الطلبات.</p></div><div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10"><CreditCard size={32}/></div></div></header>
  {loading?<div className="py-16 text-center text-slate-500">جارٍ تحميل الاشتراكات...</div>:<div className="mt-6 space-y-7">{groups.map(group=><section key={group}><div className="mb-3 flex items-center gap-2"><span className="h-6 w-1 rounded-full bg-blue-600"/><h2 className="text-lg font-black">{group}</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{links.filter(x=>x.group===group).map(item=><a key={item.href} href={item.href} className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"><span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white"><item.icon size={23}/></span><h3 className="mt-4 font-black">{item.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{item.description}</p><span className="mt-3 text-sm font-extrabold text-blue-700">فتح التفاصيل ←</span></a>)}</div></section>)}{links.length===0&&<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center"><ShieldCheck className="mx-auto text-blue-700" size={30}/><p className="mt-3 font-bold">لا توجد باقات مدفوعة مرتبطة بنوع حسابك حاليًا.</p><p className="mt-1 text-sm text-slate-500">يمكنك متابعة الخدمات المتاحة من القائمة الجانبية.</p></div>}</div>}
 </div></div></main></>
}
