import { useEffect, useState } from 'react'
import { ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react'
export type MyCarPaymentMethod = 'manual' | 'online'

type ManualMethod = 'instapay' | 'vodafone_cash'
type Props = {
  value: MyCarPaymentMethod
  onChange: (value: MyCarPaymentMethod) => void
  purpose: string
  onlineDisabled?: boolean
  manualMethod?: ManualMethod
  onManualMethodChange?: (method: ManualMethod) => void
  availableManualMethods?: ManualMethod[]
}

export function PaymentMethodChoice({ value, onChange, purpose, onlineDisabled = false, manualMethod: controlledManualMethod, onManualMethodChange, availableManualMethods = [] }: Props) {
  const [internalManualMethod, setInternalManualMethod] = useState<ManualMethod>('instapay')
  const manualMethod = controlledManualMethod ?? internalManualMethod

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const selected = params.get('payment_method')
    const selectedManual = params.get('manual_method')
    if (selected === 'online') onChange('online')
    if (selected === 'manual') onChange('manual')
    if (selectedManual === 'instapay' || selectedManual === 'vodafone_cash') {
      setInternalManualMethod(selectedManual)
      onManualMethodChange?.(selectedManual)
    }
    if (selected === 'online' || selected === 'manual' || selectedManual) {
      params.delete('payment_method')
      params.delete('manual_method')
      const query = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash)
    }
  }, [onChange, onManualMethodChange])

  const selectedLabel = value === 'online' ? 'بطاقة بنكية' : manualMethod === 'instapay' ? 'InstaPay' : 'Vodafone Cash'
  const openCheckout = () => {
    const params = new URLSearchParams({
      purpose,
      return_to: window.location.pathname + window.location.search,
    })
    if (onlineDisabled) params.set('card_disabled', '1')
    window.location.assign('/payment/checkout?' + params.toString())
  }

  return <div className="rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 via-white to-slate-50 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-700 text-white shadow-md"><CreditCard size={21}/></span>
        <div><p className="text-sm font-black text-slate-900">طريقة الدفع المختارة</p><p className="mt-1 text-xs font-bold text-blue-800">{selectedLabel}</p></div>
      </div>
      <button type="button" onClick={openCheckout} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102b47] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100">
        <ArrowLeft size={16}/> اختيار وسيلة الدفع
      </button>
    </div>
    <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-slate-600"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-700"/> سيتم فتح صفحة دفع موحدة لاختيار InstaPay أو Vodafone Cash أو البطاقة البنكية. التحويل اليدوي يظل خاضعًا لمراجعة الإدارة.</p>
    {availableManualMethods.length === 0 && <p className="mt-2 text-xs font-bold text-amber-700">بيانات التحويل اليدوي غير متاحة حاليًا؛ يمكنك مراجعة الوسائل المتاحة في صفحة الدفع.</p>}
    <input type="hidden" name="transfer_method" value={manualMethod}/>
    <input type="hidden" name="payment_method" value={manualMethod === 'instapay' ? 'instapay' : 'vodafone'}/>
    <input type="hidden" name="advertising_payment_method" value={manualMethod}/>
  </div>
}

import { supabase } from '../lib/supabase'

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
    merchant_not_approved: 'بوابة الدفع غير متاحة قبل اعتماد نشاط المنصة من مزود الخدمة.',
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
