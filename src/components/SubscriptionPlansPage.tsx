import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, LoaderCircle, Plus, Save, Star, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Plan = {
  id: string; name: string; slug: string; description: string; monthly_price: number; yearly_price: number;
  currency: string; trial_days: number; features: string[]; limits: Record<string, unknown>;
  display_order: number; is_active: boolean; is_popular: boolean
}
type PlanForm = Omit<Plan,'id'> & { id?: string }
const blank: PlanForm = { name:'', slug:'', description:'', monthly_price:0, yearly_price:0, currency:'EGP', trial_days:0, features:[], limits:{}, display_order:0, is_active:true, is_popular:false }
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
const label = 'block text-sm font-bold text-slate-700'
const money = (value:number,currency:string) => new Intl.NumberFormat('ar-EG',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value)||0)

export default function SubscriptionPlansPage() {
  const [plans,setPlans]=useState<Plan[]>([])
  const [form,setForm]=useState<PlanForm>(blank)
  const [featuresText,setFeaturesText]=useState('')
  const [limitsText,setLimitsText]=useState('{}')
  const [loading,setLoading]=useState(true)
  const [authorized,setAuthorized]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  async function loadPlans() {
    if(!supabase) { setError('إعدادات قاعدة البيانات غير مكتملة.'); setLoading(false); return }
    const {data,error:loadError}=await supabase.from('platform_subscription_plans').select('*').order('display_order').order('created_at')
    if(loadError) setError('تعذر تحميل باقات الاشتراك: '+loadError.message)
    else setPlans((data||[]) as Plan[])
    setLoading(false)
  }
  useEffect(()=>{
    let active=true
    async function init(){
      if(!supabase){if(active){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false)}return}
      const {data:auth}=await supabase.auth.getUser()
      if(!auth.user){window.location.replace('/?login=1');return}
      const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
      if(!active)return
      if(adminError||!admin){setError('هذه الصفحة متاحة لصاحب المنصة فقط.');setLoading(false);return}
      setAuthorized(true)
      await loadPlans()
    }
    void init()
    return ()=>{active=false}
  },[])
  function startEdit(plan?:Plan){
    const next=plan?{...plan,monthly_price:Number(plan.monthly_price),yearly_price:Number(plan.yearly_price),features:Array.isArray(plan.features)?plan.features:[],limits:plan.limits&&typeof plan.limits==='object'?plan.limits:{}}:{...blank}
    setForm(next)
    setFeaturesText(next.features.join('\n'))
    setLimitsText(JSON.stringify(next.limits,null,2))
    setError('');setNotice('')
    window.scrollTo({top:0,behavior:'smooth'})
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!supabase||!authorized)return
    let limits:Record<string,unknown>
    try{const parsed=JSON.parse(limitsText||'{}');if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error();limits=parsed}
    catch{setError('صيغة حدود الباقة غير صحيحة. أدخل JSON صالحًا على هيئة كائن، مثل {"cars":10}.');return}
    const slug=form.slug.trim().toLowerCase()
    if(!/^[a-z0-9-]{2,100}$/.test(slug)){setError('المعرّف يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.');return}
    const features=featuresText.split('\n').map(s=>s.trim()).filter(Boolean)
    setSaving(true);setError('');setNotice('')
    const {data:auth}=await supabase.auth.getUser()
    const payload={name:form.name.trim(),slug,description:form.description.trim(),monthly_price:Number(form.monthly_price),yearly_price:Number(form.yearly_price),currency:form.currency.toUpperCase(),trial_days:Number(form.trial_days),features,limits,display_order:Number(form.display_order),is_active:form.is_active,is_popular:form.is_popular,updated_at:new Date().toISOString(),updated_by:auth.user?.id||null}
    const result=form.id
      ? await supabase.from('platform_subscription_plans').update(payload).eq('id',form.id)
      : await supabase.from('platform_subscription_plans').insert(payload)
    setSaving(false)
    if(result.error){setError('تعذر حفظ الباقة: '+result.error.message);return}
    setNotice(form.id?'تم تحديث الباقة بنجاح.':'تمت إضافة الباقة بنجاح.')
    setForm({...blank});setFeaturesText('');setLimitsText('{}')
    await loadPlans()
  }
  async function deactivate(plan:Plan){
    if(!supabase||!authorized)return
    if(!window.confirm('هل تريد إيقاف عرض باقة «'+plan.name+'»؟ لن يتم حذف بياناتها.'))return
    const {error:e}=await supabase.from('platform_subscription_plans').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',plan.id)
    if(e){setError('تعذر إيقاف الباقة: '+e.message);return}
    setNotice('تم إيقاف عرض الباقة دون حذفها.')
    await loadPlans()
  }
  const set=<K extends keyof PlanForm>(key:K,value:PlanForm[K])=>setForm(current=>({...current,[key]:value}))
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5">
      <div><PlatformBrand compact /><h1 className="mt-1 text-2xl font-extrabold text-slate-900">إدارة أسعار وباقات الاشتراك</h1><p className="mt-2 text-sm leading-6 text-slate-500">تحكم في السعر الشهري والسنوي، التجربة المجانية، المميزات، الحدود، وترتيب وظهور كل باقة.</p></div>
      <a href="/workspace/admin" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><ArrowRight size={17}/> العودة للإدارة</a>
    </header>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}
    {notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
    {authorized&&<form onSubmit={e=>void save(e)} className="mt-5 rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">{form.id?'تعديل باقة':'إضافة باقة اشتراك'}</h2><p className="mt-1 text-sm text-slate-500">الأسعار بالجنيه المصري افتراضيًا؛ يمكنك تغيير العملة.</p></div>{form.id&&<button type="button" onClick={()=>startEdit()} className="rounded-lg border px-3 py-2 text-sm font-bold">باقة جديدة</button>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>اسم الباقة *<input required maxLength={100} value={form.name} onChange={e=>set('name',e.target.value)} className={field} placeholder="مثال: احترافي"/></label>
        <label className={label}>معرّف الباقة *<input required pattern="[a-z0-9-]{2,100}" value={form.slug} onChange={e=>set('slug',e.target.value.toLowerCase())} className={field} placeholder="professional"/></label>
        <label className={label}>العملة<input required maxLength={3} minLength={3} pattern="[A-Za-z]{3}" value={form.currency} onChange={e=>set('currency',e.target.value.toUpperCase())} className={field}/></label>
        <label className={label}>السعر الشهري *<input required type="number" min="0" step="0.01" value={form.monthly_price} onChange={e=>set('monthly_price',Number(e.target.value))} className={field}/></label>
        <label className={label}>السعر السنوي *<input required type="number" min="0" step="0.01" value={form.yearly_price} onChange={e=>set('yearly_price',Number(e.target.value))} className={field}/></label>
        <label className={label}>مدة التجربة المجانية (يوم)<input required type="number" min="0" max="365" value={form.trial_days} onChange={e=>set('trial_days',Number(e.target.value))} className={field}/></label>
        <label className={label}>ترتيب العرض<input type="number" value={form.display_order} onChange={e=>set('display_order',Number(e.target.value))} className={field}/></label>
        <label className={label+' lg:col-span-2'}>وصف الباقة<input maxLength={1000} value={form.description} onChange={e=>set('description',e.target.value)} className={field}/></label>
        <label className={label+' sm:col-span-2 lg:col-span-3'}>مميزات الباقة (ميزة واحدة بكل سطر)<textarea rows={4} value={featuresText} onChange={e=>setFeaturesText(e.target.value)} className={field} placeholder={'إدارة السيارات\nطلبات التأجير\nتقارير الأداء'}/></label>
        <label className={label+' sm:col-span-2 lg:col-span-3'}>حدود الاستخدام بصيغة JSON<textarea rows={3} value={limitsText} onChange={e=>setLimitsText(e.target.value)} className={field} placeholder='{"cars":10,"users":5}'/></label>
        <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-bold"><input type="checkbox" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)} className="h-4 w-4"/>الباقة ظاهرة للعملاء</label>
        <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-bold"><input type="checkbox" checked={form.is_popular} onChange={e=>set('is_popular',e.target.checked)} className="h-4 w-4"/>تمييز كالباقة الأكثر شيوعًا</label>
      </div>
      <div className="mt-5 flex justify-end"><button disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-50"><Save size={18}/>{saving?'جارٍ الحفظ...':form.id?'حفظ تعديلات الباقة':'إضافة الباقة'}</button></div>
    </form>}
    <section className="mt-6"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">الباقات الحالية</h2><button type="button" onClick={()=>void loadPlans()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">تحديث القائمة</button></div>
      {loading?<div className="flex justify-center py-12 text-slate-500"><LoaderCircle className="animate-spin"/> جاري تحميل الباقات...</div>:plans.length===0?<div className="rounded-2xl border border-dashed bg-white p-8 text-center"><p className="font-extrabold">لا توجد باقات مسجلة حتى الآن</p><p className="mt-2 text-sm leading-7 text-slate-500">أضف أول باقة من النموذج أعلاه. لن يتم افتراض أسعار أو خطط غير معتمدة.</p><button onClick={()=>startEdit()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white"><Plus size={17}/> إضافة أول باقة</button></div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map(plan=><article key={plan.id} className={'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg '+(!plan.is_active?'opacity-65':'')}>
        <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold">{plan.name}</h3>{plan.is_popular&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800"><Star size={13}/> الأكثر شيوعًا</span>}</div><p className="mt-1 text-xs text-slate-500">{plan.slug} · {plan.is_active?'ظاهرة':'موقوفة'}</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">#{plan.display_order}</span></div>
        <p className="mt-4 text-2xl font-extrabold text-blue-700">{money(plan.monthly_price,plan.currency)}<span className="text-sm font-medium text-slate-500"> / شهريًا</span></p><p className="mt-1 text-lg font-bold">{money(plan.yearly_price,plan.currency)}<span className="text-sm font-medium text-slate-500"> / سنويًا</span></p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description||'لا يوجد وصف.'}</p><p className="mt-2 text-xs text-slate-500">تجربة مجانية: {plan.trial_days} يومًا</p>
        {plan.features?.length>0&&<ul className="mt-3 space-y-2">{plan.features.slice(0,5).map((feature,i)=><li key={i} className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 text-emerald-600"/>{feature}</li>)}</ul>}
        <div className="mt-5 flex gap-2"><button onClick={()=>startEdit(plan)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><Save size={15}/> تعديل الباقة</button>{plan.is_active&&<button onClick={()=>void deactivate(plan)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700"><X size={15}/> إيقاف</button>}</div>
      </article>)}</div>}
    </section>
    <p className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-900">تنبيه: هذه الشاشة تدير كتالوج الباقات وأسعارها. لم يكن في قاعدة المنصة الحالية جدول اشتراكات أو نظام تحصيل مرتبط بالباقات؛ لذلك لن يتم خصم أي مبلغ أو تغيير اشتراكات العملاء تلقائيًا من هذه الشاشة.</p>
  </div></main>
}
