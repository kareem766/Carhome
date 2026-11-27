import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, CreditCard, Landmark, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type ManualMethod = 'instapay' | 'vodafone_cash'
type PaymentMethod = ManualMethod | 'card'
const purposeLabels: Record<string,string> = {
  vehicle_registration: 'تسجيل السيارة وتجديدها',
  company_subscription: 'اشتراك الشركة',
  advertising: 'الإعلان عن السيارة',
  featured_advertising: 'الإعلان المميز',
  managed_sourcing_request: 'رسوم طلب البحث والتنسيق',
  managed_sourcing_subscription: 'باقة البحث والتوفير',
}
const allowedReturnPrefixes = [
  '/workspace/owner/vehicles',
  '/workspace/supplier/vehicles',
  '/workspace/company/subscriptions',
  '/workspace/advertising-plans',
  '/workspace/company/managed-sourcing',
]
function safeReturnTo(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return ''
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin !== window.location.origin) return ''
    return allowedReturnPrefixes.some(prefix => parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/')) ? parsed.pathname + parsed.search + parsed.hash : ''
  } catch { return '' }
}

export default function PaymentCheckoutPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const purpose = params.get('purpose') || ''
  const returnTo = safeReturnTo(params.get('return_to'))
  const cardDisabledByFlow = params.get('card_disabled') === '1'
  const [method, setMethod] = useState<PaymentMethod>('instapay')
  const [manualMethods, setManualMethods] = useState<Record<ManualMethod,string>>({instapay:'',vodafone_cash:''})
  const [cardEnabled, setCardEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userReady, setUserReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('إعدادات الاتصال غير مكتملة.'); setLoading(false); return }
      const [{ data: authData }, { data: detailsData, error: detailsError }, { data: gatewayData, error: gatewayError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('get_public_payment_details'),
        supabase.functions.invoke('payment-gateway-status'),
      ])
      if (!active) return
      if (!authData.user) { setUserReady(false); setLoading(false); return }
      setUserReady(true)
      if (detailsError) setError('تعذر تحميل بيانات وسائل التحويل المعتمدة.')
      const paymentDetails = detailsData as unknown as { instapay_number?: string | null; vodafone_cash_number?: string | null } | Array<{ instapay_number?: string | null; vodafone_cash_number?: string | null }> | null
      const details = Array.isArray(paymentDetails) ? paymentDetails[0] : paymentDetails
      const nextMethods = {
        instapay: String(details?.instapay_number || '').trim(),
        vodafone_cash: String(details?.vodafone_cash_number || '').trim(),
      }
      setManualMethods(nextMethods)
      const providers = Array.isArray(gatewayData?.enabled_providers) ? gatewayData.enabled_providers as Array<{provider_code?:string}> : []
      setCardEnabled(!gatewayError && providers.some(provider => provider.provider_code === 'paymob') && !cardDisabledByFlow)
      if (!nextMethods.instapay && nextMethods.vodafone_cash) setMethod('vodafone_cash')
      else if (!nextMethods.instapay && !nextMethods.vodafone_cash && !cardDisabledByFlow && providers.some(provider => provider.provider_code === 'paymob')) setMethod('card')
      setLoading(false)
    }
    void load().catch(() => { if (active) { setError('تعذر تحميل خيارات الدفع. حاول مرة أخرى.'); setLoading(false) } })
    return () => { active = false }
  }, [cardDisabledByFlow])

  const available = (method === 'instapay' || method === 'vodafone_cash') ? Boolean(manualMethods[method]) : cardEnabled
  const continueToService = () => {
    if (!returnTo) { setError('تعذر تحديد صفحة الخدمة التي بدأت منها العملية. ارجع إلى الخدمة وابدأ اختيار وسيلة الدفع من جديد.'); return }
    if (!available) { setError('وسيلة الدفع المختارة غير متاحة حاليًا. اختر وسيلة أخرى.'); return }
    const target = new URL(returnTo, window.location.origin)
    target.searchParams.set('payment_method', method === 'card' ? 'online' : 'manual')
    if (method !== 'card') target.searchParams.set('manual_method', method)
    window.location.assign(target.pathname + target.search + target.hash)
  }

  const optionClass = (selected:boolean, disabled=false) => 'group relative flex min-h-[158px] flex-col items-start rounded-[1.35rem] border p-5 text-right transition-all duration-200 ' + (selected ? 'border-blue-600 bg-[linear-gradient(145deg,#eff6ff_0%,#ffffff_75%)] ring-2 ring-blue-100 shadow-[0_16px_35px_-20px_rgba(37,99,235,.55)]' : 'border-slate-200/90 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,.35)] hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg') + (disabled ? ' cursor-not-allowed opacity-45' : ' cursor-pointer')
  return <main dir="rtl" className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,.13),_transparent_28%),radial-gradient(ellipse_at_bottom_left,_rgba(37,99,235,.16),_transparent_38%),linear-gradient(145deg,#071426_0%,#102b47_42%,#edf3fa_42%,#f7f9fc_100%)] px-4 py-7 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <PlatformBrand/>
        <a href={returnTo || '/'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><ArrowRight size={16}/> الرجوع للخدمة</a>
      </header>
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_35px_100px_-38px_rgba(2,18,38,.55)] ring-1 ring-slate-900/5">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_12%_15%,rgba(249,115,22,.22),transparent_25%),linear-gradient(115deg,#061426_0%,#0b2948_48%,#14558a_100%)] px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full border-[34px] border-white/[0.06]"/>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-white/[0.08] px-4 py-2 text-xs font-extrabold tracking-wide text-orange-100 shadow-lg shadow-black/10"><ShieldCheck size={15}/> مركز الدفع الموحد</span>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">اختر طريقة الدفع المناسبة</h1>
          <p className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-bold leading-7 text-blue-50">خدمة: {purposeLabels[purpose] || 'خدمة من خدمات My Car عربيتي'}</p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100/80">ستعود إلى صفحة الخدمة بعد اختيار الوسيلة لاستكمال بيانات العملية وإرسال الطلب.</p>
        </div>
        <div className="space-y-6 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafd_100%)] p-5 sm:p-9">
          {!userReady && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">سجّل الدخول أولًا لاختيار وسيلة الدفع. <a href={'/?login=1&redirect='+encodeURIComponent(window.location.pathname+window.location.search)} className="underline">تسجيل الدخول</a></div>}
          {loading ? <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500"><LoaderCircle className="animate-spin"/> جارٍ تحميل وسائل الدفع...</div> : userReady && <>
            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" disabled={!manualMethods.instapay} aria-pressed={method==='instapay'} onClick={()=>{setMethod('instapay');setError('')}} className={optionClass(method==='instapay',!manualMethods.instapay)}>
                {method==='instapay'&&<CheckCircle2 className="absolute left-3 top-3 text-blue-700" size={18}/>}<span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-100 to-sky-200 text-sky-800 shadow-inner"><Landmark size={22}/></span><b className="mt-3 text-sm text-slate-900">InstaPay</b><span className="mt-1 text-xs leading-5 text-slate-500">تحويل يدوي إلى حساب المنصة</span><span className="mt-auto pt-3 text-[10px] font-extrabold text-sky-800">{manualMethods.instapay ? 'متاح' : 'غير متاح حاليًا'}</span>
              </button>
              <button type="button" disabled={!manualMethods.vodafone_cash} aria-pressed={method==='vodafone_cash'} onClick={()=>{setMethod('vodafone_cash');setError('')}} className={optionClass(method==='vodafone_cash',!manualMethods.vodafone_cash)}>
                {method==='vodafone_cash'&&<CheckCircle2 className="absolute left-3 top-3 text-blue-700" size={18}/>}<span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-red-50 to-red-100 text-red-700 shadow-inner"><Smartphone size={22}/></span><b className="mt-3 text-sm text-slate-900">Vodafone Cash</b><span className="mt-1 text-xs leading-5 text-slate-500">تحويل إلى محفظة المنصة</span><span className="mt-auto pt-3 text-[10px] font-extrabold text-red-700">{manualMethods.vodafone_cash ? 'متاح' : 'غير متاح حاليًا'}</span>
              </button>
              <button type="button" disabled={!cardEnabled} aria-pressed={method==='card'} onClick={()=>{setMethod('card');setError('')}} className={optionClass(method==='card',!cardEnabled)}>
                {method==='card'&&<CheckCircle2 className="absolute left-3 top-3 text-blue-700" size={18}/>}<span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 text-blue-800 shadow-inner"><CreditCard size={22}/></span><b className="mt-3 text-sm text-slate-900">بطاقة بنكية</b><span className="mt-1 text-xs leading-5 text-slate-500">بوابة دفع خارجية آمنة ثم العودة إلى عربيتي</span><span className="mt-auto pt-3 text-[10px] font-extrabold text-amber-700">{cardEnabled ? 'متاح عبر بوابة معتمدة' : 'غير متاح حتى اعتماد وربط البوابة'}</span>
              </button>
            </div>
            {method==='instapay'&&manualMethods.instapay&&<p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-6 text-sky-950">سيظهر رقم InstaPay المعتمد في صفحة الخدمة عند العودة لاستكمال بيانات التحويل.</p>}
            {method==='vodafone_cash'&&manualMethods.vodafone_cash&&<p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-950">سيظهر رقم Vodafone Cash المعتمد في صفحة الخدمة عند العودة لاستكمال بيانات التحويل.</p>}
            {method==='card'&&!cardEnabled&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">الدفع بالبطاقة غير متاح قبل موافقة مزود الخدمة وتفعيل بوابة الدفع رسميًا.</p>}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600"><b className="text-slate-900">تنبيه:</b> التحويلات عبر InstaPay وVodafone Cash ليست دفعًا آليًا؛ يجب إدخال رقم العملية وتاريخ التحويل بعد العودة، ثم تخضع للمراجعة. ولا يتم تفعيل الخدمة بمجرد اختيار الوسيلة.</div>
            {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
            <button type="button" onClick={continueToService} disabled={!returnTo||!available} className="min-h-14 w-full rounded-2xl bg-[linear-gradient(105deg,#071b31_0%,#124a7d_65%,#1767a6_100%)] px-6 py-4 text-sm font-black text-white shadow-[0_16px_30px_-14px_rgba(15,59,100,.65)] ring-1 ring-white/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50">متابعة واستكمال بيانات الدفع</button>
          </>}
        </div>
      </section>
      <p className="mt-5 text-center text-xs leading-6 text-slate-500">تتم معالجة بيانات البطاقة لدى مزود الدفع فقط. لا تحتفظ My Car بأرقام البطاقات أو رمز الأمان.</p>
    </div>
  </main>
}
