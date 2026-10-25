import { useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, Check, Clock3, MessageCircle, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Plan = { id:string; name:string; description:string; duration_days:number; price_egp:number; features:string[]; display_order:number }

const money = (value:number) => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(value)||0)

export default function AdvertisingPlansPage() {
  const [plans,setPlans] = useState<Plan[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { if(active){setError('تعذر الاتصال بالمنصة حاليًا. حاول مرة أخرى لاحقًا.');setLoading(false)}; return }
      const {data,error:queryError} = await supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features,display_order').eq('is_active',true).order('display_order').order('created_at')
      if (!active) return
      if (queryError) setError('تعذر تحميل الباقات حاليًا. حاول مرة أخرى بعد قليل.')
      else setPlans((data||[]) as Plan[])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  },[])

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <PlatformBrand />
        <a href="/workspace/catalog" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white"><ArrowLeft size={17}/> العودة للكتالوج</a>
      </div>
    </header>
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,.38),transparent_34%),radial-gradient(circle_at_85%_90%,rgba(245,158,11,.2),transparent_32%)]"/>
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-2 text-xs font-extrabold text-blue-100"><Sparkles size={15}/> حلول ظهور مرنة لسياراتك</span>
          <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">خلّي سيارتك <span className="text-blue-300">أوضح وأسهل في الوصول</span> داخل الكتالوج.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">اختار باقة الظهور المناسبة لاحتياجك، وراجع السعر والمدة والمميزات قبل إرسال طلب الترويج. كل الباقات المعروضة هنا معتمدة للنشر من إدارة Carhome.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#plans" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950">استكشف الباقات <ArrowLeft size={17}/></a><a href="/workspace/catalog" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 px-5 font-bold text-white"><MessageCircle size={17}/> الكتالوج والمحادثات</a></div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-300"><span className="inline-flex items-center gap-2"><BadgeCheck size={17} className="text-emerald-300"/> باقات واضحة ومعلنة</span><span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-300"/> مراجعة إدارية</span><span className="inline-flex items-center gap-2"><Clock3 size={17} className="text-blue-300"/> مدة محددة لكل باقة</span></div>
        </div>
        <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="absolute -left-3 -top-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg"><TrendingUp size={27}/></div>
          <p className="text-sm font-bold text-blue-200">مسار ترويج منظم</p><h2 className="mt-3 text-2xl font-black">من اختيار الباقة إلى تفعيل الإعلان</h2>
          <ol className="mt-6 space-y-4">{[['01','اختار الباقة','راجع السعر والمدة والمميزات.'],['02','حدد سيارتك','أرسل طلب الترويج من حسابك لسيارة معتمدة.'],['03','مراجعة الإدارة','يتم فحص الطلب والتحقق من الدفع يدويًا قبل التفعيل.']].map(([n,title,desc])=><li key={n} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-black text-blue-200">{n}</span><div><h3 className="font-extrabold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{desc}</p></div></li>)}</ol>
          <p className="mt-6 rounded-xl border border-amber-200/20 bg-amber-300/10 p-3 text-xs leading-6 text-amber-100">إرسال الطلب لا يفعّل الإعلان تلقائيًا، ولا يتم التحصيل الإلكتروني داخل المنصة حاليًا.</p>
        </div>
      </div>
    </section>
    <section id="plans" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-extrabold text-blue-700">اختار اللي يناسبك</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">باقات الظهور الإعلاني</h2><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">الأسعار والتفاصيل تُدار من لوحة تحكم المنصة، ويتم عرض الباقات النشطة فقط.</p></div>
      {error&&<p role="alert" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">{error}</p>}
      {loading?<div className="grid gap-5 pt-9 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(n=><div key={n} className="h-80 animate-pulse rounded-3xl border bg-white p-6"><div className="h-5 w-1/2 rounded bg-slate-200"/><div className="mt-5 h-9 w-2/3 rounded bg-slate-200"/><div className="mt-8 h-3 rounded bg-slate-100"/><div className="mt-3 h-3 rounded bg-slate-100"/><div className="mt-3 h-3 w-3/4 rounded bg-slate-100"/></div>)}</div>:plans.length===0&&!error?<div className="mx-auto mt-9 max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white p-9 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Sparkles size={26}/></span><h3 className="mt-4 text-xl font-extrabold">الباقات الجديدة قيد التجهيز</h3><p className="mt-2 text-sm leading-7 text-slate-600">لا توجد باقات نشطة للعرض الآن. يمكنك الرجوع للكتالوج أو التواصل من خلال حسابك، وسيتم عرض الباقات فور تفعيلها من الإدارة.</p><a href="/workspace/catalog" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 font-bold text-white">العودة للكتالوج <ArrowLeft size={16}/></a></div>:<div className="mt-9 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">{plans.map((plan,index)=><article key={plan.id} className={'relative flex flex-col overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl '+(index===0?'border-blue-300 ring-1 ring-blue-100':'border-slate-200')}><div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-blue-700 via-sky-500 to-amber-400"/><div className="flex items-start justify-between gap-3 pt-2"><div><span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-800">{index===0?'ابدأ من هنا':'باقة إعلانية'}</span><h3 className="mt-4 text-xl font-black">{plan.name}</h3></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Sparkles size={20}/></span></div><p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.description||'حل عملي لإبراز سيارتك داخل كتالوج Carhome.'}</p><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">سعر الباقة</p><p className="mt-1 text-3xl font-black text-blue-800">{money(plan.price_egp)} <span className="text-sm font-bold">جنيه مصري</span></p><p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-600"><Clock3 size={15}/>{plan.duration_days} يومًا</p></div><ul className="mt-5 flex-1 space-y-3">{(Array.isArray(plan.features)?plan.features:[]).map((feature,i)=><li key={i} className="flex items-start gap-2 text-sm leading-6 text-slate-700"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600"/><span>{feature}</span></li>)}</ul><a href="/workspace/catalog" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white transition hover:bg-blue-800">اطلب ترويج سيارتك <ArrowLeft size={17}/></a></article>)}</div>}
    </section>
    <section className="border-t border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-5 px-4 py-10 sm:px-6 md:grid-cols-3"><div><ShieldCheck size={22} className="text-emerald-600"/><h3 className="mt-3 font-extrabold">اعتماد قبل الظهور</h3><p className="mt-2 text-sm leading-6 text-slate-600">لا يظهر الإعلان إلا بعد مراجعة الطلب وتأكيد حالة الدفع أو الإعفاء من الإدارة.</p></div><div><Clock3 size={22} className="text-blue-700"/><h3 className="mt-3 font-extrabold">مدة محددة</h3><p className="mt-2 text-sm leading-6 text-slate-600">مدة الحملة واضحة في كل باقة، وينتهي الترويج عند انتهاء المدة المعتمدة.</p></div><div><BadgeCheck size={22} className="text-amber-600"/><h3 className="mt-3 font-extrabold">إدارة من لوحة التحكم</h3><p className="mt-2 text-sm leading-6 text-slate-600">إدارة المنصة تستطيع تعديل الأسعار والمميزات والمدة وترتيب العرض وإظهار أو إيقاف أي باقة.</p></div></div></section>
    <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-slate-500 sm:px-6"><PlatformBrand compact/><p>© {new Date().getFullYear()} Carhome · باقات واضحة وتجربة منظمة</p><a href="/" className="font-bold text-blue-700">الرئيسية</a></footer>
  </main>
}
