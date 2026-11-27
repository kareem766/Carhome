import { useEffect, useState } from 'react'
import { BadgeCheck, Check, CircleDollarSign, Clock3, Landmark, LoaderCircle, Megaphone, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { clearFormDraft, readFormDraft, writeFormDraft } from '../lib/formDrafts'
import { createMyCarCheckout, PaymentMethodChoice, type MyCarPaymentMethod } from './PaymentMethodChoice'

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
  const [checkoutMethod,setCheckoutMethod]=useState<MyCarPaymentMethod>('manual')
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
  const [fieldError,setFieldError]=useState<{field:string;text:string}|null>(null)
  const showFieldError=(field:string,text:string)=>{setFieldError({field,text});setError('')}
  const clearFieldError=(field:string)=>setFieldError(current=>current?.field===field?null:current)
  const [notice,setNotice]=useState('')
  const [noticePlanId,setNoticePlanId]=useState<string|null>(null)
  const [paymentDue,setPaymentDue]=useState<number|null>(null)
  const [promotionMode,setPromotionMode]=useState<'new'|'pending-upgrade'|'pending-existing'|'queued'|'duplicate'|'invalid'>('new')
  const [previousPaymentCredit,setPreviousPaymentCredit]=useState(0)
  const [checkingPromotion,setCheckingPromotion]=useState(false)
  const [draftReady,setDraftReady]=useState(false)

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
    if(paymentSettings){setPaymentInfo({instapay_number:String(paymentSettings.instapay_number||'').trim(),vodafone_cash_number:String(paymentSettings.vodafone_cash_number||'').trim()})}else{setPaymentInfo({instapay_number:'',vodafone_cash_number:''})}
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

  useEffect(()=>{if(loading||!userId||!orgId||draftReady||!plans.length)return;const values=readFormDraft('advertising-payment:'+userId+':'+orgId+':'+(premiumOnly?'premium':'standard'))?.values;if(values){if(typeof values.planId==='string')setSelectedPlan(plans.find(plan=>plan.id===values.planId)||null);if(typeof values.vehicleId==='string')setVehicleId(values.vehicleId);if(typeof values.paymentMethod==='string')setPaymentMethod(values.paymentMethod);if(values.checkoutMethod==='online'||values.checkoutMethod==='manual')setCheckoutMethod(values.checkoutMethod);if(typeof values.paymentReference==='string')setPaymentReference(values.paymentReference);if(typeof values.paymentDate==='string')setPaymentDate(values.paymentDate);if(typeof values.couponCode==='string')setCouponCode(values.couponCode)}setDraftReady(true)},[loading,userId,orgId,plans,draftReady,premiumOnly])
  useEffect(()=>{if(userId&&orgId&&draftReady)writeFormDraft('advertising-payment:'+userId+':'+orgId+':'+(premiumOnly?'premium':'standard'),{planId:selectedPlan?.id||'',vehicleId,paymentMethod,checkoutMethod,paymentReference,paymentDate,couponCode})},[userId,orgId,draftReady,premiumOnly,selectedPlan?.id,vehicleId,paymentMethod,paymentReference,paymentDate,couponCode])

  useEffect(()=>{let active=true;async function inspectExistingPromotion(){
    if(!supabase||!vehicleId||!selectedPlan){setPaymentDue(null);setPromotionMode('new');setPreviousPaymentCredit(0);setCheckingPromotion(false);return}
    setCheckingPromotion(true)
    const {data:current,error:currentError}=await supabase.from('vehicle_promotions').select('id,advertising_plan_id').eq('vehicle_id',vehicleId).eq('status','approved').in('payment_status',['verified','waived']).gt('ends_at',new Date().toISOString()).order('ends_at',{ascending:false}).limit(1).maybeSingle()
    if(!active)return
    if(currentError){setPromotionMode('invalid');setPaymentDue(null);setCheckingPromotion(false);return}
    if(current?.advertising_plan_id===selectedPlan.id){setPromotionMode('duplicate');setPaymentDue(null);setPreviousPaymentCredit(0);setCheckingPromotion(false);return}
    const {data:pending,error:pendingError}=await supabase.from('vehicle_promotions').select('id,advertising_plan_id,plan_display_order_snapshot,final_amount_egp,payment_status,payment_reference,payment_due_egp,previous_payment_reference,previous_payment_amount_egp,previous_payment_credit_egp').eq('vehicle_id',vehicleId).eq('status','pending_review').maybeSingle()
    if(!active)return
    if(pendingError){setPromotionMode('invalid');setPaymentDue(null);setCheckingPromotion(false);return}
    const total=Number(couponPreview?.final_amount_egp??selectedPlan.price_egp)
    if(pending){
      const currentDue=Number(pending.payment_due_egp??pending.final_amount_egp??0)
      const currentRef=String(pending.payment_reference||'').trim()
      if(pending.advertising_plan_id===selectedPlan.id&&pending.payment_status==='pending'&&!currentRef){
        setCouponCode('');setCouponPreview(null)
        setPreviousPaymentCredit(0);setPaymentDue(currentDue);setPromotionMode('pending-existing');setCheckingPromotion(false);return
      }
      if(Number(selectedPlan.display_order)<=Number(pending.plan_display_order_snapshot)){setPromotionMode('invalid');setPaymentDue(null);setPreviousPaymentCredit(0);setCheckingPromotion(false);return}
      const priorRef=String(pending.previous_payment_reference||'').trim()
      const priorAmount=Number(pending.previous_payment_amount_egp||0)
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
    if(e){showFieldError('coupon_code',e.message||'كود الخصم غير صالح أو لا ينطبق على باقة الإعلان.');return}
    setCouponPreview(data as {code:string;original_amount_egp:number;discount_amount_egp:number;final_amount_egp:number})
  }

  async function submitRequest(){
    if(!supabase||!selectedPlan||!userId||!orgId||!vehicleId||(checkoutMethod==='manual'&&!paymentDate))return
    if(couponCode.trim()&&!couponPreview){showFieldError('coupon_code','تحقق من كود الخصم أولًا أو احذف الكود قبل إرسال الطلب.');return}
    const expectedDue=paymentDue??Number(selectedPlan.price_egp)
    const requiresTransfer=expectedDue>0
    if(checkoutMethod==='manual'&&requiresTransfer&&!paymentReference.trim()){showFieldError('payment_reference','أدخل رقم العملية بعد تحويل المبلغ المستحق.');return}
    if(checkoutMethod==='online'&&promotionMode==='pending-upgrade'){setError('ترقية طلب إعلان قيد المراجعة تتطلب التحويل اليدوي حاليًا حتى لا نفقد مراجع التحويل السابقة.');return}
    const selectedPaymentNumber=paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number
    if(checkoutMethod==='manual'&&requiresTransfer&&!selectedPaymentNumber){showFieldError('payment_method','وسيلة الدفع المختارة غير متاحة حاليًا. اختر وسيلة دفع مفعّلة من إعدادات المنصة.');return}
    setSending(true);setError('');setNotice('')
    const selectedPaymentLabel=paymentMethod==='instapay'?'InstaPay':'Vodafone Cash'
    let submittedPaymentReference=''
    const {data:activePromotion,error:activeError}=await supabase.from('vehicle_promotions').select('id,advertising_plan_id').eq('vehicle_id',vehicleId).eq('status','approved').in('payment_status',['verified','waived']).gt('ends_at',new Date().toISOString()).order('ends_at',{ascending:false}).limit(1).maybeSingle()
    if(activeError){setSending(false);setError('تعذر التحقق من الباقة الحالية للسيارة. لم يتم إنشاء أو تعديل أي طلب.');return}
    if(activePromotion?.advertising_plan_id===selectedPlan.id){setSending(false);setError('هذه الباقة مفعّلة بالفعل على السيارة. اختر باقة مختلفة أو انتظر انتهاء مدتها.');return}
    const {data:pendingRequest,error:pendingLookupError}=await supabase
      .from('vehicle_promotions')
      .select('id,advertising_plan_id,plan_display_order_snapshot,payment_status,payment_reference,final_amount_egp,payment_due_egp,previous_payment_reference,previous_payment_amount_egp,previous_payment_credit_egp')
      .eq('vehicle_id',vehicleId)
      .eq('status','pending_review')
      .maybeSingle()
    if(pendingLookupError){
      setSending(false)
      setError('تعذر التحقق من وجود طلب إعلان سابق لهذه السيارة. لم يتم إرسال أي طلب جديد. حاول مرة أخرى.')
      return
    }

    let requestError: {message:string}|null=null
    let createdPromotionId:string|null=null
    let upgradedExistingRequest=false
    const fullPlanAmount=couponPreview?.final_amount_egp??Number(selectedPlan.price_egp)
    let paymentDueAmount=fullPlanAmount
    let previousCredit=0
    const pricing={
      coupon_code:couponPreview?.code||null,
      original_amount_egp:couponPreview?.original_amount_egp??Number(selectedPlan.price_egp),
      discount_amount_egp:couponPreview?.discount_amount_egp??0,
      final_amount_egp:fullPlanAmount,
      payment_status:paymentDueAmount>0?'pending':'submitted',
      updated_at:new Date().toISOString()
    }

    if(pendingRequest){
      if(pendingRequest.payment_status!=='pending'){
        setSending(false);setError('الطلب السابق ليس في حالة انتظار التحقق من الدفع. لن نعدّل الرصيد تلقائيًا؛ تواصل مع الإدارة لمراجعة حالته.');return
      }
      if(pendingRequest.advertising_plan_id===selectedPlan.id){
        if(String(pendingRequest.payment_reference||'').trim()){
          setSending(false);setError('تم إرسال بيانات الدفع لهذا الطلب بالفعل، وهو بانتظار مراجعة الإدارة.');return
        }
        const existingDue=Number(pendingRequest.payment_due_egp??pendingRequest.final_amount_egp??0)
        if(checkoutMethod==='online'&&existingDue>0){
          try{await createMyCarCheckout({purpose:selectedPlan.placement_type==='premium'?'featured_advertising':'advertising',entityId:pendingRequest.id})}
          catch(checkoutError){setError(checkoutError instanceof Error?checkoutError.message:'تعذر استكمال الدفع الإلكتروني.');setSending(false)}
          return
        }
        if(existingDue>0&&!paymentReference.trim()){setSending(false);showFieldError('payment_reference','أدخل رقم العملية بعد تحويل المبلغ المستحق.');return}
        if(existingDue>0&&!selectedPaymentNumber){setSending(false);showFieldError('payment_method','وسيلة الدفع المختارة غير متاحة حاليًا.');return}
        submittedPaymentReference=existingDue>0?selectedPaymentLabel+' — '+paymentReference.trim()+' — '+paymentDate:'لا يوجد مبلغ مستحق بعد الخصم'
        const {error:updatePendingError}=await supabase.from('vehicle_promotions').update({payment_status:'submitted',payment_reference:submittedPaymentReference,updated_at:new Date().toISOString()}).eq('id',pendingRequest.id).eq('status','pending_review')
        setSending(false)
        if(updatePendingError){setError(updatePendingError.message);return}
        setNotice('تم إرسال بيانات التحويل للطلب الحالي، وهو الآن بانتظار مراجعة الإدارة.')
        setNoticePlanId(selectedPlan.id);setPromotionMode('invalid');return
      }
      if(Number(selectedPlan.display_order)<=Number(pendingRequest.plan_display_order_snapshot)){
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
      if(checkoutMethod==='manual'&&paymentDueAmount>0&&!paymentReference.trim()){setSending(false);setError('أدخل رقم العملية بعد تحويل المبلغ المستحق.');return}
      if(checkoutMethod==='manual'&&paymentDueAmount>0&&!selectedPaymentNumber){setSending(false);setError('وسيلة الدفع المختارة غير متاحة حاليًا. اختر وسيلة دفع مفعّلة من إعدادات المنصة.');return}
      submittedPaymentReference=paymentDueAmount>0?(checkoutMethod==='manual'?selectedPaymentLabel+' — '+paymentReference.trim()+' — '+paymentDate:''):'لا يوجد مبلغ مستحق بعد الخصم'
      const {data:createdPromotion,error:insertError}=await supabase.from('vehicle_promotions').insert({
        vehicle_id:vehicleId,
        organization_id:orgId,
        advertising_plan_id:selectedPlan.id,
        created_by:userId,
        status:'pending_review',
        previous_payment_credit_egp:0,
        payment_due_egp:paymentDueAmount,
        ...pricing,
        payment_reference:paymentDueAmount>0&&checkoutMethod==='online'?null:submittedPaymentReference
      }).select('id').single()
      requestError=insertError
      createdPromotionId=createdPromotion?.id||null
    }
    setSending(false)
    if(requestError){
      setError(requestError.message.includes('vehicle_promotions_one_pending_per_vehicle_uidx')
        ?'يوجد طلب إعلان لهذه السيارة قيد المراجعة بالفعل. حدّث الصفحة لمتابعة الطلب القائم أو ترقيته.'
        :'تعذر حفظ طلب الترويج: '+requestError.message)
      return
    }
    if(checkoutMethod==='online'&&paymentDueAmount>0&&createdPromotionId){
      try{await createMyCarCheckout({purpose:selectedPlan.placement_type==='premium'?'featured_advertising':'advertising',entityId:createdPromotionId})}
      catch(checkoutError){setError(checkoutError instanceof Error?checkoutError.message:'تعذر بدء الدفع الإلكتروني. يمكنك استخدام التحويل اليدوي.');return}
      return
    }
    setNoticePlanId(selectedPlan.id)
    setNotice(upgradedExistingRequest
      ?'تم تحديث نفس طلب المراجعة إلى الباقة الأعلى. احتُسبت التحويلات السابقة المسجلة وخصمها من الإجمالي، ولن يعتمد الرصيد إلا بعد مراجعة الإدارة لجميع مراجع التحويل السابقة والحالية.'
      :promotionMode==='queued'?'تم تسجيل طلب الباقة التالية. بعد اعتماد التحويل ستبدأ مدتها تلقائيًا فور انتهاء الباقة الحالية.':'تم إرسال طلب الإعلان وبيانات التحويل بنجاح. طلبك الآن في قائمة مراجعة الدفع بلوحة الإدارة، ولن يظهر الإعلان قبل مراجعة التحويل واعتماده.')
    clearFormDraft('advertising-payment:'+userId+':'+orgId+':'+(premiumOnly?'premium':'standard'));setDraftReady(false);setSelectedPlan(null);setVehicleId('');setPaymentReference('');setPaymentDate(new Date().toISOString().slice(0,10));setPaymentMethod('instapay');setCheckoutMethod('manual');setCouponCode('');setCouponPreview(null)
  }

<div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6"><p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold leading-6 text-sky-900">يتم حفظ اختيار السيارة والباقة وطريقة الدفع وكود الخصم تلقائيًا على هذا الجهاز. بعد إعادة التحميل قد تحتاج إلى إعادة التحقق من كود الخصم قبل الإرسال.</p></div>

  return <main dir="rtl" className="mc-advertising-plans-main min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(191,219,254,.48),transparent_32%),linear-gradient(135deg,#f8fafc,#eef3f9)] text-slate-900">
    <section className="relative isolate overflow-hidden bg-[#071a31] text-white"><div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_12%_20%,rgba(37,99,235,.42),transparent_38%),radial-gradient(ellipse_at_88%_85%,rgba(245,158,11,.22),transparent_32%)]"/><div className="absolute -left-20 top-10 -z-10 h-64 w-64 rounded-full border border-white/10"/><div className="absolute -left-10 top-20 -z-10 h-44 w-44 rounded-full border border-white/10"/><div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-18"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-blue-100"><Sparkles size={15}/> {premiumOnly?'مساحة الظهور الإعلاني المميز':'حلول ظهور مرنة لسياراتك'}</span><h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.7] sm:text-5xl sm:leading-[1.55]">{premiumOnly?<>احجز <span className="text-amber-300">المساحة الإعلانية الأبرز</span></>:<>خلّي سيارتك <span className="text-amber-300">في مقدمة اهتمام الشركات</span></>}</h1><p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">{premiumOnly?'اختر باقة الإعلان المميز لتظهر سيارتك في المساحة المخصصة أعلى كتالوج My Car، بعد مراجعة الطلب واعتماد التحويل.':'اختار باقة ظهور إعلاني تناسب ميزانيتك، وميّز سيارتك داخل كتالوج My Car بعد مراجعة الطلب واعتماده.'}</p><div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Megaphone className="text-blue-300"/><p className="mt-3 font-extrabold">ظهور أوضح</p><p className="mt-1 text-xs leading-6 text-slate-300">تمييز السيارات المروّج لها داخل الكتالوج.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Clock3 className="text-blue-300"/><p className="mt-3 font-extrabold">مدة محددة</p><p className="mt-1 text-xs leading-6 text-slate-300">اختيار مدة تناسب احتياجك.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="text-blue-300"/><p className="mt-3 font-extrabold">مراجعة إدارية</p><p className="mt-1 text-xs leading-6 text-slate-300">التفعيل بعد اعتماد الطلب والتحقق من الدفع.</p></div></div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-extrabold text-blue-700">اختار الأنسب لك</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{premiumOnly?'باقات الإعلان المميز':'باقات الإعلانات'}</h2><p className="mt-2 text-sm leading-7 text-slate-500">الأسعار المعروضة بالجنيه المصري، ويمكن لإدارة المنصة تعديلها في أي وقت.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200"><CircleDollarSign size={17}/> {plans.length} باقات متاحة</span></div>

      {error&&!selectedPlan&&<p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p>}{loading?<div className="py-16 text-center text-slate-500"><LoaderCircle className="mx-auto animate-spin"/> جارٍ تحميل الباقات...</div>:plans.length===0?<div className="mt-6 rounded-3xl border border-dashed bg-white p-10 text-center"><Megaphone className="mx-auto text-slate-300" size={38}/><h3 className="mt-4 font-extrabold">{premiumOnly?'باقات الإعلان المميز قيد التجهيز':'الباقات قيد التجهيز'}</h3><p className="mt-2 text-sm text-slate-500">{premiumOnly?'لم تعتمد إدارة المنصة باقة مميزة متاحة للاشتراك حتى الآن. يمكنك العودة لاحقًا.':'لم يتم نشر باقات إعلانية بعد. يمكنك العودة لاحقًا.'}</p>{premiumOnly&&<a href="/workspace/advertising-plans" className="mt-4 inline-flex rounded-xl border px-4 py-2 text-sm font-bold">عرض جميع باقات الإعلانات</a>}</div>:<div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map((p,i)=><article key={p.id} className={'group relative flex flex-col overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,.5)] transition duration-300 hover:-translate-y-1 hover:shadow-xl '+(p.placement_type==='premium'?'mc-ad-premium-plan-card border-amber-300 bg-[#081b31] text-white ring-2 ring-amber-200/60 shadow-amber-950/20':'bg-white '+(i===1?'border-blue-500 ring-2 ring-blue-100':'border-slate-200'))}><div className={"absolute inset-x-0 top-0 h-1.5 "+(p.placement_type==='premium'?"bg-gradient-to-l from-amber-200 via-amber-500 to-orange-500":"bg-gradient-to-l from-blue-700 via-blue-500 to-amber-400")}/><div className="flex items-start justify-between gap-3"><span className={"grid h-12 w-12 place-items-center rounded-2xl ring-1 transition "+(p.placement_type==='premium'?"bg-amber-300/15 text-amber-200 ring-amber-200/30 group-hover:bg-amber-300 group-hover:text-slate-950":"bg-blue-50 text-blue-700 ring-blue-100 group-hover:bg-blue-700 group-hover:text-white")}><Megaphone size={23}/></span>{p.placement_type==='premium'?<span className="rounded-full border border-amber-200/40 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">PREMIUM · ظهور حصري</span>:i===1&&<span className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white">الأكثر اختيارًا</span>}</div><h3 className="mt-5 text-xl font-black">{p.name}</h3><span className={"mt-2 inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold "+(p.placement_type==='premium'?"bg-amber-300/15 text-amber-200":"bg-blue-50 text-blue-800")}>{p.placement_type==='premium'?'إعلان مميز':'إعلان عادي'}</span><p className={"mt-2 min-h-14 text-sm leading-7 "+(p.placement_type==='premium'?"text-blue-100/80":"text-slate-500")}>{p.description}</p><div className={"mt-5 rounded-2xl border p-4 "+(p.placement_type==='premium'?"border-amber-200/25 bg-gradient-to-br from-amber-300/15 to-orange-300/5":"border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/70")}><p className="text-xs font-bold text-slate-500">سعر الباقة</p><p className={"mt-1 text-3xl font-black tabular-nums "+(p.placement_type==='premium'?"text-amber-200":"text-blue-800")}>{money(Number(p.price_egp))}<span className="mr-2 text-sm font-bold text-slate-500">ج.م</span></p><p className={"mt-2 inline-flex items-center gap-1 text-sm font-bold "+(p.placement_type==='premium'?"text-blue-100":"text-slate-600")}><Clock3 size={15}/> مدة الإعلان {p.duration_days} يوم</p></div><ul className="mt-5 flex-1 space-y-3">{(p.features||[]).map(f=><li key={f} className={"flex items-start gap-2 text-sm leading-6 "+(p.placement_type==='premium'?"text-blue-50":"text-slate-700")}><Check size={17} className="mt-1 shrink-0 text-emerald-600"/><span>{f}</span></li>)}</ul><button onClick={()=>{setSelectedPlan(p);setNotice('');setNoticePlanId(null);setVehicleId('');setCouponCode('');setCouponPreview(null);setError('')}} className={"mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-extrabold shadow-md transition focus:outline-none focus:ring-4 "+(p.placement_type==='premium'?"bg-gradient-to-l from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300 focus:ring-amber-100":"bg-[#102b47] text-white hover:bg-blue-700 focus:ring-blue-100")}><BadgeCheck size={17}/> اختيار الباقة والمتابعة</button>{notice&&noticePlanId===p.id&&<p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-7 text-emerald-900">{notice}</p>}{selectedPlan?.id===p.id&&<div className="mt-4 rounded-2xl border border-blue-100 !bg-white p-4 !text-slate-900">{!userId?<a href="/?login=1" className="mt-3 block rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white">سجّل الدخول للمتابعة</a>:!orgId?<p className="mt-3 text-sm leading-7 !text-slate-700">طلب الترويج متاح لحسابات ملاك السيارات وموردي الأساطيل المرتبطة بمؤسسة.</p>:vehicles.length===0?<p className="mt-3 text-sm leading-7 !text-slate-800">لا توجد سيارة معتمدة في حسابك. أضف سيارة وانتظر اعتمادها قبل طلب الترويج.</p>:<><label className="mt-3 block text-sm font-bold !text-slate-900">السيارة<select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="">اختر سيارة معتمدة</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.model_year}</option>)}</select></label><div className="mt-3 rounded-xl border border-sky-200 !bg-sky-50 p-4 text-sm leading-7 !text-sky-950"><p className="font-extrabold !text-sky-950">ماذا سيحدث بعد اختيار الباقة؟</p>{promotionMode==='pending-upgrade'?<ol className="mt-2 list-decimal space-y-1 pr-5 !text-sky-950"><li>طلب الباقة الأولى ما زال قيد المراجعة، لذلك سنحدّث نفس الطلب ولن ننشئ طلبًا مكررًا.</li><li>سيُحتسب ما تم تسجيله من تحويلات سابقة، وتدفع الفرق فقط. لا يصبح أي تحويل سابق رصيدًا نهائيًا إلا بعد أن تتحقق الإدارة من كل مرجع.</li><li>أرسل مرجع تحويل الفرق إن كان مطلوبًا؛ وستراجع الإدارة التحويلات السابقة والحالية معًا قبل الاعتماد.</li><li>بعد الاعتماد تبدأ الباقة الأعلى، وإذا كانت هناك باقة سارية بالفعل فستبدأ بعدها تلقائيًا.</li></ol>:promotionMode==='queued'?<ol className="mt-2 list-decimal space-y-1 pr-5"><li>الباقة الحالية معتمدة وما زالت سارية، لذلك سننشئ طلبًا مستقلًا للباقة التالية.</li><li>حوّل قيمة الباقة الجديدة وأرسل رقم العملية وتاريخ التحويل.</li><li>تراجع الإدارة الطلب وتوافق عليه؛ ولن تحل الباقة الجديدة محل الباقة الحالية.</li><li>تبدأ مدة الباقة الجديدة تلقائيًا بعد انتهاء الباقة الحالية، دون فقد أيامها.</li></ol>:promotionMode==='pending-existing'?<p className="mt-2 !text-sky-950">لديك طلب سابق لهذه الباقة لم يكتمل دفعه بعد. يمكنك استكمال الدفع الإلكتروني أو إرسال بيانات التحويل اليدوي، وسيتم تحديث الطلب نفسه دون إنشاء طلب مكرر.</p>:promotionMode==='duplicate'?<p className="mt-2 !text-sky-950">هذه الباقة مفعّلة بالفعل على السيارة. اختر باقة مختلفة أو انتظر انتهاء مدتها.</p>:promotionMode==='invalid'?<p className="mt-2 !text-red-800">لم نتمكن من التحقق من حالة الطلب الحالي. لن نسمح بإرسال طلب حتى يتم التحقق، لحماية طلباتك من التكرار.</p>:<ol className="mt-2 list-decimal space-y-1 pr-5 !text-sky-950"><li>اختر السيارة والباقة، ثم اختر الدفع الإلكتروني أو التحويل اليدوي.</li><li>إذا اخترت التحويل اليدوي، أدخل رقم العملية وتاريخ التحويل.</li><li>تراجع الإدارة الدفع وتوافق على الطلب قبل تفعيل الإعلان.</li></ol>}</div><section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,.35)]">
  <div className="bg-gradient-to-l from-[#071a31] via-[#102f50] to-[#15558a] p-4 text-white sm:p-5">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/10"><ShieldCheck size={21}/></span><div><p className="text-xs font-bold text-blue-100">مركز الدفع الموحد</p><h4 className="mt-1 text-lg font-black">استكمل دفع باقة الإعلان</h4></div></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-bold sm:text-xs">
      <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-3"><span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-slate-950">✓</span><p className="mt-2">اختيار الباقة</p></div>
      <div className="rounded-xl border border-orange-200/40 bg-orange-300/15 px-2 py-3 text-orange-100"><span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-orange-300 text-slate-950">٢</span><p className="mt-2">اختيار الدفع</p></div>
      <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-3"><span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-white/15">٣</span><p className="mt-2">مراجعة الطلب</p></div>
    </div>
  </div>
  <div className="space-y-4 p-4 sm:p-5">
    <PaymentMethodChoice purpose={selectedPlan?.placement_type === 'premium' ? 'featured_advertising' : 'advertising'} value={checkoutMethod} onChange={setCheckoutMethod} onlineDisabled={promotionMode==='pending-upgrade'} manualMethod={paymentMethod==='instapay'?'instapay':'vodafone_cash'} onManualMethodChange={setPaymentMethod} availableManualMethods={[(paymentInfo.instapay_number?'instapay':null),(paymentInfo.vodafone_cash_number?'vodafone_cash':null)].filter(Boolean) as ('instapay'|'vodafone_cash')[]}/>
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-600">المبلغ المستحق حاليًا</span><span className="text-2xl font-black tabular-nums text-blue-900">{money(paymentDue??(couponPreview?.final_amount_egp??Number(selectedPlan.price_egp)))} <span className="text-xs">ج.م</span></span></div>
      {promotionMode==='pending-upgrade'&&<p className="mt-2 text-xs font-bold leading-6 text-amber-800">تم احتساب التحويلات السابقة المسجلة؛ ستدفع الفرق فقط بعد مراجعة الإدارة لمراجع التحويل.</p>}
      {promotionMode==='queued'&&<p className="mt-2 text-xs font-bold leading-6 text-blue-800">هذه باقة تالية، وتبدأ مدتها بعد انتهاء الباقة الحالية.</p>}
      {couponPreview&&<p className="mt-2 text-xs font-bold text-emerald-700">تم تطبيق الخصم بقيمة {money(couponPreview.discount_amount_egp)} جنيه.</p>}
    </div>
    {checkoutMethod==='manual'?<>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-extrabold text-slate-600">بيانات التحويل المعتمدة</p>
        <div className="mt-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-800">{paymentMethod==='instapay'?<Landmark size={20}/>:<Smartphone size={20}/>}</span><div className="min-w-0"><p className="text-sm font-black text-slate-900">{paymentMethod==='instapay'?'InstaPay':'Vodafone Cash'}</p><p className="mt-1 text-xs text-slate-500">حوّل المبلغ الموضح أعلاه إلى وسيلة الدفع المختارة</p></div></div>
        <p dir="ltr" className="mt-3 break-all rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-xl font-black tracking-wider text-blue-900">{(paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number)||'غير متاح حاليًا'}</p>
        {!(paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number)&&<p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">وسيلة الدفع المختارة غير مهيأة حاليًا. اختر وسيلة أخرى من مركز الدفع أو راجع إدارة المنصة.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-800">رقم العملية / مرجع التحويل<input aria-invalid={fieldError?.field==='payment_reference'} required={(paymentDue??Number(selectedPlan.price_egp))>0} disabled={(paymentDue??Number(selectedPlan.price_egp))<=0} minLength={3} maxLength={160} value={paymentReference} onChange={e=>{setPaymentReference(e.target.value);clearFieldError('payment_reference')}} placeholder="أدخل رقم العملية بعد التحويل" className={`mt-2 min-h-12 w-full rounded-xl border bg-white px-3 font-normal ${fieldError?.field==='payment_reference'?'!border-rose-500 !bg-rose-50 ring-2 ring-rose-100':'border-slate-200'}`}/>{fieldError?.field==='payment_reference'&&<p role="alert" className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{fieldError.text}</p>}</label>
        <label className="block text-sm font-bold text-slate-800">تاريخ التحويل<input required={(paymentDue??Number(selectedPlan.price_egp))>0} disabled={(paymentDue??Number(selectedPlan.price_egp))<=0} type="date" max={new Date().toISOString().slice(0,10)} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal"/></label>
      </div>
      <p className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs leading-6 text-sky-900">بعد إرسال بيانات التحويل، سيظهر طلب الإعلان في قائمة مراجعة الإدارة. لا يتم تفعيل الإعلان إلا بعد التحقق من الدفع واعتماد الطلب.</p>
    </>:<div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><p className="font-extrabold">الدفع بالبطاقة البنكية</p><p className="mt-1">اضغط على زر المتابعة لإرسال طلب آمن إلى بوابة الدفع المعتمدة. لن يتم اعتبار العملية مدفوعة إلا بعد تأكيدها من مزود الدفع.</p></div>}
  </div>
</section>
{error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-800">{error}</p>}
<button disabled={!vehicleId||(checkoutMethod==='manual'&&(!paymentDate||((paymentDue??Number(selectedPlan.price_egp))>0&&(!paymentReference.trim()||!(paymentMethod==='instapay'?paymentInfo.instapay_number:paymentInfo.vodafone_cash_number)))))||sending||checkingPromotion||promotionMode==='duplicate'||promotionMode==='invalid'} onClick={()=>void submitRequest()} className="mt-3 min-h-12 w-full rounded-xl bg-gradient-to-l from-[#071a31] via-[#124a7d] to-[#1767a6] px-4 font-extrabold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 disabled:opacity-50">{sending?'جارٍ تجهيز الطلب...':checkoutMethod==='online'?'المتابعة إلى بوابة الدفع الآمنة':promotionMode==='pending-existing'?'إرسال بيانات التحويل للطلب الحالي':'تأكيد وإرسال طلب الإعلان'}</button></>}</div>}</article>)}</div>}
      <div className="mt-8 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 sm:p-6"><ShieldCheck className="mt-0.5 shrink-0 text-sky-700" size={23}/><div><p className="font-extrabold text-amber-950">معلومة مهمة عن الدفع والتفعيل</p><p className="mt-2 text-sm leading-7 text-sky-900">طلب الباقة لا يعني تفعيل الإعلان تلقائيًا. تراجع الإدارة الطلب بعد تأكيد الدفع الإلكتروني أو التحقق من التحويل اليدوي. لا يتم تفعيل الإعلان تلقائيًا قبل اعتماد الإدارة. قيمة الباقة مقابل الاشتراك وعرض السيارة أمام الشركات فقط، ولا تضمن المنصة تشغيل السيارة أو الحصول على عقد تأجير.</p></div></div>
    </section>
  </main>
}
