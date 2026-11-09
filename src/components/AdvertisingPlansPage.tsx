import { useEffect, useState } from 'react'
import { BadgeCheck, Check, CircleDollarSign, Clock3, LoaderCircle, Megaphone, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Plan = { id:string; name:string; description:string; duration_days:number; price_egp:number; features:string[]; display_order:number; placement_type:'standard'|'premium' }
type Vehicle = { id:string; make:string; model:string; model_year:number }
const money=(value:number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(value)

export default function AdvertisingPlansPage(){
  const premiumOnly=new URLSearchParams(window.location.search).get('placement')==='premium'
  const [plans,setPlans]=useState<Plan[]>([])
  const [vehicles,setVehicles]=useState<Vehicle[]>([])
  const [selectedPlan,setSelectedPlan]=useState<Plan|null>(null)
  const [vehicleId,setVehicleId]=useState('')
  const [paymentMethod,setPaymentMethod]=useState('instapay')
  const [paymentReference,setPaymentReference]=useState('')
  const [paymentDate,setPaymentDate]=useState(new Date().toISOString().slice(0,10))
  const [couponCode,setCouponCode]=useState('')
  const [couponPreview,setCouponPreview]=useState<{code:string;original_amount_egp:number;discount_amount_egp:number;final_amount_egp:number}|null>(null)
  const [couponLoading,setCouponLoading]=useState(false)
  const [paymentInfo,setPaymentInfo]=useState({instapay_number:'',vodafone_cash_number:''})
  const [userId,setUserId]=useState('')
  const [orgId,setOrgId]=useState('')
  const [loading,setLoading]=useState(true)
  const [sending,setSending]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [paymentDue,setPaymentDue]=useState<number|null>(null)
  const [promotionMode,setPromotionMode]=useState<'new'|'pending-upgrade'|'queued'|'duplicate'|'invalid'>('new')
  const [previousPaymentCredit,setPreviousPaymentCredit]=useState(0)
  const [checkingPromotion,setCheckingPromotion]=useState(false)

  useEffect(()=>{let active=true;async function load(){
    if(!supabase){if(active){setError('إعدادات قاعدة البيانات غير مكتملة.');setLoading(false)}return}
    const [{data:planRows,error:planError},{data:auth},{data:paymentSettings}]=await Promise.all([
      supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features,display_order,placement_type').eq('is_active',true).order('display_order').order('created_at'),
      supabase.auth.getUser(),
      supabase.from('public_platform_settings').select('instapay_number,vodafone_cash_number').limit(1).maybeSingle()
    ])
    if(!active)return
    if(planError)setError('تعذر تحميل الباقات: '+planError.message)
    const availablePlans=(planRows||[]) as Plan[]
    setPlans(premiumOnly?availablePlans.filter(plan=>plan.placement_type==='premium'):availablePlans)
    if(paymentSettings){setPaymentInfo({instapay_number:String(paymentSettings.instapay_number||'').trim(),vodafone_cash_number:String(paymentSettings.vodafone_cash_number||'').trim()})}else{setError('تعذر تحميل أرقام التحويل. راجع إعدادات الدفع أو حدّث الصفحة.')}
    if(auth.user){
      setUserId(auth.user.id)
      const {data:membership}=await supabase.from('organization_memberships').select('organization_id,organizations(organization_type)').eq('user_id',auth.user.id).limit(1).maybeSingle()
      if(active&&membership?.organization_id){
        const orgType=(membership as any).organizations?.organization_type
        if(['individual_owner','fleet_supplier'].includes(String(orgType))){
          setOrgId(membership.organization_id)
          const {data:owned}=await supabase.from('vehicles').select('id,make,model,model_year').eq('organization_id',membership.organization_id).eq('review_status','approved').order('created_at',{ascending:false})
          if(active)setVehicles((owned||[]) as Vehicle[])
        }
      }
    }
    if(active)setLoading(false)
  }void load();return()=>{active=false}},[])

  useEffect(()=>{let active=true;async function inspectExistingPromotion(){
    if(!supabase||!vehicleId||!selectedPlan){setPaymentDue(null);setPromotionMode('new');setPreviousPaymentCredit(0);setCheckingPromotion(false);return}
    setCheckingPromotion(true)
    const {data:current,error:currentError}=await supabase.from('vehicle_promotions').select('id,advertising_plan_id').eq('vehicle_id',vehicleId).eq('status','approved').in('payment_status',['verified','waived']).gt('ends_at',new Date().toISOString()).order('ends_at',{ascending:false}).limit(1).maybeSingle()
    if(!active)return
    if(currentError){setPromotionMode('invalid');setPaymentDue(null);setCheckingPromotion(false);return}
    if(current?.advertising_plan_id===selectedPlan.id){setPromotionMode('duplicate');setPaymentDue(null);setPreviousPaymentCredit(0);setCheckingPromotion(false);return}
    const {data:pending,error:pendingError}=await supabase.from('vehicle_promotions').select('id,advertising_plan_id,final_amount_egp,payment_status,payment_reference,payment_due_egp,previous_payment_reference,previous_payment_amount_egp,previous_payment_credit_egp').eq('vehicle_id',vehicleId).eq('status','pending_review').maybeSingle()
    if(!active)return
    if(pendingError){setPromotionMode('invalid');setPaymentDue(null);setCheckingPromotion(false);return}
    const total=Number(couponPreview?.final_amount_egp??selectedPlan.price_egp)
    if(pending){
      const {data:currentPlan,error:planError}=await supabase.from('advertising_plans').select('display_order').eq('id',pending.advertising_plan_id).maybeSingle()
      if(!active)return
      if(planError||!currentPlan){setPromotionMode('invalid');setPaymentDue(null);setCheckingPromotion(false);return}
      if(Number(selectedPlan.display_order)<=Number(currentPlan.display_order)){setPromotionMode('invalid');setPaymentDue(null);setPreviousPaymentCredit(0);setCheckingPromotion(false);return}
      const priorRef=String(pending.previous_payment_reference||'').trim()
      const priorAmount=Number(pending.previous_payment_amount_egp||0)
      const currentDue=Number(pending.payment_due_egp??pending.final_amount_egp??0)
      const currentRef=String(pending.payment_reference||'').trim()
      const hasCurrentTransfer=currentDue>0&&!!currentRef&&!currentRef.startsWith('لا يوجد فرق مستحق')
      const credit=(priorRef&&priorAmount>0?priorAmount:0)+(hasCurrentTransfer?currentDue:0)
      setPreviousPaymentCredit(credit);setPaymentDue(Math.max(0,total-credit));setPromotionMode('pending-upgrade');setCheckingPromotion(false);return
    }
    setPromotionMode(current?'queued':'new');setPreviousPaymentCredit(0);setPaymentDue(total);setCheckingPromotion(false)
  }
  void inspectExistingPromotion();return()=>{active=false}
  },[vehicleId,selectedPlan?.id,couponPreview?.final_amount_egp])

  async function previewCoupon(){
    if(!supabase||!selectedPlan||!couponCode.trim())return
    setCouponLoading(true);setError('');setCouponPreview(null)
    const {data,error:e}=await supabase.rpc('preview_discount_code',{p_code:couponCode.trim().toUpperCase(),p_service:'vehicle_advertising',p_reference_id:selectedPlan.id,p_period:'monthly'})
    setCouponLoading(false)
    if(e){setError(e.message||'كود الخصم غير صالح أو لا ينطبق على باقة الإعلان.');return}
    setCouponPreview(data as {code:string;original_amount_egp:number;discount_amount_egp:number;final_amount_egp:number})
  }

  async function submitRequest(){
    if(!supabase||!selectedPlan||!userId||!orgId||!vehicleId||!paymentDate)return
    if(couponCode.trim()&&!couponPreview){setError('تحقق من كود الخصم أولًا أو احذف الكود قبل إرسال الطلب.');return}
    const expectedDue=paymentDue??Number(selectedPlan.price_egp)
    const requiresTransfer=expectedDue>0
    if(requiresTransfer&&!paymentReference.trim()){setError('أدخل رقم العملية بعد تحويل المبلغ المستحق.');return}
    const selectedPaymentNumber=paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number
    if(requiresTransfer&&!selectedPaymentNumber){setError('وسيلة الدفع المختارة غير متاحة حاليًا. اختر وسيلة دفع مفعّلة من إعدادات المنصة.');return}
    setSending(true);setError('');setNotice('')
    const selectedPaymentLabel=paymentMethod==='instapay'?'InstaPay':'Vodafone Cash'
    let submittedPaymentReference=''
    const {data:activePromotion,error:activeError}=await supabase.from('vehicle_promotions').select('id,advertising_plan_id').eq('vehicle_id',vehicleId).eq('status','approved').in('payment_status',['verified','waived']).gt('ends_at',new Date().toISOString()).order('ends_at',{ascending:false}).limit(1).maybeSingle()
    if(activeError){setSending(false);setError('تعذر التحقق من الباقة الحالية للسيارة. لم يتم إنشاء أو تعديل أي طلب.');return}
    if(activePromotion?.advertising_plan_id===selectedPlan.id){setSending(false);setError('هذه الباقة مفعّلة بالفعل على السيارة. اختر باقة مختلفة أو انتظر انتهاء مدتها.');return}
    const {data:pendingRequest,error:pendingLookupError}=await supabase
      .from('vehicle_promotions')
      .select('id,advertising_plan_id,payment_status,payment_reference,final_amount_egp,payment_due_egp,previous_payment_reference,previous_payment_amount_egp,previous_payment_credit_egp')
      .eq('vehicle_id',vehicleId)
      .eq('status','pending_review')
      .maybeSingle()
    if(pendingLookupError){
      setSending(false)
      setError('تعذر التحقق من وجود طلب إعلان سابق لهذه السيارة. لم يتم إرسال أي طلب جديد. حاول مرة أخرى.')
      return
    }

    let requestError: {message:string}|null=null
    let upgradedExistingRequest=false
    const fullPlanAmount=couponPreview?.final_amount_egp??Number(selectedPlan.price_egp)
    let paymentDueAmount=fullPlanAmount
    let previousCredit=0
    const pricing={
      coupon_code:couponPreview?.code||null,
      original_amount_egp:couponPreview?.original_amount_egp??Number(selectedPlan.price_egp),
      discount_amount_egp:couponPreview?.discount_amount_egp??0,
      final_amount_egp:fullPlanAmount,
      payment_status:'pending',
      updated_at:new Date().toISOString()
    }

    if(pendingRequest){
      const {data:currentPlan,error:currentPlanError}=await supabase
        .from('advertising_plans')
        .select('id,price_egp,display_order')
        .eq('id',pendingRequest.advertising_plan_id)
        .maybeSingle()
      if(currentPlanError||!currentPlan){
        setSending(false)
        setError('تعذر قراءة الباقة المرتبطة بطلبك الحالي. لم يتم تغيير الطلب.')
        return
      }
      if(pendingRequest.advertising_plan_id===selectedPlan.id||Number(selectedPlan.display_order)<=Number(currentPlan.display_order)){
        setSending(false)
        setError(pendingRequest.advertising_plan_id===selectedPlan.id
          ?'لديك بالفعل طلب لهذه الباقة قيد المراجعة. لا يمكن تكرار الطلب قبل انتهاء مراجعته.'
          :'لديك طلب إعلان قيد المراجعة بباقة مساوية أو أعلى. يمكنك اختيار باقة أعلى فقط لترقية الطلب الحالي.')
        return
      }
      const priorRef=String(pendingRequest.previous_payment_reference||'').trim()
      const priorAmount=Number(pendingRequest.previous_payment_amount_egp||0)
      const oldDue=Number(pendingRequest.payment_due_egp??pendingRequest.final_amount_egp??0)
      const oldRef=String(pendingRequest.payment_reference||'').trim()
      const oldTransferExists=oldDue>0&&!!oldRef&&!oldRef.startsWith('لا يوجد فرق مستحق')
      const previousReferences=[priorRef,oldTransferExists?oldRef:''].filter(Boolean)
      previousCredit=(priorRef&&priorAmount>0?priorAmount:0)+(oldTransferExists?oldDue:0)
      paymentDueAmount=Math.max(0,fullPlanAmount-previousCredit)
      if(paymentDueAmount>0&&!paymentReference.trim()){setSending(false);setError('بعد إعادة التحقق من الطلب، ما زال هناك مبلغ مستحق. أدخل رقم التحويل الحالي قبل الإرسال.');return}
      if(paymentDueAmount>0&&!selectedPaymentNumber){setSending(false);setError('وسيلة الدفع المختارة غير متاحة حاليًا. اختر وسيلة دفع مفعّلة من إعدادات المنصة.');return}
      submittedPaymentReference=paymentDueAmount>0?selectedPaymentLabel+' — '+paymentReference.trim()+' — '+paymentDate:'لا يوجد فرق مستحق — ترقية دون مبلغ إضافي'
      const {data:updatedRequest,error:updateError}=await supabase
        .from('vehicle_promotions')
        .update({
          advertising_plan_id:selectedPlan.id,
          ...pricing,
          payment_reference:submittedPaymentReference,
          previous_payment_reference:previousReferences.join('\n---\n')||null,
          previous_payment_amount_egp:previousCredit,
          previous_payment_credit_egp:previousCredit,
          payment_due_egp:paymentDueAmount,
          reviewed_by:null,
          reviewed_at:null
        })
        .eq('id',pendingRequest.id)
        .eq('status','pending_review')
        .select('id')
        .maybeSingle()
      requestError=updateError||(!updatedRequest?{message:'تغيرت حالة الطلب أثناء التحديث. حدّث الصفحة وحاول مرة أخرى.'}:null)
      upgradedExistingRequest=!requestError
    }else{
      paymentDueAmount=fullPlanAmount
      if(paymentDueAmount>0&&!paymentReference.trim()){setSending(false);setError('أدخل رقم العملية بعد تحويل المبلغ المستحق.');return}
      if(paymentDueAmount>0&&!selectedPaymentNumber){setSending(false);setError('وسيلة الدفع المختارة غير متاحة حاليًا. اختر وسيلة دفع مفعّلة من إعدادات المنصة.');return}
      submittedPaymentReference=paymentDueAmount>0?selectedPaymentLabel+' — '+paymentReference.trim()+' — '+paymentDate:'لا يوجد مبلغ مستحق بعد الخصم'
      const {error:insertError}=await supabase.from('vehicle_promotions').insert({
        vehicle_id:vehicleId,
        organization_id:orgId,
        advertising_plan_id:selectedPlan.id,
        created_by:userId,
        status:'pending_review',
        previous_payment_credit_egp:0,
        payment_due_egp:paymentDueAmount,
        ...pricing,
        payment_reference:submittedPaymentReference
      })
      requestError=insertError
    }
    setSending(false)
    if(requestError){
      setError(requestError.message.includes('vehicle_promotions_one_pending_per_vehicle_uidx')
        ?'يوجد طلب إعلان لهذه السيارة قيد المراجعة بالفعل. حدّث الصفحة لمتابعة الطلب القائم أو ترقيته.'
        :'تعذر حفظ طلب الترويج: '+requestError.message)
      return
    }
    setNotice(upgradedExistingRequest
      ?'تم تحديث نفس طلب المراجعة إلى الباقة الأعلى. احتُسبت التحويلات السابقة المسجلة وخصمها من الإجمالي، ولن يعتمد الرصيد إلا بعد مراجعة الإدارة لجميع مراجع التحويل السابقة والحالية.'
      :promotionMode==='queued'?'تم تسجيل طلب الباقة التالية. بعد اعتماد التحويل ستبدأ مدتها تلقائيًا فور انتهاء الباقة الحالية.':'تم إرسال طلب الإعلان وبيانات التحويل بنجاح. طلبك الآن في قائمة مراجعة الدفع بلوحة الإدارة، ولن يظهر الإعلان قبل مراجعة التحويل واعتماده.')
    setSelectedPlan(null);setVehicleId('');setPaymentReference('');setPaymentDate(new Date().toISOString().slice(0,10));setPaymentMethod('instapay');setCouponCode('');setCouponPreview(null)
  }

  return <main dir="rtl" className="mc-advertising-plans-main min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(191,219,254,.48),transparent_32%),linear-gradient(135deg,#f8fafc,#eef3f9)] text-slate-900">
    <section className="relative isolate overflow-hidden bg-[#071a31] text-white"><div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_12%_20%,rgba(37,99,235,.42),transparent_38%),radial-gradient(ellipse_at_88%_85%,rgba(245,158,11,.22),transparent_32%)]"/><div className="absolute -left-20 top-10 -z-10 h-64 w-64 rounded-full border border-white/10"/><div className="absolute -left-10 top-20 -z-10 h-44 w-44 rounded-full border border-white/10"/><div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-18"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-blue-100"><Sparkles size={15}/> {premiumOnly?'مساحة الظهور الإعلاني المميز':'حلول ظهور مرنة لسياراتك'}</span><h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.7] sm:text-5xl sm:leading-[1.55]">{premiumOnly?<>احجز <span className="text-amber-300">المساحة الإعلانية الأبرز</span></>:<>خلّي سيارتك <span className="text-amber-300">في مقدمة اهتمام الشركات</span></>}</h1><p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">{premiumOnly?'اختر باقة الإعلان المميز لتظهر سيارتك في المساحة المخصصة أعلى كتالوج My Car، بعد مراجعة الطلب واعتماد التحويل.':'اختار باقة ظهور إعلاني تناسب ميزانيتك، وميّز سيارتك داخل كتالوج My Car بعد مراجعة الطلب واعتماده.'}</p><div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Megaphone className="text-blue-300"/><p className="mt-3 font-extrabold">ظهور أوضح</p><p className="mt-1 text-xs leading-6 text-slate-300">تمييز السيارات المروّج لها داخل الكتالوج.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Clock3 className="text-blue-300"/><p className="mt-3 font-extrabold">مدة محددة</p><p className="mt-1 text-xs leading-6 text-slate-300">اختيار مدة تناسب احتياجك.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="text-blue-300"/><p className="mt-3 font-extrabold">مراجعة إدارية</p><p className="mt-1 text-xs leading-6 text-slate-300">التفعيل بعد اعتماد الطلب والتحقق من الدفع.</p></div></div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-extrabold text-blue-700">اختار الأنسب لك</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{premiumOnly?'باقات الإعلان المميز':'باقات الإعلانات'}</h2><p className="mt-2 text-sm leading-7 text-slate-500">الأسعار المعروضة بالجنيه المصري، ويمكن لإدارة المنصة تعديلها في أي وقت.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200"><CircleDollarSign size={17}/> {plans.length} باقات متاحة</span></div>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
      {loading?<div className="py-16 text-center text-slate-500"><LoaderCircle className="mx-auto animate-spin"/> جارٍ تحميل الباقات...</div>:plans.length===0?<div className="mt-6 rounded-3xl border border-dashed bg-white p-10 text-center"><Megaphone className="mx-auto text-slate-300" size={38}/><h3 className="mt-4 font-extrabold">{premiumOnly?'باقات الإعلان المميز قيد التجهيز':'الباقات قيد التجهيز'}</h3><p className="mt-2 text-sm text-slate-500">{premiumOnly?'لم تعتمد إدارة المنصة باقة مميزة متاحة للاشتراك حتى الآن. يمكنك العودة لاحقًا.':'لم يتم نشر باقات إعلانية بعد. يمكنك العودة لاحقًا.'}</p>{premiumOnly&&<a href="/workspace/advertising-plans" className="mt-4 inline-flex rounded-xl border px-4 py-2 text-sm font-bold">عرض جميع باقات الإعلانات</a>}</div>:<div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map((p,i)=><article key={p.id} className={'group relative flex flex-col overflow-hidden rounded-[1.75rem] border bg-white p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,.5)] transition duration-300 hover:-translate-y-1 hover:shadow-xl '+(i===1?'border-blue-500 ring-2 ring-blue-100':'border-slate-200')}><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-blue-700 via-blue-500 to-amber-400"/><div className="flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 transition group-hover:bg-blue-700 group-hover:text-white"><Megaphone size={23}/></span>{i===1&&<span className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white">الأكثر اختيارًا</span>}</div><h3 className="mt-5 text-xl font-black">{p.name}</h3><span className="mt-2 inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold">{p.placement_type==='premium'?'إعلان مميز':'إعلان عادي'}</span><p className="mt-2 min-h-14 text-sm leading-7 text-slate-500">{p.description}</p><div className="mt-5 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/70 p-4"><p className="text-xs font-bold text-slate-500">سعر الباقة</p><p className="mt-1 text-3xl font-black tabular-nums text-blue-800">{money(Number(p.price_egp))}<span className="mr-2 text-sm font-bold text-slate-500">ج.م</span></p><p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-slate-600"><Clock3 size={15}/> مدة الإعلان {p.duration_days} يوم</p></div><ul className="mt-5 flex-1 space-y-3">{(p.features||[]).map(f=><li key={f} className="flex items-start gap-2 text-sm leading-6 text-slate-700"><Check size={17} className="mt-1 shrink-0 text-emerald-600"/><span>{f}</span></li>)}</ul><button onClick={()=>{setSelectedPlan(p);setVehicleId('');setCouponCode('');setCouponPreview(null);setError('')}} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#102b47] px-4 font-extrabold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"><BadgeCheck size={17}/> اختيار الباقة والمتابعة</button>{selectedPlan?.id===p.id&&<div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="font-extrabold">تحديد السيارة المراد ترويجها</p>{!userId?<a href="/?login=1" className="mt-3 block rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white">سجّل الدخول للمتابعة</a>:!orgId?<p className="mt-3 text-sm leading-7 text-slate-600">طلب الترويج متاح لحسابات ملاك السيارات وموردي الأساطيل المرتبطة بمؤسسة.</p>:vehicles.length===0?<p className="mt-3 text-sm leading-7 text-slate-600">لا توجد سيارة معتمدة في حسابك. أضف سيارة وانتظر اعتمادها قبل طلب الترويج.</p>:<><label className="mt-3 block text-sm font-bold">السيارة<select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="">اختر سيارة معتمدة</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.model_year}</option>)}</select></label><div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950"><p className="font-extrabold">ماذا سيحدث بعد اختيار الباقة؟</p>{promotionMode==='pending-upgrade'?<ol className="mt-2 list-decimal space-y-1 pr-5"><li>طلب الباقة الأولى ما زال قيد المراجعة، لذلك سنحدّث نفس الطلب ولن ننشئ طلبًا مكررًا.</li><li>سيُحتسب ما تم تسجيله من تحويلات سابقة، وتدفع الفرق فقط. لا يصبح أي تحويل سابق رصيدًا نهائيًا إلا بعد أن تتحقق الإدارة من كل مرجع.</li><li>أرسل مرجع تحويل الفرق إن كان مطلوبًا؛ وستراجع الإدارة التحويلات السابقة والحالية معًا قبل الاعتماد.</li><li>بعد الاعتماد تبدأ الباقة الأعلى، وإذا كانت هناك باقة سارية بالفعل فستبدأ بعدها تلقائيًا.</li></ol>:promotionMode==='queued'?<ol className="mt-2 list-decimal space-y-1 pr-5"><li>الباقة الحالية معتمدة وما زالت سارية، لذلك سننشئ طلبًا مستقلًا للباقة التالية.</li><li>حوّل قيمة الباقة الجديدة وأرسل رقم العملية وتاريخ التحويل.</li><li>تراجع الإدارة الطلب وتوافق عليه؛ ولن تحل الباقة الجديدة محل الباقة الحالية.</li><li>تبدأ مدة الباقة الجديدة تلقائيًا بعد انتهاء الباقة الحالية، دون فقد أيامها.</li></ol>:promotionMode==='duplicate'?<p className="mt-2">هذه الباقة مفعّلة بالفعل على السيارة. اختر باقة مختلفة أو انتظر انتهاء مدتها.</p>:promotionMode==='invalid'?<p className="mt-2 text-red-800">لم نتمكن من التحقق من حالة الطلب الحالي. لن نسمح بإرسال طلب حتى يتم التحقق، لحماية طلباتك من التكرار.</p>:<ol className="mt-2 list-decimal space-y-1 pr-5"><li>اختر السيارة والباقة، ثم حوّل المبلغ إلى وسيلة الدفع الموضحة.</li><li>أدخل رقم العملية وتاريخ التحويل وأرسل الطلب.</li><li>تراجع الإدارة التحويل وتوافق على الطلب قبل تفعيل الإعلان.</li></ol>}</div><div className="mt-4 grid gap-3"><label className="block text-sm font-bold">وسيلة التحويل<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="instapay">InstaPay</option><option value="vodafone_cash">Vodafone Cash</option></select></label><div className="rounded-xl border border-blue-100 bg-white p-3"><label className="block text-sm font-extrabold">البروموكود / كود الخصم (اختياري)<input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCouponPreview(null)}} maxLength={40} dir="ltr" className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-left" placeholder="أدخل البروموكود هنا"/></label><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" disabled={couponLoading||!couponCode.trim()} onClick={()=>void previewCoupon()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{couponLoading?'جارٍ التحقق...':'تطبيق كود الخصم'}</button>{couponPreview&&<span className="text-xs font-bold text-emerald-700">تم تطبيق الكود</span>}</div>{couponPreview&&<div className="mt-3 grid gap-2 rounded-lg bg-blue-50 p-3 text-sm"><p>السعر الأصلي: <strong>{money(couponPreview.original_amount_egp)}</strong></p><p className="text-emerald-700">الخصم: <strong>{money(couponPreview.discount_amount_egp)}</strong></p><p>المطلوب تحويله: <strong className="text-blue-800">{money(couponPreview.final_amount_egp)}</strong></p></div>}<p className="mt-2 text-xs leading-5 text-slate-500">سيتم التحقق من الكود مرة أخرى عند إرسال الطلب، ويُحتسب استخدامه بعد اعتماد الدفع فقط.</p></div><div className="rounded-xl border border-blue-100 bg-white p-4"><p className="text-xs font-bold text-slate-500">حوّل المبلغ إلى الرقم التالي</p><p className="mt-1 text-xs text-slate-500">المبلغ المطلوب تحويله: <strong className="text-blue-800">{money(paymentDue??(couponPreview?.final_amount_egp??Number(selectedPlan.price_egp)))} ج.م</strong></p>{promotionMode==='pending-upgrade'&&<p className="mt-1 text-xs font-bold text-amber-800">إجمالي التحويلات السابقة المسجلة: {money(previousPaymentCredit)} جنيه؛ ستدفع الفرق فقط، بشرط أن تتحقق الإدارة من جميع مراجع التحويل قبل اعتماد الطلب.</p>}{promotionMode==='queued'&&<p className="mt-1 text-xs font-bold text-blue-700">هذه باقة تالية؛ يبدأ تفعيلها بعد انتهاء الباقة الحالية.</p>}{promotionMode==='duplicate'&&<p className="mt-1 text-xs font-bold text-amber-700">هذه الباقة مفعّلة بالفعل على السيارة.</p>}{promotionMode==='invalid'&&<p className="mt-1 text-xs font-bold text-red-700">تعذر التحقق من حالة طلب السيارة أو أن الباقة المختارة ليست ترقية.</p>}<p dir="ltr" className="mt-2 text-2xl font-black tracking-wider text-blue-800">{(paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number)||'غير متاح حاليًا'}</p><p className="mt-1 text-xs text-slate-500">{paymentMethod==='instapay'?'رقم InstaPay الرسمي للمنصة':'رقم Vodafone Cash الرسمي للمنصة'}</p></div><label className="block text-sm font-bold">رقم العملية / مرجع التحويل<input required={(paymentDue??Number(selectedPlan.price_egp))>0} disabled={(paymentDue??Number(selectedPlan.price_egp))<=0} minLength={3} maxLength={160} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="أدخل رقم العملية بعد التحويل" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal" /></label><label className="block text-sm font-bold">تاريخ التحويل<input required={(paymentDue??Number(selectedPlan.price_egp))>0} disabled={(paymentDue??Number(selectedPlan.price_egp))<=0} type="date" max={new Date().toISOString().slice(0,10)} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal" /></label><p className="text-xs leading-6 text-slate-500">بعد إرسال البيانات سيظهر طلب مراجعة الدفع لصاحب المنصة. لا يتم تفعيل الإعلان تلقائيًا، ويجب إتمام التحويل خارج المنصة إلى بيانات الدفع المعتمدة.</p>{!(paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number)&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">وسيلة الدفع المختارة غير مهيأة حاليًا. يمكن لإدارة المنصة تحديثها من صفحة معلومات الدفع.</p>}</div><button disabled={!vehicleId||!paymentDate||((paymentDue??Number(selectedPlan.price_egp))>0&&(!paymentReference.trim()||!(paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number)))||sending||checkingPromotion||promotionMode==='duplicate'||promotionMode==='invalid'} onClick={()=>void submitRequest()} className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 px-4 font-extrabold text-white disabled:opacity-50">{sending?'جارٍ إرسال الطلب...':'إرسال طلب الإعلان للمراجعة'}</button></>}</div>}</article>)}</div>}
      <div className="mt-8 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 sm:p-6"><ShieldCheck className="mt-0.5 shrink-0 text-sky-700" size={23}/><div><p className="font-extrabold text-amber-950">معلومة مهمة عن الدفع والتفعيل</p><p className="mt-2 text-sm leading-7 text-sky-900">طلب الباقة لا يعني تفعيل الإعلان تلقائيًا. تراجع الإدارة الطلب وتؤكد الدفع بعد التحقق من التحويل. لا يتم تحصيل أي مبلغ إلكترونيًا من هذه الصفحة. قيمة الباقة مقابل الاشتراك وعرض السيارة أمام الشركات فقط، ولا تضمن المنصة تشغيل السيارة أو الحصول على عقد تأجير.</p></div></div>
    </section>
  </main>
}
