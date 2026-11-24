import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, CircleDollarSign, Clock3, LockKeyhole, Power, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminPageNavigation from './AdminPageNavigation'

type Gateway = { provider_code: 'paymob' | 'fawry'; display_name: string; is_enabled: boolean; environment: 'sandbox' | 'production'; is_default: boolean; supported_payment_methods: string[] }
type Settings = { id: number; online_payments_enabled: boolean; enabled_service_types: string[] }
const services = [
  ['vehicle_registration', 'تسجيل وتجديد السيارات'],
  ['company_subscription', 'اشتراكات الشركات'],
  ['advertising', 'الإعلانات العادية والمميزة'],
  ['managed_sourcing_request', 'طلبات البحث المستقل'],
  ['managed_sourcing_subscription', 'اشتراكات تفويض البحث'],
] as const
const providerHelp: Record<string,string> = {
  paymob: 'حالة التعاقد: مرفوض حاليًا. لا تفتح البوابة للمستخدمين قبل حل موقف التعاقد وتجهيز بيانات التاجر.',
  fawry: 'بانتظار رد فوري وتحديد منتج FawryPay وبيانات الربط. سيظل التشغيل مقفولًا حتى اكتمال الـ Adapter والاختبارات.',
}
export default function AdminPaymentGatewaysPage() {
  const [authorized,setAuthorized] = useState(false)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [gateways,setGateways] = useState<Gateway[]>([])
  const [settings,setSettings] = useState<Settings | null>(null)
  const [readyProviders,setReadyProviders] = useState<string[]>([])
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const load = useCallback(async () => {
    if (!supabase) { setError('تعذر الاتصال بالخادم.'); setLoading(false); return }
    setLoading(true); setError('')
    const {data:{user},error:authError} = await supabase.auth.getUser()
    if (authError || !user) { window.location.replace('/?login=1'); return }
    const {data:admin,error:adminError} = await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()
    if (adminError || !admin) { setError('هذه الصفحة متاحة لمسؤولي المنصة فقط.'); setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    const [gatewayResult,settingsResult,statusResult] = await Promise.all([
      supabase.from('payment_gateways').select('provider_code,display_name,is_enabled,environment,is_default,supported_payment_methods').order('priority'),
      supabase.from('payment_platform_settings').select('id,online_payments_enabled,enabled_service_types').eq('id',1).single(),
      supabase.functions.invoke('payment-gateway-status',{body:{}})
    ])
    if (gatewayResult.error) setError('تعذر تحميل إعدادات البوابات: '+gatewayResult.error.message)
    else setGateways((gatewayResult.data || []) as Gateway[])
    if (settingsResult.error) setError('تعذر تحميل إعدادات الدفع العامة. تأكد من تطبيق Migration مركز التحكم.')
    else setSettings(settingsResult.data as Settings)
    if (!statusResult.error) setReadyProviders((statusResult.data?.enabled_providers || []).map((item: {provider_code:string})=>item.provider_code))
    setLoading(false)
  },[])
  useEffect(()=>{ void load() },[load])
  async function saveSettings(next: Partial<Settings>, provider?: Gateway) {
    if (!supabase || !settings) return
    setSaving(true); setError(''); setNotice('')
    let result
    if (provider) {
      result = await supabase.from('payment_gateways').update({is_enabled:provider.is_enabled,is_default:false,updated_at:new Date().toISOString()}).eq('provider_code',provider.provider_code)
    } else {
      result = await supabase.from('payment_platform_settings').update({...next,updated_at:new Date().toISOString()}).eq('id',1)
    }
    if (result.error) setError('لم يتم حفظ التغيير: '+result.error.message)
    else { setSettings(current=>current ? {...current,...next}:current); if(provider) setGateways(current=>current.map(item=>item.provider_code===provider.provider_code?provider:item)); setNotice('تم حفظ إعدادات مركز الدفع.'); await load() }
    setSaving(false)
  }
  const enabledCount = gateways.filter(g=>g.is_enabled).length
  return <><AdminPageNavigation/><main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 sm:px-7 lg:px-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#174a82] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-cyan-200">إدارة المدفوعات · My Car عربيتي</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز تحكم بوابات الدفع</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">تحكم في إتاحة الدفع الإلكتروني ووسائل الدفع لكل خدمة. لا يؤدي فتح المفتاح الإداري وحده إلى تفعيل بوابة غير مكتملة التعاقد أو الإعداد.</p></div><button onClick={()=>void load()} disabled={loading||saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold hover:bg-white/15 disabled:opacity-50"><RefreshCw size={16}/> تحديث الحالة</button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><span className="text-xs text-white/70">البوابات المفعّل مفتاحها</span><strong className="mt-1 block text-2xl">{enabledCount}</strong></div><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><span className="text-xs text-white/70">بوابات جاهزة تقنيًا ومسموح بها</span><strong className="mt-1 block text-2xl">{readyProviders.length}</strong></div><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><span className="text-xs text-white/70">خدمات الدفع المتاحة إداريًا</span><strong className="mt-1 block text-2xl">{settings?.enabled_service_types.length ?? 0} / {services.length}</strong></div></div>
      </header>
      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><AlertCircle className="mt-0.5 shrink-0" size={19}/>{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 size={18}/>{notice}</div>}
      {!authorized && !loading ? <div className="rounded-2xl border border-amber-200 bg-white p-6 text-amber-900">تعذر منح صلاحية الوصول إلى إعدادات بوابات الدفع.</div> : loading ? <div className="rounded-2xl bg-white p-8 text-center text-slate-500">جاري تحميل إعدادات الدفع…</div> : <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#173553]"><Power size={20}/><h2 className="text-lg font-black">المفتاح الرئيسي للدفع الإلكتروني</h2></div><p className="mt-2 text-sm leading-7 text-slate-600">عند الإيقاف، تختفي خيارات الدفع الإلكتروني من مسارات الدفع كلها، ويظل التحويل اليدوي متاحًا. المفتاح مغلق افتراضيًا.</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${settings?.online_payments_enabled?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{settings?.online_payments_enabled?'مفتوح':'مغلق'}</span></div>
          <button disabled={saving||!settings} onClick={()=>settings&&void saveSettings({online_payments_enabled:!settings.online_payments_enabled})} className={`mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-black text-white disabled:opacity-50 ${settings?.online_payments_enabled?'bg-rose-600 hover:bg-rose-700':'bg-[#174a82] hover:bg-[#102b47]'}`}>{saving?'جاري الحفظ…':settings?.online_payments_enabled?'إيقاف الدفع الإلكتروني':'فتح إتاحة الدفع الإلكتروني'}</button>
          <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-slate-500"><LockKeyhole size={15} className="mt-0.5 shrink-0"/>لا يمكن للمفتاح الرئيسي تجاوز تعطيل مزود الدفع أو نقص أسرار التاجر أو عدم اكتمال التعاقد.</p>
        </section>
        <section className="space-y-3"><div className="flex items-center gap-2"><CircleDollarSign className="text-[#174a82]" size={21}/><h2 className="text-lg font-black">إعدادات مزودي الدفع</h2></div>
          {gateways.map(gateway=><article key={gateway.provider_code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-black">{gateway.display_name}</h3><p className="mt-1 text-xs text-slate-500">{gateway.environment==='production'?'بيئة الإنتاج':'بيئة الاختبار'} · {gateway.is_enabled?'مفتاح المزود مفتوح':'مفتاح المزود مغلق'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${readyProviders.includes(gateway.provider_code)?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{readyProviders.includes(gateway.provider_code)?'جاهز ومتاح':'غير جاهز للاستخدام'}</span></div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{providerHelp[gateway.provider_code]}</p>
            <button disabled={saving||gateway.provider_code==='fawry'||(!gateway.is_enabled&&!readyProviders.includes(gateway.provider_code))} onClick={()=>void saveSettings({}, {...gateway,is_enabled:!gateway.is_enabled,is_default:false})} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Power size={16}/>{gateway.provider_code==='fawry'?'بانتظار استكمال التكامل':gateway.is_enabled?'إيقاف المفتاح':'تشغيل المفتاح'}</button>
            {gateway.provider_code==='paymob'&&!readyProviders.includes('paymob')&&<p className="mt-2 text-xs text-amber-700">لن يظهر Paymob للمستخدمين حتى تتوفر بيانات التاجر الصحيحة ويجتاز فحص الجاهزية.</p>}
          </article>)}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><SlidersHorizontal size={20} className="text-[#174a82]"/><h2 className="text-lg font-black">التحكم في الخدمات</h2></div><p className="mt-2 text-sm leading-7 text-slate-600">يمكنك إتاحة أو إيقاف الدفع الإلكتروني لكل خدمة بشكل مستقل، دون التأثير على التحويل اليدوي أو حالة الطلبات القائمة.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{services.map(([key,label])=>{const active=Boolean(settings?.enabled_service_types.includes(key));return <label key={key} className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"><span className="text-sm font-bold text-slate-700">{label}</span><input type="checkbox" checked={active} disabled={saving||!settings} onChange={event=>settings&&void saveSettings({enabled_service_types:event.target.checked?[...settings.enabled_service_types,key]:settings.enabled_service_types.filter(item=>item!==key)})} className="h-5 w-5 accent-blue-700"/></label>})}</div></section>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><strong>قاعدة أمان:</strong> تأكيد الدفع لا يعتمد على رجوع المستخدم للمنصة. يظل تأكيد العملية من Webhook موثوق، ثم تمر الخدمة بمراجعة الإدارة المعتادة. لا يتم تخزين بيانات البطاقات أو CVV داخل My Car.</div>
      </>}
      <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/>إعدادات حساسة: التغييرات محفوظة في قاعدة البيانات ومقيدة بمسؤولي المنصة فقط.</div>
    </div>
  </main></>
}
