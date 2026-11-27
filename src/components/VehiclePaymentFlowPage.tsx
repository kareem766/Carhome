import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, Check, CheckCircle2, ClipboardCheck, CreditCard, Landmark, LockKeyhole, LoaderCircle, ShieldCheck, Smartphone, Sparkles, UploadCloud, WalletCards } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createMyCarCheckout } from './PaymentMethodChoice'

type ManualMethod = 'instapay' | 'vodafone_cash'
type Method = ManualMethod | 'card'
type Vehicle = { id:string; organization_id:string; make:string; model:string; model_year:number }
type Details = { instapay_number?:string|null; vodafone_cash_number?:string|null }

export default function VehiclePaymentFlowPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const vehicleId = params.get('entity_id') || ''
  const [vehicle,setVehicle] = useState<Vehicle|null>(null)
  const [role,setRole] = useState<'owner'|'supplier'>('owner')
  const [method,setMethod] = useState<Method>('instapay')
  const [details,setDetails] = useState({instapay_number:'',vodafone_cash_number:''})
  const [cardEnabled,setCardEnabled] = useState(false)
  const [months,setMonths] = useState(1)
  const [reference,setReference] = useState('')
  const [transferDate,setTransferDate] = useState(new Date().toISOString().slice(0,10))
  const [notes,setNotes] = useState('')
  const [coupon,setCoupon] = useState('')
  const [couponMessage,setCouponMessage] = useState<{type:'success'|'error';text:string}|null>(null)
  const [discount,setDiscount] = useState<{code:string;original:number;discount:number;final:number}|null>(null)
  const [proof,setProof] = useState<File|null>(null)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState(false)
  const amount = role === 'supplier' ? 150 : 150 * months
  const finalAmount = discount?.code === coupon.trim().toUpperCase() ? discount.final : amount
  const target = role === 'supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase || !vehicleId) { setError('بيانات السيارة غير مكتملة.'); setLoading(false); return }
      const [{data:{user},error:authError},{data:vehicleData,error:vehicleError},{data:paymentData},{data:gatewayData,error:gatewayError}] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('vehicles').select('id,organization_id,make,model,model_year').eq('id',vehicleId).maybeSingle(),
        supabase.rpc('get_public_payment_details'),
        supabase.functions.invoke('payment-gateway-status')
      ])
      if (!active) return
      if (authError || !user) { window.location.replace('/?login=1&redirect='+encodeURIComponent(window.location.pathname+window.location.search)); return }
      const accountType = String(user.user_metadata?.organization_type || '')
      const nextRole = accountType === 'fleet_supplier' ? 'supplier' : 'owner'
      setRole(nextRole)
      if (vehicleError || !vehicleData) { setError('تعذر العثور على السيارة المسجلة. ارجع إلى سياراتي وتحقق من حالة التسجيل.'); setLoading(false); return }
      setVehicle(vehicleData as Vehicle)
      const paymentDetails = (Array.isArray(paymentData) ? paymentData[0] : paymentData) as Details|null
      const nextDetails = {instapay_number:String(paymentDetails?.instapay_number||'').trim(),vodafone_cash_number:String(paymentDetails?.vodafone_cash_number||'').trim()}
      setDetails(nextDetails)
      const providers = Array.isArray(gatewayData?.enabled_providers) ? gatewayData.enabled_providers as Array<{provider_code?:string}> : []
      setCardEnabled(!gatewayError && providers.some(item => item.provider_code === 'paymob'))
      if (!nextDetails.instapay_number && nextDetails.vodafone_cash_number) setMethod('vodafone_cash')
      else if (!nextDetails.instapay_number && !nextDetails.vodafone_cash_number && !gatewayError && providers.some(item=>item.provider_code==='paymob')) setMethod('card')
      setLoading(false)
    }
    void load().catch(()=>{if(active){setError('تعذر تحميل بيانات الدفع. حاول تحديث الصفحة.');setLoading(false)}})
    return ()=>{active=false}
  },[vehicleId])

  async function applyCoupon() {
    if (!supabase || !vehicle) return
    const code=coupon.trim().toUpperCase()
    if (!code) {setDiscount(null);setCouponMessage({type:'error',text:'اكتب كود الخصم أولًا.'});return}
    setSaving(true);setError('');setCouponMessage(null)
    const {data,error:couponError}=await supabase.rpc('preview_discount_code',{p_code:code,p_service:'vehicle_registration',p_reference_id:vehicle.id,p_period:'monthly',p_period_months:role==='supplier'?1:months})
    setSaving(false)
    if(couponError||!data){setDiscount(null);setCoupon('');setCouponMessage({type:'error',text:'كود الخصم غير صالح أو منتهي أو غير مخصص لهذه الخدمة.'});return}
    setDiscount({code:String(data.code||code),original:Number(data.original_amount_egp||0),discount:Number(data.discount_amount_egp||0),final:Number(data.final_amount_egp||0)})
    setCouponMessage({type:'success',text:'تم تطبيق كود الخصم بنجاح. المبلغ بعد الخصم: '+Number(data.final_amount_egp||0).toLocaleString('ar-EG')+' جنيه.'})
  }

  async function submitManual(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(!supabase||!vehicle||saving)return
    if(!reference.trim()||!transferDate){setError('أدخل رقم العملية وتاريخ التحويل.');return}
    if(finalAmount<=0 && discount?.code===coupon.trim().toUpperCase()){
      setSaving(true);setError('')
      const {data:{user}}=await supabase.auth.getUser()
      if(!user){setSaving(false);setError('انتهت جلسة الدخول. سجّل الدخول وحاول مرة أخرى.');return}
      const {error:zeroError}=await supabase.from('vehicle_payment_submissions').insert({
        vehicle_id:vehicle.id,organization_id:vehicle.organization_id,submitted_by:user.id,
        amount_egp:amount,period_months:role==='supplier'?1:months,coupon_code:discount.code,
        transfer_method:'online',transfer_reference:'لا يوجد مبلغ مستحق بعد الخصم',proof_path:null,review_status:'pending'
      })
      setSaving(false)
      if(zeroError){setError(zeroError.message);return}
      setSuccess(true);window.setTimeout(()=>window.location.replace(target),3200);return
    }
    const paymentNumber=method==='instapay'?details.instapay_number:details.vodafone_cash_number
    if(!paymentNumber){setError('وسيلة التحويل المختارة غير متاحة حاليًا.');return}
    if(proof&&(!['image/jpeg','image/png','image/webp','application/pdf'].includes(proof.type)||proof.size>5*1024*1024)){setError('ملف الإثبات يجب أن يكون JPG أو PNG أو WEBP أو PDF وبحد أقصى 5 ميجابايت.');return}
    setSaving(true);setError('')
    let proofPath:string|null=null
    if(proof){
      const extension=proof.type==='application/pdf'?'pdf':proof.type.split('/')[1].replace('jpeg','jpg')
      proofPath=vehicle.organization_id+'/'+vehicle.id+'/'+crypto.randomUUID()+'.'+extension
      const {error:uploadError}=await supabase.storage.from('payment-proofs').upload(proofPath,proof,{contentType:proof.type,upsert:false})
      if(uploadError){setSaving(false);setError('تعذر رفع إثبات التحويل: '+uploadError.message);return}
    }
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){if(proofPath)await supabase.storage.from('payment-proofs').remove([proofPath]);setSaving(false);setError('انتهت جلسة الدخول. سجّل الدخول وحاول مرة أخرى.');return}
    const {error:insertError}=await supabase.from('vehicle_payment_submissions').insert({
      vehicle_id:vehicle.id,organization_id:vehicle.organization_id,submitted_by:user.id,
      amount_egp:role==='supplier'?150:150*months,period_months:role==='supplier'?1:months,
      coupon_code:discount?.code===coupon.trim().toUpperCase()?discount.code:null,
      transfer_method:method,
      transfer_reference:['رقم العملية: '+reference.trim(),'تاريخ التحويل: '+transferDate,'الملاحظات: '+notes.trim()].join(' | '),
      proof_path:proofPath,review_status:'pending'
    })
    if(insertError){if(proofPath)await supabase.storage.from('payment-proofs').remove([proofPath]);setSaving(false);setError(insertError.message.includes('Could not find the table')?'خدمة تسجيل التحويلات غير مفعلة بعد. تواصل مع الدعم.':insertError.message);return}
    setSaving(false);setSuccess(true)
    window.setTimeout(()=>window.location.replace(target),3200)
  }

  async function continueCard() {
    if(!vehicle||!cardEnabled||saving)return
    setSaving(true);setError('')
    try { await createMyCarCheckout({purpose:'vehicle_registration',entityId:vehicle.id,periodMonths:role==='supplier'?1:months,couponCode:discount?.code===coupon.trim().toUpperCase()?discount.code:null}) }
    catch(caught){setSaving(false);setError(caught instanceof Error?caught.message:'تعذر بدء الدفع الآمن.')}
  }

  const buttonClass='min-h-12 rounded-xl px-4 py-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50'
  const selected='border-sky-500 bg-[linear-gradient(145deg,#eff8ff_0%,#ffffff_72%,#fff7ed_100%)] ring-2 ring-sky-100 shadow-[0_18px_42px_-22px_rgba(14,116,190,.55)]'
  const stepBase='flex min-w-0 items-center gap-3 rounded-2xl border p-3 sm:p-4'
  const stepActive='border-sky-300 bg-sky-50 shadow-[0_12px_30px_-20px_rgba(2,132,199,.55)]'
  const stepDone='border-emerald-200 bg-emerald-50/80'
  const stepIdle='border-slate-200 bg-white'
  return <main dir="rtl" className="flex min-h-screen items-start justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,.14),transparent_28%),radial-gradient(ellipse_at_bottom_left,rgba(37,99,235,.18),transparent_38%),linear-gradient(145deg,#071426 0%,#102b47 38%,#edf3fa 38%,#f7f9fc 100%)] px-4 py-8 sm:items-center">
    <section className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_35px_100px_-38px_rgba(2,18,38,.55)] ring-1 ring-slate-900/5">
      <header className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_8%_15%,rgba(249,115,22,.28),transparent_25%),radial-gradient(circle_at_88%_0%,rgba(56,189,248,.22),transparent_28%),linear-gradient(125deg,#061426_0%,#0b2948_52%,#14558a_100%)] p-6 text-white sm:p-10"><div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full border-[30px] border-white/[0.06]"/><div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full border border-white/10"/><div className="relative"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><img src="https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png" alt="" className="h-12 w-12 rounded-xl border border-white/15 bg-white/10 p-1 object-contain shadow-lg"/><div><div className="text-xl font-black tracking-tight"><span className="text-white">My Car</span><span className="mr-2 text-orange-400">عربيتي</span></div><p className="mt-1 text-xs font-semibold text-white/90">منصة السيارات للشركات والأساطيل في مصر</p></div></div><span className="hidden items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100 sm:inline-flex"><LockKeyhole size={14}/> بيئة دفع آمنة</span></div><p className="mt-7 inline-flex items-center rounded-full border border-orange-300/30 bg-white/[0.08] px-4 py-2 text-xs font-extrabold text-orange-100"><ShieldCheck size={14} className="ml-2"/> MY CAR · مركز الدفع الموحد</p><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">خطوة واحدة تفصلك عن <span className="text-orange-300">إكمال التسجيل.</span></h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">اتبع الخطوات الموضحة، واختر طريقة الدفع المناسبة. التحويل اليدوي يُرسل للإدارة للمراجعة قبل اعتماد السيارة.</p><div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-bold text-white/85"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"><ShieldCheck size={14} className="text-emerald-300"/> حماية بياناتك</span><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"><CreditCard size={14} className="text-sky-200"/> خيارات دفع واضحة</span><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"><ClipboardCheck size={14} className="text-orange-200"/> متابعة حالة الطلب</span></div></div></header>
      <div className="space-y-6 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafd_100%)] p-5 sm:p-9">
        {loading?<div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-500"><LoaderCircle className="animate-spin"/> جارٍ تحميل بيانات السيارة ووسائل الدفع...</div>:<>
          {vehicle&&<div className="rounded-2xl border border-blue-100 bg-[linear-gradient(110deg,#f0f6ff_0%,#ffffff_65%,#fff7ed_100%)] p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">السيارة</p><h2 className="mt-1 text-lg font-black text-slate-900">{vehicle.make} {vehicle.model} · {vehicle.model_year}</h2><p className="mt-1 text-sm text-slate-600">رسوم التسجيل: {role==='supplier'?'150 جنيهًا':'150 جنيه شهريًا'}</p></div>}
          <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-800 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,.2),transparent_35%),linear-gradient(115deg,#07182b_0%,#102f50_65%,#174b70_100%)] p-5 text-white shadow-[0_22px_55px_-30px_rgba(7,24,43,.8)] sm:p-6"><div className="absolute -left-10 -top-12 h-36 w-36 rounded-full border-[18px] border-white/[0.05]"/><div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-sky-100/80">ملخص رسوم التسجيل</p><p className="mt-2 text-3xl font-black tracking-tight" dir="rtl">{finalAmount.toLocaleString('ar-EG')} <span className="text-base font-bold text-sky-100">جنيه</span></p><p className="mt-1 text-xs font-semibold text-sky-100/75">{role==='supplier'?'رسوم تسجيل السيارة':'رسوم التسجيل لمدة '+months+' '+(months===1?'شهر':months===2?'شهرين':'أشهر')}</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-orange-300"><WalletCards size={25}/></span></div><div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-3 text-xs font-semibold text-sky-100/85"><span>القيمة قبل الخصم: {amount.toLocaleString('ar-EG')} جنيه</span>{discount?.code===coupon.trim().toUpperCase()&&<span className="text-emerald-300">قيمة الخصم: {discount.discount.toLocaleString('ar-EG')} جنيه</span>}<span className="inline-flex items-center gap-1"><ShieldCheck size={14}/> لا توجد رسوم مخفية</span></div></div>
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_16px_45px_-35px_rgba(15,23,42,.4)] sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold tracking-wide text-slate-500">رحلة التسجيل والدفع</p><h3 className="mt-1 text-base font-black text-slate-900">كل خطوة واضحة من البداية للنهاية</h3></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-extrabold text-sky-800">3 خطوات بسيطة</span></div><div className="grid gap-2 sm:grid-cols-3"><div className={stepBase+' '+stepDone}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Check size={20}/></span><span className="min-w-0"><b className="block text-xs font-black text-slate-900">١. بيانات السيارة</b><small className="mt-1 block text-[11px] leading-5 text-slate-500">تم تسجيل بيانات سيارتك</small></span></div><div className={stepBase+' '+stepActive}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700"><WalletCards size={20}/></span><span className="min-w-0"><b className="block text-xs font-black text-slate-900">٢. اختيار الدفع</b><small className="mt-1 block text-[11px] leading-5 text-slate-500">اختر الطريقة وأكمل الدفع</small></span></div><div className={stepBase+' '+stepIdle}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><ClipboardCheck size={20}/></span><span className="min-w-0"><b className="block text-xs font-black text-slate-900">٣. المراجعة والاعتماد</b><small className="mt-1 block text-[11px] leading-5 text-slate-500">نراجع طلبك ونحدث حالته</small></span></div></div></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" disabled={!details.instapay_number} onClick={()=>setMethod('instapay')} className={buttonClass+' group relative flex min-h-[142px] flex-col items-start justify-between overflow-hidden rounded-[1.35rem] border p-5 text-right shadow-[0_10px_30px_-24px_rgba(15,23,42,.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl '+(method==='instapay'?selected:'border-slate-200 bg-white hover:border-sky-200')}><span className="absolute -left-5 -top-7 h-24 w-24 rounded-full bg-sky-100/70 transition-transform group-hover:scale-125"/><span className="relative flex w-full items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-sky-800 shadow-sm"><Landmark size={24}/></span>{method==='instapay'&&<CheckCircle2 size={20} className="text-sky-700"/>}</span><span className="relative mt-3"><b className="block text-base text-slate-900">InstaPay</b><small className="mt-1 block text-xs font-semibold text-slate-500">{details.instapay_number?'تحويل بنكي فوري':'غير متاح حاليًا'}</small></span></button>
            <button type="button" disabled={!details.vodafone_cash_number} onClick={()=>setMethod('vodafone_cash')} className={buttonClass+' group relative flex min-h-[142px] flex-col items-start justify-between overflow-hidden rounded-[1.35rem] border p-5 text-right shadow-[0_10px_30px_-24px_rgba(15,23,42,.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl '+(method==='vodafone_cash'?selected:'border-slate-200 bg-white hover:border-rose-200')}><span className="absolute -left-5 -top-7 h-24 w-24 rounded-full bg-rose-100/70 transition-transform group-hover:scale-125"/><span className="relative flex w-full items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-700 shadow-sm"><Smartphone size={24}/></span>{method==='vodafone_cash'&&<CheckCircle2 size={20} className="text-sky-700"/>}</span><span className="relative mt-3"><b className="block text-base text-slate-900">Vodafone Cash</b><small className="mt-1 block text-xs font-semibold text-slate-500">{details.vodafone_cash_number?'محفظة إلكترونية':'غير متاح حاليًا'}</small></span></button>
            <button type="button" disabled={!cardEnabled} onClick={()=>setMethod('card')} className={buttonClass+' group relative flex min-h-[142px] flex-col items-start justify-between overflow-hidden rounded-[1.35rem] border p-5 text-right shadow-[0_10px_30px_-24px_rgba(15,23,42,.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl '+(method==='card'?selected:'border-slate-200 bg-white hover:border-indigo-200')}><span className="absolute -left-5 -top-7 h-24 w-24 rounded-full bg-indigo-100/70 transition-transform group-hover:scale-125"/><span className="relative flex w-full items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-800 shadow-sm"><CreditCard size={24}/></span>{method==='card'&&<CheckCircle2 size={20} className="text-sky-700"/>}</span><span className="relative mt-3"><b className="block text-base text-slate-900">بطاقة بنكية</b><small className="mt-1 block text-xs font-semibold text-slate-500">{cardEnabled?'دفع إلكتروني آمن':'غير متاح حتى اعتماد البوابة'}</small></span></button>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-[linear-gradient(110deg,#fffaf0,#ffffff)] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Sparkles size={19}/></span><p className="text-xs font-semibold leading-6 text-slate-700">اختر وسيلة الدفع المتاحة أمامك. بعد التحويل اليدوي، أرسل رقم العملية وتاريخ التحويل حتى يصل طلبك إلى الإدارة للمراجعة.</p></div>
          {role==='owner'&&<label className="block text-sm font-bold text-slate-800">مدة التسجيل<select value={months} onChange={e=>{setMonths(Number(e.target.value));setDiscount(null)}} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value={1}>شهر واحد — 150 جنيه</option><option value={3}>3 شهور — 450 جنيه</option><option value={6}>6 شهور — 900 جنيه</option><option value={12}>12 شهرًا — 1,800 جنيه</option></select></label>}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="block text-sm font-bold text-slate-800">كود الخصم (اختياري)</label><div className="mt-2 flex gap-2"><input value={coupon} onChange={e=>{setCoupon(e.target.value.toUpperCase());setDiscount(null);setCouponMessage(null)}} placeholder="أدخل البروموكود" aria-describedby={couponMessage?'vehicle-coupon-message':undefined} aria-invalid={couponMessage?.type==='error'} className={'min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm uppercase outline-none transition focus:ring-4 '+(couponMessage?.type==='error'?'border-rose-300 focus:border-rose-400 focus:ring-rose-100':couponMessage?.type==='success'?'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100':'border-slate-200 focus:border-blue-500 focus:ring-blue-100')}/><button type="button" disabled={saving} onClick={()=>void applyCoupon()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-extrabold text-blue-800 disabled:opacity-50">تطبيق</button></div>{couponMessage&&<p id="vehicle-coupon-message" role="status" className={'mt-2 text-sm font-bold '+(couponMessage.type==='success'?'text-emerald-700':'text-rose-700')}>{couponMessage.text}</p>}</div>
          {method==='card'?<div className="space-y-3"><div className="rounded-2xl border border-indigo-100 bg-[linear-gradient(110deg,#eef2ff,#ffffff)] p-5"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-indigo-800"><LockKeyhole size={21}/></span><div><b className="block text-sm font-black text-slate-900">دفع إلكتروني محمي</b><small className="text-xs font-semibold text-slate-500">ستنتقل إلى بوابة مزود الدفع لإتمام العملية</small></div></div><p className="mt-3 text-sm leading-7 text-slate-700">لن تحتفظ My Car ببيانات بطاقتك البنكية. لا يتم تأكيد الدفع إلا بعد استلام إشعار نجاح موثوق من بوابة الدفع.</p></div><button type="button" disabled={!cardEnabled||saving} onClick={()=>void continueCard()} className={buttonClass+' w-full rounded-2xl bg-[linear-gradient(105deg,#071b31_0%,#124a7d_65%,#1767a6_100%)] text-white shadow-[0_16px_30px_-14px_rgba(15,59,100,.65)] hover:-translate-y-0.5 hover:shadow-xl'}>{saving?'جارٍ تجهيز الدفع الآمن...':'الانتقال إلى الدفع الآمن بالبطاقة'}</button></div>:<form onSubmit={event=>void submitManual(event)} className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-sky-200 bg-[linear-gradient(115deg,#eff8ff_0%,#ffffff_70%,#fff7ed_100%)] shadow-sm"><div className="flex items-center gap-3 border-b border-sky-100 px-4 py-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-800">{method==='instapay'?<Landmark size={20}/>:<Smartphone size={20}/>}</span><div><b className="block text-sm font-black text-slate-900">بيانات التحويل المعتمدة</b><small className="text-xs font-semibold text-slate-500">حوّل المبلغ أولًا ثم أكمل بيانات العملية</small></div></div><div className="p-4"><p className="text-[11px] font-bold text-slate-500">رقم التحويل</p><div className="mt-2 rounded-xl border border-sky-100 bg-white px-4 py-3 text-lg font-black tracking-wide text-slate-900 shadow-inner" dir="ltr">{method==='instapay'?details.instapay_number:details.vodafone_cash_number}</div><p className="mt-2 text-xs leading-6 text-slate-600">تأكد من تحويل المبلغ إلى الرقم الموضح أعلاه قبل إرسال بيانات الدفع.</p></div></div>
            <label className="block text-sm font-extrabold text-slate-800"><span className="inline-flex items-center gap-2"><ClipboardCheck size={16} className="text-sky-700"/> رقم العملية <span className="text-rose-600">*</span></span><input required value={reference} onChange={e=>setReference(e.target.value)} minLength={3} maxLength={100} placeholder="اكتب رقم مرجع التحويل" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></label>
            <label className="block text-sm font-extrabold text-slate-800"><span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-sky-700"/> تاريخ التحويل <span className="text-rose-600">*</span></span><input required type="date" max={new Date().toISOString().slice(0,10)} value={transferDate} onChange={e=>setTransferDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></label>
            <label className="block text-sm font-extrabold text-slate-800"><span className="inline-flex items-center gap-2"><UploadCloud size={16} className="text-sky-700"/> إثبات التحويل <span className="text-xs font-semibold text-slate-400">(اختياري)</span></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-sky-800"/><small className="mt-1 block text-xs font-medium text-slate-500">JPG أو PNG أو WEBP أو PDF · بحد أقصى 5 ميجابايت</small></label>
            <label className="block text-sm font-bold">ملاحظات (اختياري)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></label>
            <p className="text-xs leading-6 text-slate-500">بعد إرسال بيانات التحويل، سيصلك تحديث بحالة طلبك.</p>
            <button type="submit" disabled={saving} className="relative z-10 block min-h-[58px] w-full cursor-pointer rounded-2xl border-2 border-[#0b2948] bg-[#0b2948] px-5 py-4 text-center text-base font-black leading-7 text-white opacity-100 shadow-[0_14px_30px_-12px_rgba(11,41,72,.65)] transition hover:-translate-y-0.5 hover:bg-[#124a7d] hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:bg-slate-500 disabled:opacity-100">{saving?'جارٍ إرسال بيانات الدفع...':'تأكيد التحويل وإرسال السيارة للمراجعة'}</button>
          </form>}
          {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
        </>}
      </div>
    </section>
    {success&&<div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-md"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-2xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={42}/></div><h2 className="mt-5 text-xl font-black leading-8 text-slate-900">تم تسجيل سيارتك وتأكيد بيانات الدفع</h2><p className="mt-3 text-sm font-bold leading-7 text-slate-700">حاليًا الطلب في المراجعة.</p><p className="mt-5 text-xs font-bold text-emerald-700">سيتم تحويلك تلقائيًا إلى صفحة سياراتي...</p></section></div>}
  </main>
}
