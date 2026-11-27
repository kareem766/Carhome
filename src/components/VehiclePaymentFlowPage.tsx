import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, CreditCard, Landmark, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createMyCarCheckout } from './PaymentMethodChoice'
import PlatformBrand from './PlatformBrand'

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
    if (!code) {setDiscount(null);setError('اكتب كود الخصم أولًا.');return}
    setSaving(true);setError('')
    const {data,error:couponError}=await supabase.rpc('preview_discount_code',{p_code:code,p_service:'vehicle_registration',p_reference_id:vehicle.id,p_period:'monthly',p_period_months:role==='supplier'?1:months})
    setSaving(false)
    if(couponError||!data){setDiscount(null);setError(couponError?.message||'كود الخصم غير صالح أو غير متاح لهذه الخدمة.');return}
    setDiscount({code:String(data.code||code),original:Number(data.original_amount_egp||0),discount:Number(data.discount_amount_egp||0),final:Number(data.final_amount_egp||0)})
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
  const selected='border-blue-600 bg-blue-50 ring-2 ring-blue-100 shadow-md'
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,.12),transparent_38%),linear-gradient(180deg,#f4f7fb,#eaf0f8)] px-4 py-8">
    <section className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,.35)]">
      <header className="bg-gradient-to-l from-[#071b31] via-[#103d68] to-[#176da7] p-6 text-white sm:p-8"><PlatformBrand/><p className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-extrabold text-cyan-100"><ShieldCheck size={14} className="ml-2"/> مركز الدفع الموحد</p><h1 className="mt-3 text-2xl font-black">إتمام رسوم تسجيل السيارة</h1><p className="mt-2 text-sm leading-7 text-blue-100">اختر وسيلة الدفع المناسبة، وأكمل العملية بأمان. بعد إرسال التحويل اليدوي سيُرسل الطلب للمراجعة.</p></header>
      <div className="space-y-5 p-5 sm:p-8">
        {loading?<div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-500"><LoaderCircle className="animate-spin"/> جارٍ تحميل بيانات السيارة ووسائل الدفع...</div>:<>
          {vehicle&&<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">السيارة</p><h2 className="mt-1 text-lg font-black text-slate-900">{vehicle.make} {vehicle.model} · {vehicle.model_year}</h2><p className="mt-1 text-sm text-slate-600">رسوم التسجيل: {role==='supplier'?'150 جنيهًا (مرة واحدة)':'150 جنيه شهريًا'}</p></div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" disabled={!details.instapay_number} onClick={()=>setMethod('instapay')} className={buttonClass+' flex flex-col items-start border rounded-2xl '+(method==='instapay'?selected:'border-slate-200')}><Landmark className="text-sky-700"/><b className="mt-2 text-slate-900">InstaPay</b><small className="text-slate-500">{details.instapay_number?'تحويل يدوي':'غير متاح حاليًا'}</small></button>
            <button type="button" disabled={!details.vodafone_cash_number} onClick={()=>setMethod('vodafone_cash')} className={buttonClass+' flex flex-col items-start border rounded-2xl '+(method==='vodafone_cash'?selected:'border-slate-200')}><Smartphone className="text-red-700"/><b className="mt-2 text-slate-900">Vodafone Cash</b><small className="text-slate-500">{details.vodafone_cash_number?'تحويل يدوي':'غير متاح حاليًا'}</small></button>
            <button type="button" disabled={!cardEnabled} onClick={()=>setMethod('card')} className={buttonClass+' flex flex-col items-start border rounded-2xl '+(method==='card'?selected:'border-slate-200')}><CreditCard className="text-blue-700"/><b className="mt-2 text-slate-900">بطاقة بنكية</b><small className="text-slate-500">{cardEnabled?'بوابة دفع آمنة':'غير متاح حتى اعتماد البوابة'}</small></button>
          </div>
          {role==='owner'&&<label className="block text-sm font-bold text-slate-800">مدة التسجيل<select value={months} onChange={e=>{setMonths(Number(e.target.value));setDiscount(null)}} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value={1}>شهر واحد — 150 جنيه</option><option value={3}>3 شهور — 450 جنيه</option><option value={6}>6 شهور — 900 جنيه</option><option value={12}>12 شهرًا — 1,800 جنيه</option></select></label>}
          <div className="rounded-xl border border-slate-200 p-4"><label className="block text-sm font-bold text-slate-800">كود الخصم (اختياري)</label><div className="mt-2 flex gap-2"><input value={coupon} onChange={e=>{setCoupon(e.target.value.toUpperCase());setDiscount(null)}} placeholder="أدخل البروموكود" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm uppercase"/><button type="button" disabled={saving} onClick={()=>void applyCoupon()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-extrabold text-blue-800">تطبيق</button></div>{discount&&<p className="mt-2 text-sm font-bold text-emerald-700">تم تطبيق الخصم. المبلغ النهائي: {discount.final.toLocaleString('ar-EG')} جنيه.</p>}</div>
          {method==='card'?<div className="space-y-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950">سيتم توجيهك إلى صفحة الدفع الآمنة التابعة لمزود الخدمة. لن تحتفظ My Car ببيانات بطاقتك.</div><button type="button" disabled={!cardEnabled||saving} onClick={()=>void continueCard()} className={buttonClass+' w-full bg-gradient-to-l from-[#102b47] to-blue-700 text-white'}>{saving?'جارٍ تجهيز الدفع الآمن...':'الانتقال إلى الدفع الآمن بالبطاقة'}</button></div>:<form onSubmit={event=>void submitManual(event)} className="space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-sky-950"><b>بيانات التحويل المعتمدة</b><p className="mt-2 text-xs text-slate-600">حوّل المبلغ أولًا، ثم أدخل بيانات العملية لإرسالها إلى الإدارة للمراجعة.</p><p className="mt-2 font-black" dir="ltr">{method==='instapay'?details.instapay_number:details.vodafone_cash_number}</p></div>
            <label className="block text-sm font-bold">رقم العملية *<input required value={reference} onChange={e=>setReference(e.target.value)} minLength={3} maxLength={100} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3"/></label>
            <label className="block text-sm font-bold">تاريخ التحويل *<input required type="date" max={new Date().toISOString().slice(0,10)} value={transferDate} onChange={e=>setTransferDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3"/></label>
            <label className="block text-sm font-bold">إثبات التحويل (اختياري)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 p-2 text-sm"/></label>
            <label className="block text-sm font-bold">ملاحظات (اختياري)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 p-3"/></label>
            <p className="text-xs leading-6 text-slate-500">التحويل اليدوي لا يؤكد الدفع آليًا؛ ستراجع الإدارة بيانات التحويل قبل اعتماد السيارة.</p>
            <button disabled={saving} className={buttonClass+' w-full bg-gradient-to-l from-[#102b47] to-blue-700 text-white'}>{saving?'جارٍ إرسال بيانات الدفع...':'تأكيد التحويل وإرسال السيارة للمراجعة'}</button>
          </form>}
          {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
        </>}
      </div>
    </section>
    {success&&<div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-md"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-2xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={42}/></div><h2 className="mt-5 text-xl font-black leading-8 text-slate-900">تم تسجيل سيارتك وتأكيد بيانات الدفع</h2><p className="mt-3 text-sm font-bold leading-7 text-slate-700">حاليًا الطلب في المراجعة.</p><p className="mt-5 text-xs font-bold text-emerald-700">سيتم تحويلك تلقائيًا إلى صفحة سياراتي...</p></section></div>}
  </main>
}
