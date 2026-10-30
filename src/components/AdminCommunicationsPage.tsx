import { useEffect, useState } from 'react'
import { BellRing, ImagePlus, Send, Trash2, RefreshCw } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type Banner = { id:string; title:string; body:string; image_url:string|null; button_label:string|null; button_url:string|null; enabled:boolean; duration_seconds:number; starts_at:string|null; ends_at:string|null; display_order:number }
type Audience = 'all'|'company'|'individual_owner'|'fleet_supplier'
export default function AdminCommunicationsPage() {
 const [authorized,setAuthorized]=useState(false), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false)
 const [banner,setBanner]=useState<Banner|null>(null), [banners,setBanners]=useState<Banner[]>([])
 const [title,setTitle]=useState(''), [body,setBody]=useState(''), [imageUrl,setImageUrl]=useState(''), [buttonLabel,setButtonLabel]=useState(''), [buttonUrl,setButtonUrl]=useState('')
 const [notificationTitle,setNotificationTitle]=useState(''), [notificationBody,setNotificationBody]=useState(''), [audience,setAudience]=useState<Audience>('all')
 const [message,setMessage]=useState(''), [error,setError]=useState('')
 async function load(){
  if(!supabase){window.location.replace('/?login=1');return}
  setLoading(true); const {data:{user}}=await supabase.auth.getUser()
  if(!user){window.location.replace('/?login=1');return}
  const {data:admin}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
  if(!admin){setAuthorized(false);setLoading(false);return}
  setAuthorized(true)
  const {data,error}=await supabase.from('platform_banners').select('*').order('created_at',{ascending:false})
  if(error)setError(error.message);else setBanners((data||[]) as Banner[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 async function saveBanner(e:React.FormEvent){
  e.preventDefault();if(!supabase)return
  if(!title.trim()||!body.trim()){setError('اكتب عنوان الإعلان ومحتواه.');return}
  setBusy(true);setError('');setMessage('')
  const {data:{user}}=await supabase.auth.getUser()
  const payload={title:title.trim(),body:body.trim(),image_url:imageUrl.trim()||null,button_label:buttonLabel.trim()||null,button_url:buttonUrl.trim()||null,enabled:true,duration_seconds:30,display_order:0,updated_by:user?.id}
  const result=banner ? await supabase.from('platform_banners').update(payload).eq('id',banner.id) : await supabase.from('platform_banners').insert({...payload,created_by:user?.id})
  setBusy(false);if(result.error){setError(result.error.message);return}
  setMessage('تم حفظ الإعلان. مدة ظهوره للمستخدم 30 ثانية.');setBanner(null);setTitle('');setBody('');setImageUrl('');setButtonLabel('');setButtonUrl('');await load()
 }
 function editBanner(b:Banner){setBanner(b);setTitle(b.title);setBody(b.body);setImageUrl(b.image_url||'');setButtonLabel(b.button_label||'');setButtonUrl(b.button_url||'')}
 async function toggleBanner(b:Banner){if(!supabase)return;const {error}=await supabase.from('platform_banners').update({enabled:!b.enabled,updated_at:new Date().toISOString()}).eq('id',b.id);if(error)setError(error.message);else await load()}
 async function deleteBanner(b:Banner){if(!supabase||!window.confirm('حذف الإعلان نهائيًا؟'))return;const {error}=await supabase.from('platform_banners').delete().eq('id',b.id);if(error)setError(error.message);else await load()}
 async function sendNotification(e:React.FormEvent){
  e.preventDefault();if(!supabase)return
  if(!notificationTitle.trim()||!notificationBody.trim()){setError('اكتب عنوان الإشعار ومحتواه.');return}
  setBusy(true);setError('');setMessage('')
  let query=supabase.from('organization_memberships').select('user_id,organizations!inner(organization_type)')
  if(audience!=='all')query=query.eq('organizations.organization_type',audience)
  const {data:members,error:membersError}=await query
  if(membersError){setBusy(false);setError('تعذر تحديد مستلمي الإشعار: '+membersError.message);return}
  const ids=[...new Set((members||[]).map((m:any)=>m.user_id).filter(Boolean))]
  if(!ids.length){setBusy(false);setError('لا يوجد مستخدمون ضمن الفئة المختارة.');return}
  const {data:{user}}=await supabase.auth.getUser()
  const rows=ids.map(user_id=>({user_id,title:notificationTitle.trim(),body:notificationBody.trim(),notification_type:'admin_broadcast',created_by:user?.id}))
  const {error}=await supabase.from('platform_notifications').insert(rows)
  setBusy(false);if(error){setError(error.message);return}
  setMessage('تم إرسال الإشعار إلى '+ids.length+' حساب.');setNotificationTitle('');setNotificationBody('')
 }
 if(loading)return <main dir="rtl" className="grid min-h-screen place-items-center">جارٍ تحميل إدارة الاتصالات...</main>
 if(!authorized)return <main dir="rtl" className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-black">غير مصرح بالدخول</h1><p className="mt-2 text-slate-600">هذه الصفحة مخصصة لمسؤولي My Car فقط.</p></main>
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8"><div className="mx-auto max-w-7xl"><PlatformBrand/><AdminPageNavigation/><header className="my-6"><p className="text-sm font-bold text-blue-700">إدارة التواصل مع المستخدمين</p><h1 className="mt-1 text-3xl font-black">الإشعارات والإعلانات</h1><p className="mt-2 text-sm text-slate-600">إرسال رسائل داخل المنصة وإدارة نافذة الإعلان التي تظهر عند دخول المستخدم.</p></header>
 {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{message&&<p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}
 <div className="grid gap-6 lg:grid-cols-2">
 <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><BellRing/></span><div><h2 className="text-xl font-black">إرسال إشعار للمستخدمين</h2><p className="text-xs text-slate-500">يظهر داخل مركز الإشعارات في حساباتهم</p></div></div><form onSubmit={sendNotification} className="space-y-3"><label className="block text-sm font-bold">عنوان الإشعار<input required maxLength={120} value={notificationTitle} onChange={e=>setNotificationTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">نص الإشعار<textarea required maxLength={1000} rows={4} value={notificationBody} onChange={e=>setNotificationBody(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">المستلمون<select value={audience} onChange={e=>setAudience(e.target.value as Audience)} className="mt-1 w-full rounded-xl border p-3"><option value="all">كل المستخدمين</option><option value="company">الشركات</option><option value="individual_owner">ملاك السيارات</option><option value="fleet_supplier">موردو الأساطيل</option></select></label><button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-black text-white disabled:opacity-50"><Send size={17}/> {busy?'جارٍ الإرسال...':'إرسال الإشعار'}</button></form></section>
 <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-700"><ImagePlus/></span><div><h2 className="text-xl font-black">إضافة بانر إعلاني</h2><p className="text-xs text-slate-500">نافذة تظهر عند دخول المستخدم لمدة 30 ثانية</p></div></div><form onSubmit={saveBanner} className="space-y-3"><label className="block text-sm font-bold">عنوان الإعلان<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">نص الإعلان<textarea required maxLength={800} rows={3} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">رابط صورة الإعلان<input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">نص الزر (اختياري)<input value={buttonLabel} onChange={e=>setButtonLabel(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">رابط الزر<input type="url" value={buttonUrl} onChange={e=>setButtonUrl(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label></div><p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">مدة العرض ثابتة 30 ثانية. يمكن إيقاف الإعلان أو تعديله في أي وقت.</p><div className="flex gap-2"><button disabled={busy} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 px-4 font-black text-white disabled:opacity-50">{banner?'حفظ التعديلات':'نشر الإعلان'}</button>{banner&&<button type="button" onClick={()=>{setBanner(null);setTitle('');setBody('');setImageUrl('');setButtonLabel('');setButtonUrl('')}} className="rounded-xl border px-4 font-bold">إلغاء</button>}</div></form></section></div>
 <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">الإعلانات الحالية</h2><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>{banners.length===0?<p className="py-8 text-center text-sm text-slate-500">لا توجد إعلانات محفوظة بعد.</p>:<div className="space-y-3">{banners.map(b=><article key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div className="min-w-0 flex-1"><p className="font-black">{b.title}</p><p className="mt-1 line-clamp-2 text-sm text-slate-600">{b.body}</p><p className="mt-1 text-xs text-slate-400">مدة العرض: 30 ثانية</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>editBanner(b)} className="rounded-lg border px-3 py-2 text-sm font-bold">تعديل</button><button onClick={()=>void toggleBanner(b)} className={b.enabled?'rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800':'rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold'}>{b.enabled?'إيقاف':'تفعيل'}</button><button onClick={()=>void deleteBanner(b)} aria-label="حذف الإعلان" className="rounded-lg bg-red-50 p-2 text-red-700"><Trash2 size={16}/></button></div></article>)}</div>}</section>
 </div></main>
}
