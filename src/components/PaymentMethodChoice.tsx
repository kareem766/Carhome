import { useEffect, useState } from 'react'
import { CheckCircle2, CreditCard, Landmark, ShieldCheck, Smartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type MyCarPaymentMethod = 'manual' | 'online'
type ManualMethod = 'instapay' | 'vodafone_cash'

type PaymentMethodChoiceProps = {
  value: MyCarPaymentMethod
  onChange: (value: MyCarPaymentMethod) => void
  disabled?: boolean
  onlineDisabled?: boolean
  manualMethod?: ManualMethod
  onManualMethodChange?: (method: ManualMethod) => void
  availableManualMethods?: ManualMethod[]
}

export function PaymentMethodChoice({ value, onChange, disabled = false, onlineDisabled = false, manualMethod: controlledManualMethod, onManualMethodChange, availableManualMethods }: PaymentMethodChoiceProps) {
  const [internalManualMethod, setInternalManualMethod] = useState<ManualMethod>('instapay')
  const manualMethod = controlledManualMethod ?? internalManualMethod
  const [onlineEnabled, setOnlineEnabled] = useState(false)
  const [providerLabel, setProviderLabel] = useState('سيتم إتاحته بعد اعتماد بوابة الدفع')
  useEffect(() => {
    if (!availableManualMethods?.length || availableManualMethods.includes(manualMethod)) return
    const next = availableManualMethods[0]
    setInternalManualMethod(next)
    onManualMethodChange?.(next)
  }, [availableManualMethods?.join('|'), manualMethod, onManualMethodChange])
  useEffect(() => {
    let active = true
    if (!supabase) return () => { active = false }
    void supabase.functions.invoke('payment-gateway-status').then(({ data, error }) => {
      if (!active || error) return
      const providers = Array.isArray(data?.enabled_providers) ? data.enabled_providers as Array<{ provider_code?: string; display_name?: string }> : []
      const paymob = providers.find(provider => provider.provider_code === 'paymob')
      setOnlineEnabled(Boolean(paymob))
      setProviderLabel(paymob?.display_name || 'غير متاح حاليًا')
      if (!paymob && value === 'online') onChange('manual')
    }).catch(() => { if (active) setOnlineEnabled(false) })
    return () => { active = false }
  }, [onChange, value])

  const cardDisabled = disabled || onlineDisabled || !onlineEnabled
  const manualDisabled = disabled
  const instapayDisabled = manualDisabled || (availableManualMethods !== undefined && !availableManualMethods.includes('instapay'))
  const vodafoneDisabled = manualDisabled || (availableManualMethods !== undefined && !availableManualMethods.includes('vodafone_cash'))
  const chooseManual = (method: ManualMethod) => {
    if (method === 'instapay' ? instapayDisabled : vodafoneDisabled) return
    setInternalManualMethod(method)
    onManualMethodChange?.(method)
    onChange('manual')
  }
  const cardClass = (selected: boolean, unavailable = false) =>
    `relative flex min-h-[142px] w-full flex-col items-start rounded-2xl border p-4 text-right transition duration-200 ${selected ? 'border-blue-600 bg-blue-50 shadow-[0_10px_28px_-18px_rgba(29,78,216,.65)] ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'} ${unavailable ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`

  return <fieldset className="space-y-4" disabled={disabled}>
    <legend className="text-sm font-black text-slate-900">اختر طريقة الدفع</legend>
    <p className="text-xs leading-6 text-slate-500">اختر الوسيلة المناسبة. التحويلات اليدوية تظل قيد المراجعة حتى التحقق من وصول المبلغ.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <button type="button" disabled={instapayDisabled} aria-pressed={value === 'manual' && manualMethod === 'instapay'} onClick={() => chooseManual('instapay')} className={cardClass(value === 'manual' && manualMethod === 'instapay', instapayDisabled)}>
        {value === 'manual' && manualMethod === 'instapay' && <CheckCircle2 size={18} className="absolute left-3 top-3 text-blue-700"/>}
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-sky-800"><Landmark size={22}/></span>
        <span className="mt-3 text-sm font-black text-slate-900">InstaPay</span>
        <span className="mt-1 text-xs leading-5 text-slate-500">تحويل فوري وإرسال بيانات العملية للمراجعة</span>
        <span className="mt-auto pt-3 text-[10px] font-extrabold text-sky-800">تحويل يدوي</span>
      </button>
      <button type="button" disabled={vodafoneDisabled} aria-pressed={value === 'manual' && manualMethod === 'vodafone_cash'} onClick={() => chooseManual('vodafone_cash')} className={cardClass(value === 'manual' && manualMethod === 'vodafone_cash', vodafoneDisabled)}>
        {value === 'manual' && manualMethod === 'vodafone_cash' && <CheckCircle2 size={18} className="absolute left-3 top-3 text-blue-700"/>}
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-700"><Smartphone size={22}/></span>
        <span className="mt-3 text-sm font-black text-slate-900">Vodafone Cash</span>
        <span className="mt-1 text-xs leading-5 text-slate-500">تحويل إلى محفظة المنصة وإرسال رقم العملية</span>
        <span className="mt-auto pt-3 text-[10px] font-extrabold text-red-700">محفظة إلكترونية</span>
      </button>
      <button type="button" disabled={cardDisabled} aria-pressed={value === 'online'} onClick={() => onChange('online')} className={cardClass(value === 'online', cardDisabled)}>
        {value === 'online' && <CheckCircle2 size={18} className="absolute left-3 top-3 text-blue-700"/>}
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-blue-800"><CreditCard size={22}/></span>
        <span className="mt-3 text-sm font-black text-slate-900">بطاقة بنكية</span>
        <span className="mt-1 text-xs leading-5 text-slate-500">الدفع عبر صفحة بوابة آمنة ثم العودة إلى عربيتي</span>
        <span className={`mt-auto pt-3 text-[10px] font-extrabold ${onlineEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>{onlineEnabled ? providerLabel : 'غير متاحة حتى اعتماد وربط البوابة'}</span>
      </button>
    </div>
    {availableManualMethods && availableManualMethods.length === 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-800">التحويل اليدوي غير متاح حاليًا لعدم تسجيل بيانات وسائل الدفع. يمكنك استخدام الدفع الإلكتروني إذا كان مفعّلًا.</p>}
    <input type="hidden" name="transfer_method" value={manualMethod}/>
    <input type="hidden" name="payment_method" value={manualMethod === 'instapay' ? 'instapay' : 'vodafone'}/>
    <input type="hidden" name="advertising_payment_method" value={manualMethod}/>
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-blue-700"/>
      <span>لا يتم تفعيل السيارة أو الاشتراك أو الإعلان بمجرد إرسال التحويل أو الرجوع من بوابة الدفع؛ يلزم التحقق من الدفع ثم مراجعة الإدارة.</span>
    </div>
  </fieldset>
}

export async function createMyCarCheckout(args: {
  purpose: string
  entityId: string
  periodMonths?: number
  couponCode?: string | null
}) {
  if (!supabase) throw new Error('إعدادات الاتصال غير مكتملة.')
  const idempotencyKey = `mycar:${args.purpose}:${args.entityId}`
  const messages: Record<string, string> = {
    gateway_disabled: 'الدفع الإلكتروني غير مفعّل حاليًا. يمكنك استخدام التحويل اليدوي.',
    billing_phone_required: 'أضف رقم موبايل مصري صحيح في بيانات حسابك قبل الدفع الإلكتروني.',
    billing_email_required: 'أضف بريدًا إلكترونيًا صحيحًا في بيانات حسابك قبل الدفع الإلكتروني.',
    paymob_credentials_missing: 'بوابة الدفع لم تكتمل إعداداتها بعد. يمكنك استخدام التحويل اليدوي.',
    payment_attempt_in_progress: 'جارٍ تجهيز رابط الدفع بالفعل. انتظر لحظات ثم حدّث الصفحة لمتابعة الحالة.',
    fawry_checkout_requires_confirmed_merchant_product: 'الدفع عبر فوري غير متاح حتى تأكيد نوع الخدمة المتعاقد عليها.',
  }
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: {
      purpose: args.purpose,
      entity_id: args.entityId,
      provider: 'paymob',
      idempotency_key: idempotencyKey,
      return_origin: window.location.origin,
      ...(args.periodMonths ? { period_months: args.periodMonths } : {}),
      ...(args.couponCode ? { coupon_code: args.couponCode } : {}),
    },
  })
  if (error) {
    const response = (error as unknown as { context?: Response }).context
    if (response && typeof response.clone === 'function') {
      let body: { error?: string; message?: string } | null = null
      try { body = await response.clone().json() as { error?: string; message?: string } } catch { /* use the SDK error below */ }
      if (body) throw new Error(messages[String(body.error || '')] || body.message || error.message || 'تعذر بدء الدفع الإلكتروني.')
    }
    throw new Error(error.message || 'تعذر بدء الدفع الإلكتروني.')
  }
  if (!data?.checkout_url || typeof data.checkout_url !== 'string') {
    throw new Error(messages[String(data?.error)] || data?.message || 'تعذر إنشاء رابط الدفع الإلكتروني.')
  }
  window.location.assign(data.checkout_url)
}
