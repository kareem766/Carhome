import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw, Search, CheckCircle2, XCircle, Save, Trash2, Building2, CarFront, Banknote, Megaphone, ClipboardList, Handshake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Tab = 'accounts' | 'vehicles' | 'payments' | 'promotions' | 'requests' | 'offers'
type Row = Record<string, any>
const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
const btn = 'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50'
const fmt = (v: unknown) => v == null || v === '' ? '—' : String(v)
export default function AdminManagementPage() {
  const [tab,setTab]=useState<Tab>('accounts')
  const [rows,setRows]=useState<Row[]>([])
  const [loading,setLoading]=useState(true)
  const [authorized,setAuthorized]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [search,setSearch]=useState('')
  const [editing,setEditing]=useState<Row|null>(null)
  const [saving,setSaving]=useState(false)
  async function load() {
    if(!supabase){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false);return}
    setLoading(true);setError('')
    const {data:auth}=await supabase.auth.getUser()
    if(!auth.user){window.location.replace('/?login=1');return}
    const {data:admin,error:ae}=await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
    if(ae||!admin){setAuthorized(false);setError('هذه الصفحة مخصصة لصاحب المنصة فقط.');setLoading(false);return}
    setAuthorized(true)
    let result:any
    if(tab==='accounts') result=await supabase.from('organizations').select('id,name,organization_type,approval_status,contact_name,phone,contact_email,city,address,company_type,fleet_vehicle_count,created_at').order('created_at',{ascending:false}).limit(300)
    else if(tab==='vehicles') result=await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,transmission,seats,governorate,address,monthly_price_egp,yearly_price_egp,with_driver,notes,has_gps,review_status,payment_status,created_at,organization_id').order('created_at',{ascending:false}).limit(300)
    else if(tab==='payments') result=await supabase.from('vehicle_payment_submissions').select('id,vehicle_id,organization_id,amount_egp,review_status,transfer_reference,created_at,reviewed_at,admin_notes').order('created_at',{ascending:false}).limit(300)
    else if(tab==='promotions') result=await supabase.from('vehicle_promotions').select('id,vehicle_id,organization_id,advertising_plan_id,status,payment_status,payment_reference,starts_at,ends_at,created_at,admin_notes').order('created_at',{ascending:false}).limit(300)
    else if(tab==='requests') result=await supabase.from('rental_requests').select('id,organization_id,title,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,details,status,created_at').order('created_at',{ascending:false}).limit(300)
    else result=await supabase.from('rental_offers').select('id,request_id,organization_id,monthly_price_egp,yearly_price_egp,vehicle_count,message,status,created_at').order('created_at',{ascending:false}).limit(300)
    if(result.error){setError('تعذر تحميل البيانات: '+result.error.message);setRows([])}else setRows(result.data||[])
    setLoading(false)
  }
  useEffect(()=>{void load()},[tab])
  async function setOrganizationStatus(row:Row,status:string){
    if(!supabase)return
    if(!window.confirm('تأكيد تغيير حالة حساب '+row.name+'؟'))return
    setError('');setNotice('')
    const {error:e}=await supabase.from('organizations').update({approval_status:status,updated_at:new Date().toISOString()}).eq('id',row.id)
    if(e){setError('تعذر تحديث حالة الحساب: '+e.message);return}
    setNotice('تم تحديث حالة الحساب.');await load()
  }
  async function saveAccount(){
    if(!supabase||!editing)return
    setSaving(true);setError('');setNotice('')
    const payload={name:String(editing.name||'').trim(),contact_name:editing.contact_name||null,phone:editing.phone||null,contact_email:editing.contact_email||null,city:editing.city||null,address:editing.address||null,company_type:editing.company_type||null,fleet_vehicle_count:editing.fleet_vehicle_count===''?null:Number(editing.fleet_vehicle_count)}
    const {error:e}=await supabase.from('organizations').update(payload).eq('id',editing.id)
    setSaving(false)
    if(e){setError('تعذر حفظ الحساب. قد تمنع سياسات قاعدة البيانات هذا التعديل: '+e.message);return}
    setNotice('تم حفظ بيانات الحساب.');setEditing(null);await load()
  }
  async function saveVehicle(){
    if(!supabase||!editing)return
    const year=Number(editing.model_year),seats=Number(editing.seats),monthly=Number(editing.monthly_price_egp)
    if(!String(editing.make||'').trim()||!String(editing.model||'').trim()||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+2||!Number.isInteger(seats)||seats<1||seats>100||!Number.isFinite(monthly)||monthly<0){
      setError('راجع بيانات السيارة: الماركة والموديل والسنة وعدد المقاعد والسعر الشهري مطلوبة وقيمها غير صحيحة.');return
    }
    setSaving(true);setError('');setNotice('')
    const payload={make:String(editing.make).trim(),model:String(editing.model).trim(),model_year:year,vehicle_type:String(editing.vehicle_type||'').trim(),transmission:String(editing.transmission||'automatic'),seats,governorate:String(editing.governorate||'').trim(),address:String(editing.address||'').trim(),monthly_price_egp:monthly,yearly_price_egp:editing.yearly_price_egp===''||editing.yearly_price_egp==null?null:Number(editing.yearly_price_egp),with_driver:Boolean(editing.with_driver),notes:editing.notes||null,has_gps:Boolean(editing.has_gps),updated_at:new Date().toISOString()}
    const {error:e}=await supabase.from('vehicles').update(payload).eq('id',editing.id)
    setSaving(false)
    if(e){setError('تعذر حفظ بيانات السيارة: '+e.message);return}
    setNotice('تم حفظ بيانات السيارة. لم يتم تغيير حالة المراجعة أو حالة الدفع.');setEditing(null);await load()
  }
  async function setVehicleStatus(row:Row,status:string){
    if(!supabase)return
    if(status==='approved' && row.payment_status!=='verified' && row.payment_status!=='waived'){
      setError('لا يمكن اعتماد السيارة قبل تأكيد رسوم التسجيل. راجع تحويل الرسوم أولًا.');return
    }
    setError('');setNotice('')
    const {error:e}=await supabase.from('vehicles').update({review_status:status,updated_at:new Date().toISOString()}).eq('id',row.id)
    if(e){setError('تعذر تغيير حالة السيارة: '+e.message);return}
    setNotice('تم تحديث حالة السيارة.');await load()
  }
  async function setPaymentStatus(row:Row,status:string){
    if(!supabase)return
    if(status==='approved'&&!window.confirm('تأكيد أن التحويل تمت مراجعته وقبوله؟'))return
    setError('');setNotice('')
    const {data:auth}=await supabase.auth.getUser()
    const {error:e}=await supabase.from('vehicle_payment_submissions').update({review_status:status,reviewed_at:new Date().toISOString(),reviewed_by:auth.user?.id||null}).eq('id',row.id)
    if(e){setError('تعذر تحديث حالة التحويل: '+e.message);return}
    if(status==='approved'){
      const {error:vehicleError}=await supabase.from('vehicles').update({payment_status:'verified',updated_at:new Date().toISOString()}).eq('id',row.vehicle_id)
      if(vehicleError){setError('تم اعتماد سجل التحويل لكن تعذر تحديث حالة دفع السيارة: '+vehicleError.message);await load();return}
    }
    setNotice(status==='approved'?'تم اعتماد التحويل وتأكيد رسوم السيارة؛ راجع واعتمد السيارة بصورة منفصلة بعد فحص بياناتها.':'تم رفض التحويل.');await load()
  }
  async function setPromotionStatus(row:Row,status:string){
    if(!supabase)return
    if(status==='approved' && row.payment_status!=='verified' && row.payment_status!=='waived'){setError('لا يمكن اعتماد الإعلان قبل تأكيد الدفع من زر تأكيد الدفع.');return}
    if(status==='approved'&&!window.confirm('اعتماد الإعلان بعد التحقق من الدفع؟'))return
    setError('');setNotice('')
    const {data:auth}=await supabase.auth.getUser()
    const update:Row={status,reviewed_at:new Date().toISOString(),reviewed_by:auth.user?.id||null,updated_at:new Date().toISOString()}
    if(status==='approved') { update.starts_at=row.starts_at||new Date().toISOString() }
    const {error:e}=await supabase.from('vehicle_promotions').update(update).eq('id',row.id)
    if(e){setError('تعذر تحديث طلب الإعلان: '+e.message);return}
    setNotice(status==='approved'?'تم اعتماد الإعلان بعد التحقق من الدفع.':'تم رفض طلب الإعلان.');await load()
  }
  async function setPromotionPaymentStatus(row:Row,status:'verified'|'rejected'){
    if(!supabase)return
    if(status==='verified'&&!String(row.payment_reference||'').trim()){setError('لا يوجد رقم مرجعي للتحويل؛ لا يمكن تأكيد الدفع بدون مرجع مسجل.');return}
    if(status==='verified'&&!window.confirm('هل راجعت التحويل فعليًا وتؤكد استلام رسوم الإعلان؟'))return
    const {data:auth}=await supabase.auth.getUser()
    const {error:e}=await supabase.from('vehicle_promotions').update({payment_status:status,reviewed_at:new Date().toISOString(),reviewed_by:auth.user?.id||null,updated_at:new Date().toISOString()}).eq('id',row.id)
    if(e){setError('تعذر تحديث دفع الإعلان: '+e.message);return}
    setNotice(status==='verified'?'تم تأكيد دفع الإعلان. يمكنك الآن اعتماد الطلب.':'تم رفض إثبات دفع الإعلان.');await load()
  }
  async function setRequestStatus(row:Row,status:string){
    if(!supabase)return
    setError('');setNotice('')
    const {error:e}=await supabase.from('rental_requests').update({status,updated_at:new Date().toISOString()}).eq('id',row.id)
    if(e){setError('تعذر تحديث طلب التأجير: '+e.message);return}
    setNotice('تم تحديث حالة طلب التأجير.');await load()
  }
  async function setOfferStatus(row:Row,status:string){
    if(!supabase)return
    setError('');setNotice('')
    const {error:e}=await supabase.from('rental_offers').update({status,updated_at:new Date().toISOString()}).eq('id',row.id)
    if(e){setError('تعذر تحديث العرض: '+e.message);return}
    setNotice('تم تحديث حالة العرض.');await load()
  }
  async function deleteVehicle(row:Row){
    if(!supabase||!window.confirm('حذف السيارة نهائيًا؟ قد تكون مرتبطة بطلبات أو صور؛ إذا رفضت قاعدة البيانات الحذف فلن يتم تجاوز القيود.'))return
    const {error:e}=await supabase.from('vehicles').delete().eq('id',row.id)
    if(e){setError('تعذر حذف السيارة: '+e.message);return}
    setNotice('تم حذف السيارة.');await load()
  }
  const visible=rows.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())))
  const tabs=[{id:'accounts' as const,label:'الحسابات والمؤسسات',icon:Building2},{id:'vehicles' as const,label:'السيارات',icon:CarFront},{id:'payments' as const,label:'تحويلات الرسوم',icon:Banknote},{id:'promotions' as const,label:'طلبات الإعلانات',icon:Megaphone},{id:'requests' as const,label:'طلبات التأجير',icon:ClipboardList},{id:'offers' as const,label:'عروض الموردين',icon:Handshake}]
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 sm:px-6"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"><div><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">إدارة الحسابات والسيارات والتحويلات</h1><p className="mt-1 text-sm text-slate-500">مراجعة البيانات وتحديث الحالات من شاشة واحدة.</p></div><div className="flex gap-2"><button className={btn} onClick={()=>void load()}><RefreshCw size={15}/> تحديث</button><a href="/workspace/admin/dashboard" className={btn}><ArrowRight size={15}/> لوحة التحكم</a></div></header>
    {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</div>}{notice&&<div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setEditing(null);setSearch('')}} className={'flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-extrabold '+(tab===t.id?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-white text-slate-700')}><t.icon size={18}/>{t.label}</button>)}</div>
    {authorized&&<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">{tabs.find(t=>t.id===tab)?.label}</h2><p className="mt-1 text-sm text-slate-500">{visible.length} سجل ظاهر (حتى 300 سجل في القائمة).</p></div><label className="relative w-full sm:max-w-sm"><Search size={16} className="absolute right-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className={field+' pr-9'} placeholder="بحث في السجلات..."/></label></div>
    {loading?<p className="py-12 text-center text-slate-500">جارٍ تحميل البيانات...</p>:visible.length===0?<p className="py-12 text-center text-slate-500">لا توجد سجلات مطابقة.</p>:<div className="mt-4 space-y-3">{visible.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-extrabold">{tab==='accounts'?fmt(row.name):tab==='vehicles'?fmt(row.make)+' '+fmt(row.model)+' ('+fmt(row.model_year)+')':tab==='payments'?'تحويل رسوم · '+fmt(row.amount_egp)+' جنيه':tab==='promotions'?'طلب إعلان · '+fmt(row.status):tab==='requests'?fmt(row.title):'عرض · '+fmt(row.monthly_price_egp)+' جنيه/شهر'}</h3><p className="mt-1 break-all text-xs leading-6 text-slate-500">{tab==='accounts'?fmt(row.organization_type)+' · حالة الحساب: '+fmt(row.approval_status)+' · '+fmt(row.contact_name)+' · '+fmt(row.phone)+' · '+fmt(row.contact_email):tab==='vehicles'?'المحافظة: '+fmt(row.governorate)+' · النوع: '+fmt(row.vehicle_type)+' · '+fmt(row.monthly_price_egp)+' ج/شهر · الدفع: '+fmt(row.payment_status):tab==='payments'?'السيارة: '+fmt(row.vehicle_id)+' · المرجع: '+fmt(row.transfer_reference)+' · تاريخ الإرسال: '+fmt(row.created_at):tab==='promotions'?'السيارة: '+fmt(row.vehicle_id)+' · الباقة: '+fmt(row.advertising_plan_id)+' · الدفع: '+fmt(row.payment_status)+' · المرجع: '+fmt(row.payment_reference):tab==='requests'?'النوع: '+fmt(row.vehicle_type)+' · العدد: '+fmt(row.quantity)+' · المدة: '+fmt(row.duration_type)+' · المحافظة: '+fmt(row.governorate)+' · '+fmt(row.details):'طلب: '+fmt(row.request_id)+' · المؤسسة: '+fmt(row.organization_id)+' · العدد: '+fmt(row.vehicle_count)+' · سنوي: '+fmt(row.yearly_price_egp)+' · '+fmt(row.message)}</p><p className="mt-1 text-xs font-bold text-slate-600">الحالة: {fmt(tab==='accounts'?row.approval_status:tab==='vehicles'?row.review_status:tab==='payments'?row.review_status:tab==='promotions'?row.status:row.status)}</p></div>
    {tab==='accounts'&&<div className="flex flex-wrap gap-2"><button className={btn} onClick={()=>setEditing(editing?.id===row.id?null:{...row})}><Save size={14}/> تعديل البيانات</button><button className={btn+' border-emerald-200 text-emerald-700'} onClick={()=>void setOrganizationStatus(row,'approved')}><CheckCircle2 size={14}/> اعتماد الحساب</button><button className={btn+' border-amber-200 text-amber-700'} onClick={()=>void setOrganizationStatus(row,'pending_review')}>إعادة للمراجعة</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void setOrganizationStatus(row,'rejected')}><XCircle size={14}/> رفض الحساب</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void setOrganizationStatus(row,'suspended')}>إيقاف الحساب</button></div>}
    {tab==='vehicles'&&<div className="flex flex-wrap gap-2"><button className={btn} onClick={()=>setEditing(editing?.id===row.id?null:{...row})}><Save size={14}/> تعديل البيانات</button><button className={btn+' border-emerald-200 text-emerald-700'} onClick={()=>void setVehicleStatus(row,'approved')}><CheckCircle2 size={14}/> اعتماد</button><button className={btn+' border-amber-200 text-amber-700'} onClick={()=>void setVehicleStatus(row,'pending_review')}>إعادة للمراجعة</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void setVehicleStatus(row,'rejected')}><XCircle size={14}/> رفض</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void deleteVehicle(row)}><Trash2 size={14}/> حذف</button></div>}
    {tab==='promotions'&&<div className="flex flex-wrap gap-2"><button className={btn+' border-blue-200 text-blue-700'} disabled={row.payment_status==='verified'} onClick={()=>void setPromotionPaymentStatus(row,'verified')}>تأكيد دفع الإعلان</button><button className={btn+' border-amber-200 text-amber-700'} disabled={row.payment_status==='rejected'} onClick={()=>void setPromotionPaymentStatus(row,'rejected')}>رفض إثبات الدفع</button><button className={btn+' border-emerald-200 text-emerald-700'} disabled={row.status==='approved'||(row.payment_status!=='verified'&&row.payment_status!=='waived')} onClick={()=>void setPromotionStatus(row,'approved')}><CheckCircle2 size={14}/> اعتماد الإعلان</button><button className={btn+' border-red-200 text-red-700'} disabled={row.status==='rejected'} onClick={()=>void setPromotionStatus(row,'rejected')}><XCircle size={14}/> رفض الطلب</button></div>}
    {tab==='requests'&&<div className="flex flex-wrap gap-2"><button className={btn+' border-blue-200 text-blue-700'} onClick={()=>void setRequestStatus(row,'open')}>فتح الطلب</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void setRequestStatus(row,'closed')}>إغلاق الطلب</button><button className={btn+' border-amber-200 text-amber-700'} onClick={()=>void setRequestStatus(row,'cancelled')}>إلغاء الطلب</button></div>}
    {tab==='offers'&&<div className="flex flex-wrap gap-2"><button className={btn+' border-emerald-200 text-emerald-700'} onClick={()=>void setOfferStatus(row,'accepted')}>قبول العرض</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void setOfferStatus(row,'rejected')}>رفض العرض</button><button className={btn+' border-amber-200 text-amber-700'} onClick={()=>void setOfferStatus(row,'submitted')}>إعادة للمراجعة</button></div>}
    {tab==='payments'&&<div className="flex flex-wrap gap-2"><button className={btn+' border-emerald-200 text-emerald-700'} disabled={row.review_status==='approved'} onClick={()=>void setPaymentStatus(row,'approved')}><CheckCircle2 size={14}/> اعتماد التحويل</button><button className={btn+' border-red-200 text-red-700'} disabled={row.review_status==='rejected'} onClick={()=>void setPaymentStatus(row,'rejected')}><XCircle size={14}/> رفض التحويل</button></div>}</div>
    {tab==='vehicles'&&editing?.id===row.id&&<div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
      {(['make','model','model_year','vehicle_type','transmission','seats','governorate','address','monthly_price_egp','yearly_price_egp','notes'] as const).map(key=><label key={key} className="text-xs font-bold text-slate-600">{({make:'الماركة',model:'الموديل',model_year:'سنة الصنع',vehicle_type:'نوع السيارة',transmission:'ناقل الحركة',seats:'عدد المقاعد',governorate:'المحافظة',address:'العنوان',monthly_price_egp:'السعر الشهري (ج.م)',yearly_price_egp:'السعر السنوي (ج.م)',notes:'ملاحظات السيارة'} as Record<string,string>)[key]}<input type={['model_year','seats','monthly_price_egp','yearly_price_egp'].includes(key)?'number':'text'} min={['model_year','seats','monthly_price_egp','yearly_price_egp'].includes(key)?'0':undefined} className={field+' mt-1'} value={editing?.[key]??''} onChange={e=>setEditing(current=>current?({...current,[key]:e.target.value}):current)}/></label>)}
      <label className="flex items-center gap-2 rounded-lg border p-3 text-xs font-bold"><input type="checkbox" checked={Boolean(editing?.with_driver)} onChange={e=>setEditing(current=>current?({...current,with_driver:e.target.checked}):current)}/> متاحة بسائق</label>
      <label className="flex items-center gap-2 rounded-lg border p-3 text-xs font-bold"><input type="checkbox" checked={Boolean(editing?.has_gps)} onChange={e=>setEditing(current=>current?({...current,has_gps:e.target.checked}):current)}/> مزودة بـ GPS</label>
      <div className="flex items-end gap-2"><button className={btn+' bg-blue-700 text-white'} disabled={saving} onClick={()=>void saveVehicle()}><Save size={14}/> حفظ بيانات السيارة</button><button className={btn} onClick={()=>setEditing(null)}>إلغاء</button></div>
    </div>}
    {tab==='accounts'&&editing?.id===row.id&&<div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">{(['name','contact_name','phone','contact_email','city','address','company_type','fleet_vehicle_count'] as const).map(key=><label key={key} className="text-xs font-bold text-slate-600">{({name:'اسم المؤسسة',contact_name:'اسم المسؤول',phone:'الهاتف',contact_email:'البريد الإلكتروني',city:'المحافظة / المدينة',address:'العنوان',company_type:'نوع النشاط',fleet_vehicle_count:'عدد سيارات الأسطول'} as Record<string,string>)[key]}<input className={field+' mt-1'} value={editing?.[key]??''} onChange={e=>setEditing(current=>current?({...current,[key]:e.target.value}):current)}/></label>)}<div className="flex items-end gap-2"><button className={btn+' bg-blue-700 text-white'} disabled={saving} onClick={()=>void saveAccount()}><Save size={14}/> حفظ</button><button className={btn} onClick={()=>setEditing(null)}>إلغاء</button></div></div>}
    </article>)}</div>}</section>}
    <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">حالة اعتماد الشركات والملاك وموردي الأساطيل مستقلة الآن، والحسابات القديمة حُفظت كمعتمدة للحفاظ على استمرارية استخدامها. لا يمكن اعتماد إعلان قبل تأكيد الدفع بشكل منفصل. عمليات الإدارة تخضع لصلاحيات قاعدة البيانات، وأي رفض يظهر للمسؤول.</p>
  </div></main>
}