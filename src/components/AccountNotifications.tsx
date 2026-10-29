import { useEffect, useState } from 'react'
import { Bell, CircleUserRound, LogOut, MessageCircle, ChevronDown, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AccountNotifications() {
  const [open,setOpen]=useState(false)
  const [notificationsOpen,setNotificationsOpen]=useState(false)
  const [identity,setIdentity]=useState({name:'الحساب',email:'',organization:'',role:'مستخدم'})
  useEffect(()=>{
    let active=true
    async function load(){
      if(!supabase)return
      const {data:{user}}=await supabase.auth.getUser()
      if(!user||!active)return
      const meta=user.user_metadata||{}
      const {data:membership}=await supabase.from('organization_memberships').select('organization_id').eq('user_id',user.id).limit(1).maybeSingle()
      let organization='', role='مستخدم'
      if(membership?.organization_id){
        const {data:org}=await supabase.from('organizations').select('name,organization_type').eq('id',membership.organization_id).maybeSingle()
        organization=org?.name||''
        const type=String(org?.organization_type||'')
        role=type==='company'?'حساب شركة':type==='fleet_supplier'?'مورد أسطول':type==='individual_owner'?'مالك سيارة':type==='admin'?'مدير المنصة':'مستخدم'
      }
      if(active)setIdentity({name:String(meta.full_name||meta.name||user.email?.split('@')[0]||'الحساب'),email:user.email||'',organization,role})
    }
    void load()
    return ()=>{active=false}
  },[])
  async function logout(){
    if(!supabase)return
    await supabase.auth.signOut()
    window.location.href='/?login=1'
  }
  return <div className="relative flex items-center gap-2" dir="rtl">
    <button type="button" aria-label="فتح الإشعارات" title="الإشعارات" aria-expanded={notificationsOpen} onClick={()=>{setNotificationsOpen(v=>!v);setOpen(false)}} className="relative grid h-11 w-11 place-items-center rounded-full border border-sky-200 bg-sky-50 text-sky-800 transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300"><Bell size={19}/></button>
    <button type="button" aria-expanded={open} aria-label="تفاصيل الحساب" onClick={()=>setOpen(v=>!v)} className="flex items-center gap-2 rounded-full border border-cyan-200 bg-slate-950 px-2 py-1.5 text-white shadow-[0_0_16px_rgba(34,211,238,.18)] hover:border-cyan-300 sm:px-3"><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-cyan-300 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,.45)]"><CircleUserRound size={19}/></span><span className="hidden max-w-36 text-right sm:block"><span className="block truncate text-xs font-extrabold">{identity.name}</span><span className="block truncate text-[10px] text-cyan-100">{identity.organization||identity.role}</span></span><ChevronDown size={14} className="text-cyan-200"/></button>
    {notificationsOpen&&<div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-black">الإشعارات</h3><button type="button" aria-label="إغلاق الإشعارات" onClick={()=>setNotificationsOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={17}/></button></div><p className="mt-3 text-sm leading-6 text-slate-600">لا توجد إشعارات معروضة حاليًا.</p><a href="/workspace/messages" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-800 hover:bg-sky-100"><MessageCircle size={16}/> الانتقال إلى المحادثات</a></div>}
    {open&&<div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-xl"><p className="font-black">{identity.name}</p><p className="mt-1 break-all text-xs text-slate-500">{identity.email}</p><p className="mt-2 text-sm font-bold text-sky-800">{identity.organization||'لم يتم ربط مؤسسة'}</p><p className="mt-1 text-xs text-slate-500">{identity.role}</p><a href="/workspace/messages" className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800"><MessageCircle size={16}/> فتح المحادثات</a><button onClick={()=>void logout()} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50"><LogOut size={16}/> تسجيل الخروج</button></div>}
  </div>
}
