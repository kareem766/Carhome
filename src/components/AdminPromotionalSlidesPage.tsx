import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type Role='individual_owner'|'fleet_supplier'|'employee'
type Slide={id:string;title:string;image_url:string;click_url:string|null;audience_roles:Role[];enabled:boolean;display_order:number;starts_at:string|null;ends_at:string|null}
const roles:{value:Role;label:string}[]=[{value:'individual_owner',label:'مالك السيارة'},{value:'fleet_supplier',label:'مورد الأسطول'},{value:'employee',label:'الموظف'}]

type Destination={value:string;label:string;roles:Role[]}
const destinations:Destination[]=[
 // صفحات عامة ومشتركة
 {value:'/',label:'الصفحة الرئيسية للمنصة',roles:['individual_owner','fleet_supplier','employee']},
 {value:'/services',label:'خدمات السيارات',roles:['individual_owner','fleet_supplier','employee']},
 {value:'/assistant',label:'مساعد My Car',roles:['individual_owner','fleet_supplier','employee']},
 {value:'/support',label:'مركز الدعم',roles:['individual_owner','fleet_supplier','employee']},
 {value:'/privacy',label:'سياسة الخصوصية',roles:['individual_owner','fleet_supplier','employee']},
 {value:'/terms',label:'الشروط والأحكام',roles:['individual_owner','fleet_supplier','employee']},
 {value:'/workspace/notifications',label:'إعدادات الإشعارات',roles:['individual_owner','fleet_supplier','employee']},

 // صفحات مالك السيارة
 {value:'/workspace/owner/vehicles',label:'مالك السيارة · سياراتي',roles:['individual_owner']},
 {value:'/workspace/owner/offers',label:'مالك السيارة · عروضي',roles:['individual_owner']},
 {value:'/workspace/owner/requests',label:'مالك السيارة · طلبات الشركات',roles:['individual_owner']},
 {value:'/workspace/owner/employee-requests',label:'مالك السيارة · طلبات الموظفين',roles:['individual_owner']},
 {value:'/workspace/provider/managed-sourcing',label:'مالك السيارة · تفويضات البحث',roles:['individual_owner']},
 {value:'/workspace/catalog',label:'مالك السيارة · كتالوج السيارات',roles:['individual_owner']},
 {value:'/workspace/advertising-plans',label:'مالك السيارة · باقات الإعلانات',roles:['individual_owner']},

 // صفحات مورد الأسطول
 {value:'/workspace/supplier/vehicles',label:'مورد الأسطول · أسطولي',roles:['fleet_supplier']},
 {value:'/workspace/supplier/vehicles/new',label:'مورد الأسطول · إضافة سيارة',roles:['fleet_supplier']},
 {value:'/workspace/supplier/requests',label:'مورد الأسطول · طلبات الشركات',roles:['fleet_supplier']},
 {value:'/workspace/supplier/offers',label:'مورد الأسطول · عروضي',roles:['fleet_supplier']},
 {value:'/workspace/provider-employee-requests',label:'مورد الأسطول · طلبات الموظفين',roles:['fleet_supplier']},
 {value:'/workspace/provider/managed-sourcing',label:'مورد الأسطول · تفويضات البحث',roles:['fleet_supplier']},
 {value:'/workspace/supplier/insights',label:'مورد الأسطول · تقارير الأسطول',roles:['fleet_supplier']},
 {value:'/workspace/supplier/account',label:'مورد الأسطول · الحساب',roles:['fleet_supplier']},
 {value:'/workspace/catalog',label:'مورد الأسطول · كتالوج السيارات',roles:['fleet_supplier']},
 {value:'/workspace/advertising-plans',label:'مورد الأسطول · الإعلانات',roles:['fleet_supplier']},
 {value:'/messages',label:'مورد الأسطول · المحادثات',roles:['fleet_supplier']},

 // صفحات الموظف المستقل
 {value:'/workspace/employee',label:'الموظف · الرئيسية',roles:['employee']},
 {value:'/workspace/employee/requests',label:'الموظف · طلباتي والعروض',roles:['employee']},
 {value:'/workspace/employee/messages',label:'الموظف · المراسلات',roles:['employee']},
 {value:'/workspace/employee/account',label:'الموظف · بيانات الحساب',roles:['employee']},
]
export default function AdminPromotionalSlidesPage(){
 const [authorized,setAuthorized]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [slides,setSlides]=useState<Slide[]>([]),[editing,setEditing]=useState<Slide|null>(null)
 const [title,setTitle]=useState(''),[imageUrl,setImageUrl]=useState(''),[imageFile,setImageFile]=useState<File|null>(null),[clickUrl,setClickUrl]=useState('')
 const [audiences,setAudiences]=useState<Role[]>(['individual_owner','fleet_supplier','employee']),[order,setOrder]=useState('0'),[startsAt,setStartsAt]=useState(''),[endsAt,setEndsAt]=useState('')
 const [error,setError]=useState(''),[notice,setNotice]=useState('')
 async function load(){if(!supabase){window.location.replace('/?login=1');return}setLoading(true);const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.replace('/?login=1');return}const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(adminError||!admin){setAuthorized(false);setLoading(false);return}setAuthorized(true);const {data,error}=await supabase.from('platform_promo_slides').select('*').order('display_order',{ascending:true}).order('created_at',{ascending:false});if(error)setError(error.message);else setSlides((data||[]) as Slide[]);setLoading(false)}
 useEffect(()=>{void load()},[])
 function reset(){setEditing(null);setTitle('');setImageUrl('');setImageFile(null);setClickUrl('');setAudiences(['individual_owner','fleet_supplier','employee']);setOrder('0');setStartsAt('');setEndsAt('')}
 function selectImage(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0]||null;if(!file){setImageFile(null);return}if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('ارفع صورة JPG أو PNG أو WebP فقط.');event.target.value='';return}if(file.size>5*1024*1024){setError('حجم الصورة يجب ألا يتجاوز 5 ميجابايت.');event.target.value='';return}setError('');setImageFile(file)}
 function edit(row:Slide){setEditing(row);setTitle(row.title);setImageUrl(row.image_url);setImageFile(null);setClickUrl(row.click_url||'');setAudiences(row.audience_roles);setOrder(String(row.display_order));setStartsAt(row.starts_at?new Date(row.starts_at).toISOString().slice(0,16):'');setEndsAt(row.ends_at?new Date(row.ends_at).toISOString().slice(0,16):'')}
 async function save(event:FormEvent){event.preventDefault();if(!supabase)return;if(!title.trim()||(!imageUrl&&!imageFile)||!audiences.length){setError('أضف عنوانًا وصورة وحدد حسابًا واحدًا على الأقل.');return}if(startsAt&&endsAt&&new Date(endsAt)<=new Date(startsAt)){setError('تاريخ نهاية العرض يجب أن يكون بعد تاريخ البداية.');return}setSaving(true);setError('');setNotice('');const {data:{user}}=await supabase.auth.getUser();if(!user){setSaving(false);setError('انتهت جلسة الدخول. سجل الدخول مرة أخرى.');return}let finalUrl=imageUrl||'';if(imageFile){const ext=imageFile.type==='image/png'?'png':imageFile.type==='image/webp'?'webp':'jpg';const path=user.id+'/promotional-slides/'+crypto.randomUUID()+'.'+ext;const {error:uploadError}=await supabase.storage.from('platform-assets').upload(path,imageFile,{contentType:imageFile.type,cacheControl:'31536000',upsert:false});if(uploadError){setSaving(false);setError('تعذر رفع الصورة: '+uploadError.message);return}finalUrl=supabase.storage.from('platform-assets').getPublicUrl(path).data.publicUrl}const payload={title:title.trim(),image_url:finalUrl,click_url:clickUrl.trim()||null,audience_roles:audiences,display_order:Number(order)||0,starts_at:startsAt?new Date(startsAt).toISOString():null,ends_at:endsAt?new Date(endsAt).toISOString():null,updated_by:user.id};const result=editing?await supabase.from('platform_promo_slides').update(payload).eq('id',editing.id):await supabase.from('platform_promo_slides').insert({...payload,enabled:true,created_by:user.id});setSaving(false);if(result.error){setError('تعذر حفظ العرض: '+result.error.message);return}setNotice('تم حفظ العرض بنجاح.');reset();await load()}
 async function toggle(row:Slide){if(!supabase)return;const {error}=await supabase.from('platform_promo_slides').update({enabled:!row.enabled,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)setError(error.message);else await load()}
 async function remove(row:Slide){if(!supabase||!window.confirm('هل تريد حذف هذا العرض نهائيًا؟'))return;const {error}=await supabase.from('platform_promo_slides').delete().eq('id',row.id);if(error)setError(error.message);else{if(editing?.id===row.id)reset();setNotice('تم حذف العرض.');await load()}}
 if(loading)return <main dir="rtl" className="grid min-h-screen place-items-center">جارٍ تحميل إدارة العروض...</main>
 if(!authorized)return <main dir="rtl" className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-black">غير مصرح بالدخول</h1><p className="mt-2 text-slate-600">هذه الصفحة مخصصة لمسؤولي My Car فقط.</p></main>
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8"><div className="mx-auto max-w-7xl"><PlatformBrand/><AdminPageNavigation/><header className="my-6"><p className="text-sm font-bold text-blue-700">التسويق داخل المنصة</p><h1 className="mt-1 text-3xl font-black">شريط العروض الترويجية</h1><p className="mt-2 text-sm leading-7 text-slate-600">أضف صور العروض وروابطها وحدد الحسابات التي تظهر لها، مع ترتيب وجدولة وتفعيل كل عرض.</p></header>
 {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</p>}
 <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
 <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">{editing?'تعديل العرض':'إضافة عرض جديد'}</h2><form onSubmit={save} className="space-y-4">
 <label className="block text-sm font-bold">عنوان العرض<input required maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"/></label>
 <label className="block text-sm font-bold">صورة العرض<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} className="mt-2 block w-full rounded-xl border border-dashed p-3 text-sm font-normal"/></label>
 {(imageFile||imageUrl)&&<div className="overflow-hidden rounded-xl border bg-slate-50 p-2"><img src={imageFile?URL.createObjectURL(imageFile):imageUrl} alt="معاينة العرض" className="max-h-48 w-full rounded-lg object-contain"/><button type="button" onClick={()=>{setImageFile(null);setImageUrl('')}} className="mt-2 text-xs font-bold text-rose-700">إزالة الصورة</button></div>}
 <label className="block text-sm font-bold">صفحة التوجيه عند الضغط<select value={clickUrl} onChange={e=>setClickUrl(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal"><option value="">بدون توجيه</option>{destinations.filter(item=>item.roles.some(role=>audiences.includes(role))).map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">تظهر الصفحات المناسبة للحسابات التي اخترتها فقط.</span></label>
 <fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm font-bold">يظهر في حسابات</legend><div className="grid gap-2 sm:grid-cols-3">{roles.map(role=><label key={role.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audiences.includes(role.value)} onChange={e=>setAudiences(old=>e.target.checked?[...old,role.value]:old.filter(item=>item!==role.value))}/>{role.label}</label>)}</div></fieldset>
 <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">ترتيب الظهور<input type="number" value={order} onChange={e=>setOrder(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-3"/></label><label className="text-sm font-bold">بداية العرض<input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-2 text-xs"/></label><label className="text-sm font-bold">نهاية العرض<input type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-2 text-xs"/></label></div>
 <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900">تنتقل الشرائح تلقائيًا كل 5 ثوانٍ، ويمكن للمستخدم تحريكها يدويًا. الصور المقترحة بنسبة 16:5 لتظهر بجودة أفضل على مختلف الشاشات.</p>
 <div className="flex gap-2"><button disabled={saving} className="min-h-12 flex-1 rounded-xl bg-blue-700 px-4 font-black text-white disabled:opacity-50">{saving?'جارٍ الحفظ...':editing?'حفظ التعديلات':'إضافة العرض'}</button>{editing&&<button type="button" onClick={reset} className="rounded-xl border px-4 font-bold">إلغاء</button>}</div>
 </form></section>
 <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-xl font-black">العروض المضافة ({slides.length})</h2><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>{slides.length===0?<p className="py-10 text-center text-sm text-slate-500">لم تتم إضافة عروض بعد.</p>:<div className="space-y-3">{slides.map(row=><article key={row.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3"><img src={row.image_url} alt="" className="h-20 w-28 rounded-xl bg-slate-100 object-cover"/><div className="min-w-0 flex-1"><b className="block truncate">{row.title}</b><p className="mt-1 text-xs text-slate-500">{row.audience_roles.map(value=>roles.find(role=>role.value===value)?.label||value).join(' · ')}</p><p className="mt-1 text-xs text-slate-400">الترتيب: {row.display_order} · {destinations.find(item=>item.value===row.click_url)?.label|| (row.click_url?'مسار توجيه مخصص':'بدون توجيه')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>edit(row)} className="rounded-lg border px-3 py-2 text-xs font-bold">تعديل</button><button type="button" onClick={()=>void toggle(row)} aria-label={row.enabled?'إيقاف العرض':'تفعيل العرض'} className="rounded-lg bg-slate-100 p-2">{row.enabled?<Eye size={17}/>:<EyeOff size={17}/>}</button><button type="button" onClick={()=>void remove(row)} aria-label="حذف العرض" className="rounded-lg bg-rose-50 p-2 text-rose-700"><Trash2 size={17}/></button></div></article>)}</div>}</section></div></div></main>
}
