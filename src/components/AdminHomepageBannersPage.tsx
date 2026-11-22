import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type Role='individual_owner'|'fleet_supplier'|'employee'|'company'|'company_employee'
type Banner={id:string;title:string;image_url:string;click_url:string|null;audience_roles:Role[];enabled:boolean;display_order:number}
const roles:{value:Role;label:string}[]=[
 {value:'individual_owner',label:'مالك السيارة'},
 {value:'fleet_supplier',label:'مورد الأسطول'},
 {value:'company',label:'الشركة'},
 {value:'company_employee',label:'موظف الشركة'},
 {value:'employee',label:'الموظف المستقل'}
]
type DestinationGroup={group:string;options:{value:string;label:string}[]}
const destinations:DestinationGroup[]=[
 {group:'صفحات عامة',options:[
  {value:'/workspace',label:'الصفحة الرئيسية'},
  {value:'/services',label:'خدمات السيارات'},
  {value:'/support',label:'الدعم الفني'}
 ]},
 {group:'مالك السيارة',options:[
  {value:'/workspace/owner/vehicles',label:'سياراتي'},
  {value:'/workspace/owner/offers',label:'عروضي'},
  {value:'/workspace/provider-employee-requests',label:'طلبات الموظفين'},
  {value:'/workspace/catalog',label:'كتالوج السيارات'},
  {value:'/workspace/owner/ads',label:'إعلاناتي'}
 ]},
 {group:'مورد الأسطول',options:[
  {value:'/workspace/provider-employee-requests',label:'طلبات الموظفين'},
  {value:'/workspace/provider/vehicles',label:'سيارات الأسطول'},
  {value:'/workspace/provider/offers',label:'عروضي'},
  {value:'/workspace/catalog',label:'كتالوج السيارات'}
 ]},
 {group:'الشركة',options:[
  {value:'/workspace/company/requests',label:'طلبات السيارات'},
  {value:'/workspace/company/subscriptions',label:'اشتراكات الشركة'},
  {value:'/workspace/catalog',label:'كتالوج السيارات'}
 ]},
 {group:'الموظف المستقل وموظف الشركة',options:[
  {value:'/workspace/employee/requests',label:'طلباتي'},
  {value:'/workspace/employee/offers',label:'العروض المقدمة'},
  {value:'/workspace/catalog',label:'كتالوج السيارات'}
 ]}
]
export default function AdminHomepageBannersPage(){
 const [authorized,setAuthorized]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [items,setItems]=useState<Banner[]>([]),[editing,setEditing]=useState<Banner|null>(null)
 const [title,setTitle]=useState(''),[imageUrl,setImageUrl]=useState(''),[imageFile,setImageFile]=useState<File|null>(null),[clickUrl,setClickUrl]=useState('')
 const [audiences,setAudiences]=useState<Role[]>(['individual_owner','fleet_supplier']),[order,setOrder]=useState('0')
 const [error,setError]=useState(''),[notice,setNotice]=useState('')
 async function load(){
  if(!supabase){window.location.replace('/?login=1');return}
  setLoading(true)
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){window.location.replace('/?login=1');return}
  const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
  if(adminError||!admin){setAuthorized(false);setLoading(false);return}
  setAuthorized(true)
  const {data,error}=await supabase.from('platform_homepage_banners').select('*').order('display_order',{ascending:true}).order('created_at',{ascending:false})
  if(error)setError(error.message);else setItems((data||[]) as Banner[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 function reset(){setEditing(null);setTitle('');setImageUrl('');setImageFile(null);setClickUrl('');setAudiences(['individual_owner','fleet_supplier']);setOrder('0')}
 function selectImage(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0]||null
  if(!file){setImageFile(null);return}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('ارفع صورة JPG أو PNG أو WebP فقط.');event.target.value='';return}
  if(file.size>2*1024*1024){setError('حجم الصورة يجب ألا يتجاوز 2 ميجابايت.');event.target.value='';return}
  setError('');setImageFile(file)
 }
 function edit(row:Banner){setEditing(row);setTitle(row.title);setImageUrl(row.image_url);setImageFile(null);setClickUrl(row.click_url||'');setAudiences(row.audience_roles);setOrder(String(row.display_order))}
 async function save(event:FormEvent){
  event.preventDefault()
  if(!supabase)return
  if(!title.trim()||(!imageUrl&&!imageFile)||!audiences.length){setError('أضف عنوانًا وصورة وحدد حسابًا واحدًا على الأقل.');return}
  setSaving(true);setError('');setNotice('')
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){setSaving(false);setError('انتهت جلسة الدخول. سجل الدخول مرة أخرى.');return}
  let finalUrl=imageUrl
  if(imageFile){
   const ext=imageFile.type==='image/png'?'png':imageFile.type==='image/webp'?'webp':'jpg'
   const path=user.id+'/homepage-banners/'+crypto.randomUUID()+'.'+ext
   const {error:uploadError}=await supabase.storage.from('platform-assets').upload(path,imageFile,{contentType:imageFile.type,cacheControl:'31536000',upsert:false})
   if(uploadError){setSaving(false);setError('تعذر رفع الصورة: '+uploadError.message);return}
   finalUrl=supabase.storage.from('platform-assets').getPublicUrl(path).data.publicUrl
  }
  const payload={title:title.trim(),image_url:finalUrl,click_url:clickUrl.trim()||null,audience_roles:audiences,display_order:Number(order)||0,updated_by:user.id}
  const result=editing?await supabase.from('platform_homepage_banners').update(payload).eq('id',editing.id):await supabase.from('platform_homepage_banners').insert({...payload,enabled:true,created_by:user.id})
  setSaving(false)
  if(result.error){setError('تعذر حفظ البانر: '+result.error.message);return}
  setNotice('تم حفظ البانر بنجاح.');reset();await load()
 }
 async function toggle(row:Banner){if(!supabase)return;const {error}=await supabase.from('platform_homepage_banners').update({enabled:!row.enabled,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)setError(error.message);else await load()}
 async function remove(row:Banner){if(!supabase||!window.confirm('هل تريد حذف هذا البانر نهائيًا؟'))return;const {error}=await supabase.from('platform_homepage_banners').delete().eq('id',row.id);if(error)setError(error.message);else{if(editing?.id===row.id)reset();setNotice('تم حذف البانر.');await load()}}
 if(loading)return <main dir="rtl" className="grid min-h-screen place-items-center">جارٍ تحميل إدارة بانرات الصفحة الرئيسية...</main>
 if(!authorized)return <main dir="rtl" className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-black">غير مصرح بالدخول</h1><p className="mt-2 text-slate-600">هذه الصفحة مخصصة لمسؤولي My Car فقط.</p></main>
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8"><div className="mx-auto max-w-7xl"><PlatformBrand/><AdminPageNavigation/><header className="my-6"><p className="text-sm font-bold text-blue-700">إدارة الصفحة الرئيسية</p><h1 className="mt-1 text-3xl font-black">بانرات الصفحة الرئيسية</h1><p className="mt-2 text-sm leading-7 text-slate-600">إدارة مستقلة عن شريط العروض الترويجية. يظهر البانر أسفل كارت الصفحة الرئيسية للحسابات التي تختارها فقط، ويظل ثابتًا حتى إيقافه أو حذفه.</p></header>
 {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</p>}
 <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
 <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">{editing?'تعديل البانر':'إضافة بانر جديد'}</h2><form onSubmit={save} className="space-y-4">
 <label className="block text-sm font-bold">اسم البانر<input required maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"/></label>
 <label className="block text-sm font-bold">صورة البانر<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} className="mt-2 block w-full rounded-xl border border-dashed p-3 text-sm font-normal"/></label>
 {(imageFile||imageUrl)&&<div className="overflow-hidden rounded-xl border bg-slate-50 p-2"><img src={imageFile?URL.createObjectURL(imageFile):imageUrl} alt="معاينة البانر" className="max-h-56 w-full rounded-lg object-contain"/><button type="button" onClick={()=>{setImageFile(null);setImageUrl('')}} className="mt-2 text-xs font-bold text-rose-700">إزالة الصورة</button></div>}
 <label className="block text-sm font-bold">الصفحة المستهدفة عند الضغط<select value={destinations.some(group=>group.options.some(option=>option.value===clickUrl))?clickUrl:''} onChange={e=>setClickUrl(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal"><option value="">بدون انتقال</option>{destinations.map(group=><optgroup key={group.group} label={group.group}>{group.options.map(option=><option key={group.group+option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select><span className="mt-2 block text-xs font-normal text-slate-500">اختر صفحة من صفحات الحسابات أو استخدم رابطًا مخصصًا بالأسفل.</span></label>
 <label className="block text-sm font-bold">رابط مخصص (اختياري)<input type="text" value={destinations.some(group=>group.options.some(option=>option.value===clickUrl))?'':clickUrl} onChange={e=>setClickUrl(e.target.value)} placeholder="/workspace/provider-employee-requests أو https://example.com" className="mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"/></label>
 <fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm font-bold">إظهار البانر في الحسابات المحددة فقط</legend><div className="grid gap-3 sm:grid-cols-2">{roles.map(role=><label key={role.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audiences.includes(role.value)} onChange={e=>setAudiences(old=>e.target.checked?[...old,role.value]:old.filter(item=>item!==role.value))}/>{role.label}</label>)}</div></fieldset>
 <label className="block text-sm font-bold">ترتيب الظهور (عند وجود أكثر من بانر)<input type="number" value={order} onChange={e=>setOrder(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"/></label>
 <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900">الصيغ المدعومة JPG وPNG وWebP، بحد أقصى 2 ميجابايت. البانر لا يدخل في شريط العروض ولا يتأثر بإعداداته.</p>
 <div className="flex gap-2"><button disabled={saving} className="min-h-12 flex-1 rounded-xl bg-blue-700 px-4 font-black text-white disabled:opacity-50">{saving?'جارٍ الحفظ...':editing?'حفظ التعديلات':'إضافة البانر'}</button>{editing&&<button type="button" onClick={reset} className="rounded-xl border px-4 font-bold">إلغاء</button>}</div>
 </form></section>
 <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-xl font-black">البانرات المضافة ({items.length})</h2><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>{items.length===0?<p className="py-10 text-center text-sm text-slate-500">لم تتم إضافة بانرات بعد.</p>:<div className="space-y-3">{items.map(row=><article key={row.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3"><img src={row.image_url} alt="" className="h-20 w-28 rounded-xl bg-slate-100 object-cover"/><div className="min-w-0 flex-1"><b className="block truncate">{row.title}</b><p className="mt-1 text-xs text-slate-500">{row.audience_roles.map(value=>roles.find(role=>role.value===value)?.label||value).join(' · ')}</p><p className="mt-1 text-xs text-slate-400">الترتيب: {row.display_order} · {row.click_url||'بدون رابط'}</p></div><div className="flex gap-2"><button type="button" onClick={()=>edit(row)} className="rounded-lg border px-3 py-2 text-xs font-bold">تعديل</button><button type="button" onClick={()=>void toggle(row)} aria-label={row.enabled?'إيقاف البانر':'تفعيل البانر'} className="rounded-lg bg-slate-100 p-2">{row.enabled?<Eye size={17}/>:<EyeOff size={17}/>}</button><button type="button" onClick={()=>void remove(row)} aria-label="حذف البانر" className="rounded-lg bg-rose-50 p-2 text-rose-700"><Trash2 size={17}/></button></div></article>)}</div>}</section></div></div></main>
}
