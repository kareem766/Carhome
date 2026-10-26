import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw, Search, CheckCircle2, XCircle, Save, Trash2, Building2, CarFront, Banknote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Tab = 'accounts' | 'vehicles' | 'payments'
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
    if(tab==='accounts') result=await supabase.from('organizations').select('id,name,organization_type,contact_name,phone,contact_email,city,address,company_type,fleet_vehicle_count,created_at').order('created_at',{ascending:false}).limit(300)
    else if(tab==='vehicles') result=await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,yearly_price_egp,review_status,payment_status,created_at,organization_id').order('created_at',{ascending:false}).limit(300)
    else result=await supabase.from('vehicle_payment_submissions').select('id,vehicle_id,organization_id,amount_egp,review_status,transfer_reference,created_at,reviewed_at').order('created_at',{ascending:false}).limit(300)
    if(result.error){setError('تعذر تحميل البيانات: '+result.error.message);setRows([])}else setRows(result.data||[])
    setLoading(false)
  }
  useEffect(()=>{void load()},[tab])
  async function saveAccount(){
    if(!supabase||!editing)return
    setSaving(true);setError('');setNotice('')
    const payload={name:String(editing.name||'').trim(),contact_name:editing.contact_name||null,phone:editing.phone||null,contact_email:editing.contact_email||null,city:editing.city||null,address:editing.address||null,company_type:editing.company_type||null,fleet_vehicle_count:editing.fleet_vehicle_count===''?null:Number(editing.fleet_vehicle_count)}
    const {error:e}=await supabase.from('organizations').update(payload).eq('id',editing.id)
    setSaving(false)
    if(e){setError('تعذر حفظ الحساب. قد تمنع سياسات قاعدة البيانات هذا التعديل: '+e.message);return}
    setNotice('تم حفظ بيانات الحساب.');setEditing(null);await load()
  }
  async function setVehicleStatus(row:Row,status:string){
    if(!supabase)return
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
    setNotice(status==='approved'?'تم اعتماد التحويل.':'تم رفض التحويل.');await load()
  }
  async function deleteVehicle(row:Row){
    if(!supabase||!window.confirm('حذف السيارة نهائيًا؟ قد تكون مرتبطة بطلبات أو صور؛ إذا رفضت قاعدة البيانات الحذف فلن يتم تجاوز القيود.'))return
    const {error:e}=await supabase.from('vehicles').delete().eq('id',row.id)
    if(e){setError('تعذر حذف السيارة: '+e.message);return}
    setNotice('تم حذف السيارة.');await load()
  }
  const visible=rows.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())))
  const tabs=[{id:'accounts' as const,label:'الحسابات والمؤسسات',icon:Building2},{id:'vehicles' as const,label:'السيارات',icon:CarFront},{id:'payments' as const,label:'تحويلات الرسوم',icon:Banknote}]
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 sm:px-6"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"><div><PlatformBrand compact/><h1 className="mt-2 text-2xl font-black">إدارة الحسابات والسيارات والتحويلات</h1><p className="mt-1 text-sm text-slate-500">مراجعة البيانات وتحديث الحالات من شاشة واحدة.</p></div><div className="flex gap-2"><button className={btn} onClick={()=>void load()}><RefreshCw size={15}/> تحديث</button><a href="/workspace/admin/dashboard" className={btn}><ArrowRight size={15}/> لوحة التحكم</a></div></header>
    {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</div>}{notice&&<div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    <div className="mt-5 grid gap-2 sm:grid-cols-3">{tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setEditing(null);setSearch('')}} className={'flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-extrabold '+(tab===t.id?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-white text-slate-700')}><t.icon size={18}/>{t.label}</button>)}</div>
    {authorized&&<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">{tabs.find(t=>t.id===tab)?.label}</h2><p className="mt-1 text-sm text-slate-500">{visible.length} سجل ظاهر (حتى 300 سجل في القائمة).</p></div><label className="relative w-full sm:max-w-sm"><Search size={16} className="absolute right-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className={field+' pr-9'} placeholder="بحث في السجلات..."/></label></div>
    {loading?<p className="py-12 text-center text-slate-500">جارٍ تحميل البيانات...</p>:visible.length===0?<p className="py-12 text-center text-slate-500">لا توجد سجلات مطابقة.</p>:<div className="mt-4 space-y-3">{visible.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-extrabold">{tab==='accounts'?fmt(row.name):tab==='vehicles'?fmt(row.make)+' '+fmt(row.model)+' ('+fmt(row.model_year)+')':'تحويل رسوم · '+fmt(row.amount_egp)+' جنيه'}</h3><p className="mt-1 break-all text-xs leading-6 text-slate-500">{tab==='accounts'?fmt(row.organization_type)+' · '+fmt(row.contact_name)+' · '+fmt(row.phone)+' · '+fmt(row.contact_email):tab==='vehicles'?'المحافظة: '+fmt(row.governorate)+' · النوع: '+fmt(row.vehicle_type)+' · '+fmt(row.monthly_price_egp)+' ج/شهر · الدفع: '+fmt(row.payment_status):'السيارة: '+fmt(row.vehicle_id)+' · المرجع: '+fmt(row.transfer_reference)+' · تاريخ الإرسال: '+fmt(row.created_at)}</p><p className="mt-1 text-xs font-bold text-slate-600">الحالة: {fmt(tab==='accounts'?'حساب مسجل':tab==='vehicles'?row.review_status:row.review_status)}</p></div>
    {tab==='accounts'&&<button className={btn} onClick={()=>setEditing(editing?.id===row.id?null:{...row})}><Save size={14}/> تعديل البيانات</button>}
    {tab==='vehicles'&&<div className="flex flex-wrap gap-2"><button className={btn+' border-emerald-200 text-emerald-700'} onClick={()=>void setVehicleStatus(row,'approved')}><CheckCircle2 size={14}/> اعتماد</button><button className={btn+' border-amber-200 text-amber-700'} onClick={()=>void setVehicleStatus(row,'paused')}>إيقاف</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void setVehicleStatus(row,'rejected')}><XCircle size={14}/> رفض</button><button className={btn+' border-red-200 text-red-700'} onClick={()=>void deleteVehicle(row)}><Trash2 size={14}/> حذف</button></div>}
    {tab==='payments'&&<div className="flex flex-wrap gap-2"><button className={btn+' border-emerald-200 text-emerald-700'} disabled={row.review_status==='approved'} onClick={()=>void setPaymentStatus(row,'approved')}><CheckCircle2 size={14}/> اعتماد التحويل</button><button className={btn+' border-red-200 text-red-700'} disabled={row.review_status==='rejected'} onClick={()=>void setPaymentStatus(row,'rejected')}><XCircle size={14}/> رفض التحويل</button></div>}</div>
    {tab==='accounts'&&editing?.id===row.id&&<div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">{(['name','contact_name','phone','contact_email','city','address','company_type','fleet_vehicle_count'] as const).map(key=><label key={key} className="text-xs font-bold text-slate-600">{({name:'اسم المؤسسة',contact_name:'اسم المسؤول',phone:'الهاتف',contact_email:'البريد الإلكتروني',city:'المحافظة / المدينة',address:'العنوان',company_type:'نوع النشاط',fleet_vehicle_count:'عدد سيارات الأسطول'} as Record<string,string>)[key]}<input className={field+' mt-1'} value={editing[key]??''} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}<div className="flex items-end gap-2"><button className={btn+' bg-blue-700 text-white'} disabled={saving} onClick={()=>void saveAccount()}><Save size={14}/> حفظ</button><button className={btn} onClick={()=>setEditing(null)}>إلغاء</button></div></div>}
    </article>)}</div>}</section>}
    <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">ملاحظة: حالات اعتماد الحسابات نفسها غير موجودة حاليًا في مخطط قاعدة البيانات؛ هذه الشاشة تتيح تعديل بيانات المؤسسة، لكنها لا تعرض اعتمادًا وهميًا للحسابات. عمليات التعديل تعتمد على سياسات RLS الفعلية، وأي رفض من قاعدة البيانات سيظهر هنا بدل تجاوز الحماية.</p>
  </div></main>
}