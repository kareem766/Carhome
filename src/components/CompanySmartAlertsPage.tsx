import { useEffect, useState, type FormEvent } from 'react'
import { BellRing, CheckCircle2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import CompanyPageSidebar from './CompanyPageSidebar'
import PlatformBrand from './PlatformBrand'
import PlanUpgradeNotice from './PlanUpgradeNotice'

type AlertRow={id:string;governorate:string|null;vehicle_type:string|null;with_driver:boolean|null;is_active:boolean;created_at:string}
const field='mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm'
const governorates=['القاهرة','الجيزة','الإسكندرية','الشرقية','الغربية','الدقهلية','البحيرة','المنوفية','القليوبية','بورسعيد','السويس','أسيوط','المنيا','سوهاج','قنا','الأقصر','أسوان','دمياط','كفر الشيخ','مطروح','شمال سيناء','جنوب سيناء','بني سويف','الفيوم','الوادي الجديد','الإسماعيلية']
export default function CompanySmartAlertsPage(){
 const [orgId,setOrgId]=useState('')
 const [role,setRole]=useState('')
 const [rows,setRows]=useState<AlertRow[]>([])
 const [enabled,setEnabled]=useState(false)
 const [governorate,setGovernorate]=useState('')
 const [vehicleType,setVehicleType]=useState('')
 const [driver,setDriver]=useState('any')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function load(){
  if(!supabase){setError('تعذر الاتصال بالمنصة.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user){window.location.replace('/?login=1');return}
  const {data:member,error:memberError}=await supabase.from('organization_memberships').select('organization_id,role,organizations!inner(organization_type)').eq('user_id',user.id).eq('organizations.organization_type','company').limit(1).maybeSingle()
  if(memberError||!member?.organization_id){setError('لم نتمكن من تحديد الشركة المرتبطة بحسابك.');setLoading(false);return}
  setOrgId(member.organization_id);setRole(member.role)
  const {data:feature,error:featureError}=await supabase.rpc('company_has_plan_feature',{p_organization_id:member.organization_id,p_feature:'smart_alerts'})
  if(featureError){setError('تعذر التحقق من صلاحية التنبيهات الذكية: '+featureError.message);setLoading(false);return}
  setEnabled(feature===true)
  const {data,error:queryError}=await supabase.from('company_vehicle_alerts').select('id,governorate,vehicle_type,with_driver,is_active,created_at').eq('organization_id',member.organization_id).order('created_at',{ascending:false})
  if(queryError)setError('تعذر تحميل التنبيهات: '+queryError.message)
  else setRows((data||[]) as AlertRow[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[])
 async function add(e:FormEvent){
  e.preventDefault();if(!supabase||!orgId||saving)return
  if(!enabled){setError('التنبيهات الذكية متاحة ضمن الباقة الاحترافية وباقة المؤسسات.');return}
  setSaving(true);setError('');setNotice('')
  const {data:{user}}=await supabase.auth.getUser()
  const {error:e}=await supabase.from('company_vehicle_alerts').insert({organization_id:orgId,created_by:user?.id,governorate:governorate||null,vehicle_type:vehicleType||null,with_driver:driver==='any'?null:driver==='yes',is_active:true})
  setSaving(false)
  if(e){setError(e.message.includes('row-level security')?'هذه الميزة غير متاحة في باقتك الحالية. يمكنك الترقية لتفعيلها.':e.message);return}
  setNotice('تم حفظ التنبيه. سنرسل إشعارًا لأعضاء الشركة عند اعتماد سيارة تطابق شروط البحث.')
  setGovernorate('');setVehicleType('');setDriver('any');await load()
 }
 async function remove(id:string){
  if(!supabase||!window.confirm('هل تريد حذف التنبيه المحدد؟'))return
  const {error:e}=await supabase.from('company_vehicle_alerts').delete().eq('id',id)
  if(e){setError('تعذر حذف التنبيه: '+e.message);return}
  setNotice('تم حذف التنبيه.');await load()
 }
 return <><CompanyPageSidebar active="alerts"/><main dir="rtl" className="mc-company-page-with-sidebar min-h-screen bg-slate-50 px-4 py-7 text-slate-900 sm:px-6"><div className="mx-auto max-w-5xl">
  <header className="rounded-3xl border bg-white p-5 shadow-sm"><PlatformBrand compact/><div className="mt-3 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><BellRing/></span><div><h1 className="text-2xl font-black">التنبيهات الذكية للسيارات المطابقة</h1><p className="mt-1 text-sm leading-6 text-slate-500">حدد نوع السيارة والمحافظة، وسنرسل إشعارًا عند اعتماد سيارة جديدة تطابق بحث شركتك.</p></div></div></header>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
  {!loading&&!enabled&&<div className="mt-5"><PlanUpgradeNotice title="التنبيهات الذكية ضمن الباقات الأعلى" message="تتوفر هذه الميزة في الباقة الاحترافية وباقة المؤسسات. يمكنك ترقية اشتراك الشركة لتفعيل تنبيهات السيارات المطابقة تلقائيًا."/></div>}
  {loading?<p className="py-12 text-center text-slate-500">جارٍ تحميل إعدادات التنبيهات...</p>:<><form onSubmit={e=>void add(e)} className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-black">إضافة تنبيه جديد</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">المحافظة<select value={governorate} onChange={e=>setGovernorate(e.target.value)} className={field}><option value="">كل المحافظات</option>{governorates.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm font-bold">نوع السيارة<select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className={field}><option value="">كل الأنواع</option><option value="سيدان">سيدان</option><option value="SUV">SUV</option><option value="فان">فان</option><option value="ميكروباص">ميكروباص</option><option value="نقل">نقل</option><option value="أتوبيس">أتوبيس</option><option value="أخرى">أخرى</option></select></label><label className="text-sm font-bold">السائق<select value={driver} onChange={e=>setDriver(e.target.value)} className={field}><option value="any">بأي حالة</option><option value="yes">بسائق</option><option value="no">بدون سائق</option></select></label></div><button disabled={!enabled||saving||role!=='owner'} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white disabled:opacity-50"><Plus size={17}/>{saving?'جارٍ الحفظ...':'حفظ التنبيه'}</button>{role!=='owner'&&<p className="mt-2 text-xs text-amber-700">إدارة التنبيهات متاحة لمالك الشركة فقط.</p>}</form>
  <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-black">تنبيهات شركتك ({rows.length})</h2><button onClick={()=>void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold"><RefreshCw size={15}/> تحديث</button></div>{rows.length===0?<p className="py-8 text-center text-sm text-slate-500">لم تضف أي تنبيهات حتى الآن.</p>:<div className="mt-3 space-y-3">{rows.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><strong>{row.vehicle_type||'كل أنواع السيارات'}</strong><p className="mt-1 text-sm text-slate-500">{row.governorate||'كل المحافظات'} · {row.with_driver===null?'بأي حالة سائق':row.with_driver?'بسائق':'بدون سائق'}</p><p className="mt-1 text-xs text-slate-400">تم الإنشاء: {new Date(row.created_at).toLocaleDateString('ar-EG')}</p></div><button onClick={()=>void remove(row.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700"><Trash2 size={15}/> حذف</button></article>)}</div>}</section></>}
 </div></main></>
}
