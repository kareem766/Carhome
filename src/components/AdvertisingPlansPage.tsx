import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, CalendarDays, Check, CircleHelp, LoaderCircle, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Plan = { id: string; name: string; description: string; duration_days: number; price_egp: number; features: string[]; display_order: number }
type Vehicle = { id: string; make: string; model: string; model_year: number }

const money = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value || 0))
const field = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-600'

export default function AdvertisingPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('إعدادات المنصة غير مكتملة.'); setLoading(false); return }
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) { window.location.replace('/?login=1'); return }
      const { data: membership, error: memberError } = await supabase.from('organization_memberships').select('organization_id,organizations(organization_type)').eq('user_id', auth.user.id).limit(1).maybeSingle()
      if (memberError || !membership?.organization_id) { if (active) { setError('أكمل إعداد حسابك وربطه بمؤسسة لعرض الباقات وطلب الترويج.'); setLoading(false) } return }
      const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations
      const [plansResult, vehiclesResult] = await Promise.all([
        supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features,display_order').eq('is_active', true).order('display_order').order('created_at'),
        supabase.from('vehicles').select('id,make,model,model_year').eq('organization_id', membership.organization_id).eq('review_status', 'approved').order('created_at', { ascending: false })
      ])
      if (!active) return
      if (plansResult.error) setError('تعذر تحميل الباقات: ' + plansResult.error.message)
      setPlans((plansResult.data || []) as Plan[])
      setVehicles((vehiclesResult.data || []) as Vehicle[])
      setOrganizationId(membership.organization_id)
      setUserId(auth.user.id)
      setRole(String(org?.organization_type || ''))
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function submitRequest() {
    if (!supabase || !selectedPlan || !selectedVehicle || !organizationId || !userId) return
    setSubmitting(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('vehicle_promotions').insert({
      vehicle_id: selectedVehicle, organization_id: organizationId, advertising_plan_id: selectedPlan,
      created_by: userId, status: 'pending_review', payment_status: 'pending'
    })
    setSubmitting(false)
    if (insertError) { setError('تعذر إرسال طلب الترويج: ' + insertError.message); return }
    setNotice('تم إرسال طلب الترويج بنجاح. سيظهر الإعلان بعد مراجعة الإدارة والتحقق من الدفع يدويًا.')
    setSelectedPlan(''); setSelectedVehicle('')
  }

  const canPromote = role === 'individual_owner' || role === 'fleet_supplier'

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <PlatformBrand />
        <a href="/workspace/catalog" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold"><ArrowRight size={17}/> العودة للكتالوج</a>
      </div>
    </header>
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,.4),transparent_40%),radial-gradient(circle_at_85%_90%,rgba(245,158,11,.18),transparent_35%)]"/>
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-blue-100"><Sparkles size={15}/> باقات إعلانية قابلة للتخصيص</span>
        <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">خلّي سيارتك تظهر بشكل أوضح <span className="text-amber-300">للشركات الباحثة عن التأجير.</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">اختار الباقة المناسبة من الباقات التي تعتمدها إدارة Carhome. السعر والمدة والمميزات المعروضة هنا يتم تحديثها مباشرة من لوحة التحكم.</p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-slate-200"><span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3"><BadgeCheck size={17}/> مراجعة واعتماد قبل الظهور</span><span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3"><CalendarDays size={17}/> مدة واضحة لكل باقة</span></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">اختياراتك الإعلانية</p><h2 className="mt-1 text-2xl font-black">استكشف الباقات</h2><p className="mt-2 text-sm text-slate-500">لا يتم تفعيل الترويج قبل اعتماد الإدارة وتأكيد الدفع يدويًا.</p></div><span className="rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-slate-200">{plans.length} باقة متاحة</span></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
      {loading ? <div className="py-16 text-center text-slate-500"><LoaderCircle className="mx-auto animate-spin" size={28}/><p className="mt-3">جارٍ تحميل الباقات...</p></div> :
        plans.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto text-blue-700" size={36}/><h3 className="mt-4 text-lg font-extrabold">لا توجد باقات منشورة حاليًا</h3><p className="mt-2 text-sm leading-7 text-slate-500">تُعرض الباقات هنا فور تفعيلها من لوحة تحكم المنصة.</p></div> :
        <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan, index) => <article key={plan.id} className={'relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl '+(index===0?'border-blue-300 ring-2 ring-blue-100':'border-slate-200')}>
          {index===0 && <span className="absolute -top-3 right-5 rounded-full bg-blue-700 px-3 py-1 text-xs font-extrabold text-white">اختيار مميز</span>}
          <h3 className="text-xl font-black">{plan.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{plan.description || 'باقة لإبراز سيارتك في كتالوج Carhome.'}</p>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">سعر الباقة</p><p className="mt-1 text-3xl font-black text-blue-800">{money(plan.price_egp)} <span className="text-sm">ج.م</span></p><p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-600"><CalendarDays size={16}/> مدة الظهور {plan.duration_days} يومًا</p></div>
          <ul className="mt-5 flex-1 space-y-3">{(Array.isArray(plan.features)?plan.features:[]).map(feature=><li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-700"><Check size={17} className="mt-1 shrink-0 text-emerald-600"/><span>{feature}</span></li>)}</ul>
          {canPromote ? <button onClick={()=>{setSelectedPlan(plan.id);setNotice('');setError('')}} className="mt-6 min-h-12 rounded-xl bg-blue-700 px-4 font-extrabold text-white hover:bg-blue-800">{selectedPlan===plan.id?'تم اختيار الباقة':'اختيار الباقة'}</button> : <p className="mt-6 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">طلب الترويج متاح لملاك السيارات وموردي الأساطيل.</p>}
          {selectedPlan===plan.id && canPromote && <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4"><label className="block text-sm font-bold">اختر سيارة معتمدة<select value={selectedVehicle} onChange={e=>setSelectedVehicle(e.target.value)} className={field}><option value="">اختر السيارة</option>{vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.model_year}</option>)}</select></label>{vehicles.length===0 && <p className="mt-2 text-xs leading-6 text-slate-600">لا توجد سيارة معتمدة في حسابك. أضف سيارة وانتظر اعتمادها قبل طلب الترويج.</p>}<button disabled={!selectedVehicle||submitting||vehicles.length===0} onClick={()=>void submitRequest()} className="mt-3 min-h-12 w-full rounded-xl bg-slate-950 px-4 font-extrabold text-white disabled:opacity-50">{submitting?'جارٍ إرسال الطلب...':'إرسال طلب الترويج'}</button></div>}
        </article>)}</div>}
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950"><CircleHelp size={19} className="mt-1 shrink-0"/><p><strong>معلومة مهمة:</strong> إرسال الطلب لا يعني تفعيل الإعلان تلقائيًا. تراجع الإدارة الطلب، ثم تؤكد الدفع يدويًا بعد التحقق الفعلي من التحويل.</p></div>
    </section>
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">Carhome · باقات الظهور الإعلاني</footer>
  </main>
}
