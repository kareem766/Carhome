import { CreditCard, Landmark, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type MyCarPaymentMethod = 'manual' | 'online'

type PaymentMethodChoiceProps = {
  value: MyCarPaymentMethod
  onChange: (value: MyCarPaymentMethod) => void
  disabled?: boolean
  onlineDisabled?: boolean
}

export function PaymentMethodChoice({ value, onChange, disabled = false, onlineDisabled = false }: PaymentMethodChoiceProps) {
  return <fieldset className="space-y-3">
    <legend className="text-sm font-extrabold text-slate-900">اختار طريقة الدفع</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${value === 'online' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'} ${disabled || onlineDisabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input type="radio" name="mycar-payment-method" value="online" checked={value === 'online'} disabled={disabled || onlineDisabled} onChange={() => onChange('online')} className="mt-1 h-4 w-4 accent-blue-700"/>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><CreditCard size={17} className="text-blue-700"/> الدفع الإلكتروني</span>
          <span className="mt-1 block text-xs leading-6 text-slate-600">الدفع الآمن عبر بوابة My Car الموحدة. ستنتقل إلى صفحة الدفع لاستكمال العملية.</span>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800"><ShieldCheck size={12}/> يتاح بعد تفعيل البوابة</span>
        </span>
      </label>
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${value === 'manual' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input type="radio" name="mycar-payment-method" value="manual" checked={value === 'manual'} disabled={disabled} onChange={() => onChange('manual')} className="mt-1 h-4 w-4 accent-blue-700"/>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><Landmark size={17} className="text-blue-700"/> التحويل اليدوي</span>
          <span className="mt-1 block text-xs leading-6 text-slate-600">InstaPay أو Vodafone Cash مع إدخال رقم العملية لإرسالها للمراجعة.</span>
        </span>
      </label>
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
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: {
      purpose: args.purpose,
      entity_id: args.entityId,
      provider: 'paymob',
      idempotency_key: idempotencyKey,
      ...(args.periodMonths ? { period_months: args.periodMonths } : {}),
      ...(args.couponCode ? { coupon_code: args.couponCode } : {}),
    },
  })
  if (error) throw new Error(error.message || 'تعذر بدء عملية الدفع الإلكتروني.')
  if (!data?.checkout_url || typeof data.checkout_url !== 'string') {
    const messages: Record<string, string> = {
      gateway_disabled: 'الدفع الإلكتروني غير مفعّل حاليًا. يمكنك استخدام التحويل اليدوي.',
      billing_phone_required: 'أضف رقم موبايل مصري صحيح في بيانات حسابك قبل الدفع الإلكتروني.',
      billing_email_required: 'أضف بريدًا إلكترونيًا صحيحًا في بيانات حسابك قبل الدفع الإلكتروني.',
      paymob_credentials_missing: 'بوابة الدفع لم تكتمل إعداداتها بعد. يمكنك استخدام التحويل اليدوي.',
      fawry_checkout_requires_confirmed_merchant_product: 'الدفع عبر فوري غير متاح حتى تأكيد نوع الخدمة المتعاقد عليها.',
    }
    throw new Error(messages[String(data?.error)] || data?.message || 'تعذر إنشاء رابط الدفع الإلكتروني.')
  }
  window.location.assign(data.checkout_url)
}
