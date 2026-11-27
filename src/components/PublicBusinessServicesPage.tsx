import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CarFront, Check, Clock3, FileText, Megaphone, Network, Search, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type AdPlan = { id:string; name:string; description:string; duration_days:number; price_egp:number; features:string[]; placement_type:'standard'|'premium' }
const money=(value:number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(value)

export default function PublicBusinessServicesPage(){
  const [plans,setPlans]=useState<AdPlan[]>([])
  const [plansLoading,setPlansLoading]=useState(true)
  const [plansError,setPlansError]=useState(false)
  useEffect(()=>{
    let active=true
    async function load(){
      if(!supabase){setPlansLoading(false);return}
      try {
        const {data,error}=await supabase.from('advertising_plans').select('id,name,description,duration_days,price_egp,features,placement_type').eq('is_active',true).order('display_order').order('created_at')
        if(active){
          if(error){setPlansError(true)}
          else {setPlans((data||[]) as AdPlan[]);setPlansError(false)}
          setPlansLoading(false)
        }
      } catch {
        if(active){setPlansError(true);setPlansLoading(false)}
      }
    }
    void load()
    return()=>{active=false}
  },[])
  const premium=plans.filter(p=>String(p.placement_type).toLowerCase()==='premium')
  const standard=plans.filter(p=>String(p.placement_type).toLowerCase()!=='premium')
  return <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f3f5f8] text-[#142338] selection:bg-amber-200 selection:text-[#071a31]">
    <header className="relative isolate overflow-hidden border-b border-amber-300/30 !bg-[#07182c] !text-white shadow-[0_18px_55px_rgba(3,12,25,.32)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(ellipse_at_12%_0%,rgba(245,158,11,.22),transparent_32%),radial-gradient(ellipse_at_88%_0%,rgba(37,99,235,.34),transparent_42%),linear-gradient(115deg,#061426_0%,#0b2340_52%,#102f50_100%)]">
      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 border-b border-white/10 bg-[#07182c]/95 px-5 py-5 text-white sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="My Car عربيتي - الرئيسية">
          <img src="https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png" alt="My Car عربيتي" className="h-12 w-12 rounded-2xl border border-amber-300/40 !bg-[#102b47] object-contain p-1.5 shadow-[0_0_28px_rgba(245,158,11,.2)]"/>
          <span><strong className="block text-lg font-black tracking-wide !text-white"><span dir="ltr">My Car</span> <span className="text-amber-300">عربيتي</span></strong><small className="text-xs font-semibold !text-blue-100">منصة السيارات للشركات والأساطيل في مصر</small></span>
        </a>
        <a href="/contact" className="rounded-xl border border-amber-300/60 !bg-gradient-to-b !from-amber-300 !to-amber-500 px-5 py-2.5 text-sm font-black !text-[#07182c] shadow-[0_8px_24px_rgba(245,158,11,.22)] transition hover:!from-amber-200 hover:!to-amber-400">تواصل معنا</a>
      </div>
      <div className="relative overflow-hidden border-t border-amber-300/15 !bg-[radial-gradient(ellipse_at_78%_0%,rgba(37,99,235,.42),transparent_44%),radial-gradient(ellipse_at_8%_90%,rgba(245,158,11,.10),transparent_34%),linear-gradient(125deg,#061426_0%,#0a2340_55%,#123c68_100%)]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200 shadow-[0_5px_20px_rgba(0,0,0,.12)]"><Sparkles size={15}/> ملف تعريفي للخدمات التجارية</span>
            <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.55] tracking-tight !text-white drop-shadow-sm sm:text-5xl sm:leading-[1.4]">حل رقمي منظم لربط <span className="text-amber-300">الشركات</span> بملاك السيارات وموردي الأساطيل</h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-8 !text-[#dce9f8] sm:text-lg">تقدم My Car عربيتي بيئة رقمية متخصصة لعرض السيارات، واستقبال طلبات الشركات، وتنظيم العروض والبحث عن المركبات، مع خدمات وباقات مدفوعة واضحة لأصحاب السيارات وموردي الأساطيل والشركات.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#revenue" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-amber-950/20 hover:bg-amber-300">استعراض الخدمات المدفوعة <ArrowLeft size={17}/></a>
              <a href="#advertising" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/[0.06] px-5 py-3 font-extrabold text-white shadow-lg backdrop-blur transition hover:border-amber-300/60 hover:bg-white/10">باقات الإعلان</a>
            </div>
            <div className="mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/15 bg-[#102d4c]/75 p-4 shadow-[0_8px_25px_rgba(0,0,0,.14)] backdrop-blur"><CarFront className="text-amber-300"/><strong className="mt-2 block text-sm">ملاك السيارات</strong><small className="mt-1 block text-xs text-blue-100">تسجيل وعرض المركبات</small></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Truck className="text-amber-300"/><strong className="mt-2 block text-sm">موردو الأساطيل</strong><small className="mt-1 block text-xs text-blue-100">إدارة وعرض المركبات</small></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Building2 className="text-amber-300"/><strong className="mt-2 block text-sm">الشركات</strong><small className="mt-1 block text-xs text-blue-100">بحث وطلبات منظمة</small></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Network className="text-amber-300"/><strong className="mt-2 block text-sm">الموظفون المستقلون</strong><small className="mt-1 block text-xs text-blue-100">حساب مستقل وطلبات سائقين</small></div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-blue-400/10 blur-2xl"/>
            <img src="https://i.ibb.co/LDtVLtkT/3-E4722-EB-3946-4526-80-D0-87-A0-E48133-C7.png" alt="منصة My Car عربيتي للسيارات والشركات" className="relative w-full rounded-[1.8rem] border border-amber-200/25 object-cover shadow-[0_24px_65px_rgba(0,0,0,.38)]"/>
            <div className="relative mx-auto -mt-7 w-[88%] rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#153b60] to-[#07182c] p-4 text-white shadow-[0_18px_45px_rgba(0,0,0,.35)]">
              <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-300" size={25}/><div><strong className="block text-sm">منظومة رقمية بإجراءات واضحة</strong><span className="text-xs text-blue-100">طلبات، عروض، مراجعة إدارية، وباقات خدمات</span></div></div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl text-center"><span className="text-sm font-black tracking-wide text-amber-700">عن المنصة</span><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10243b]">منصة تسويقية وتشغيلية متخصصة</h2><p className="mt-4 leading-8 text-[#526277]">تجمع المنصة بين احتياجات الشركات الباحثة عن سيارات بعقود شهرية أو سنوية طويلة الأجل، وبين ملاك السيارات وموردي الأساطيل الراغبين في عرض مركباتهم والوصول إلى فرص مناسبة، من خلال كتالوج إلكتروني وطلبات بحث وعروض ومراسلات منظمة.</p></div>
      <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-[#e0e6ee] bg-gradient-to-br from-white to-[#f8fafc] p-6 shadow-[0_10px_30px_rgba(15,35,60,.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,35,60,.1)]"><Search className="text-blue-700" size={27}/><h3 className="mt-4 font-black">كتالوج سيارات منظم</h3><p className="mt-2 text-sm leading-7 text-slate-600">عرض مواصفات المركبات المعتمدة وإتاحة استعراض الخيارات ومقارنتها وفق احتياجات الشركات.</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Network className="text-blue-700" size={27}/><h3 className="mt-4 font-black">طلبات وعروض الشركات</h3><p className="mt-2 text-sm leading-7 text-slate-600">إنشاء طلبات التأجير واستقبال عروض ملاك السيارات وموردي الأساطيل ومتابعة مراحلها.</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><FileText className="text-blue-700" size={27}/><h3 className="mt-4 font-black">إدارة ومتابعة رقمية</h3><p className="mt-2 text-sm leading-7 text-slate-600">حسابات متعددة الصلاحيات، مراجعة بيانات المركبات والطلبات والمدفوعات الخاصة بخدمات المنصة.</p></article>
        <article className="rounded-3xl border border-violet-200/80 bg-gradient-to-br from-[#f3efff] via-white to-[#edf4ff] p-6 shadow-[0_10px_30px_rgba(57,43,105,.08)] transition hover:-translate-y-1 hover:shadow-lg"><Network className="text-violet-700" size={27}/><h3 className="mt-4 font-black text-slate-900">خدمات الموظفين المستقلين</h3><p className="mt-2 text-sm leading-7 text-slate-700">إتاحة التسجيل بحساب موظف مستقل، وإنشاء طلبات العمل كسائق ومتابعة الطلبات والعروض ذات الصلة من خلال المنصة.</p></article>
      </div>
    </section>

    <section id="revenue" className="relative overflow-hidden border-y border-[#e2e8f0] bg-[linear-gradient(180deg,#eaf0f7_0%,#f8fafc_48%,#edf2f8_100%)] py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl"><span className="text-sm font-black tracking-wide text-amber-700">مصادر الإيرادات</span><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10243b]">الخدمات التي تحقق إيرادات للمنصة</h2><p className="mt-3 leading-8 text-[#526277]">تعتمد إيرادات My Car على رسوم خدمات رقمية وباقات معلنة أو معتمدة، مقابل التسجيل والعرض والظهور الإعلاني والاشتراكات وخدمات البحث.</p></div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-blue-300/70 bg-gradient-to-br from-[#0b1f38] via-[#123d70] to-[#075985] p-6 text-white shadow-xl shadow-blue-950/10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/25 text-amber-300 ring-1 ring-white/15"><CarFront/></span><h3 className="mt-4 text-lg font-black text-white">تسجيل سيارات الملاك</h3><p className="mt-2 text-sm leading-7 text-blue-50">رسوم تسجيل السيارة وإدراجها ضمن قاعدة المركبات المعروضة للشركات.</p><p className="mt-5 text-2xl font-black text-amber-300">150 جنيه</p><small className="text-xs leading-6 text-blue-100">لكل سيارة عند التسجيل، مع تجديد شهري وفق سياسة المنصة.</small></article>
          <article className="rounded-3xl border border-blue-300/70 bg-gradient-to-br from-[#0b1f38] via-[#123d70] to-[#075985] p-6 text-white shadow-xl shadow-blue-950/10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/25 text-amber-300 ring-1 ring-white/15"><Truck/></span><h3 className="mt-4 text-lg font-black text-white">تسجيل مورد الأسطول</h3><p className="mt-2 text-sm leading-7 text-blue-50">إدراج مركبات مورد الأسطول وإتاحتها ضمن الكتالوج وفرص الطلبات المناسبة.</p><p className="mt-5 text-lg font-black text-amber-300">150 جنيه</p><small className="text-xs leading-6 text-blue-100">لكل مركبة يتم تسجيلها.</small></article>
          <article className="rounded-3xl border border-amber-300/70 bg-gradient-to-br from-[#fff8e8] via-white to-[#fffdf7] p-6 shadow-[0_12px_32px_rgba(139,91,15,.08)]"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-slate-950"><Megaphone/></span><h3 className="mt-4 text-lg font-black">الإعلانات العادية والمميزة</h3><p className="mt-2 text-sm leading-7 text-slate-600">باقات مدفوعة لزيادة إبراز السيارات داخل الكتالوج، مع مدد ومستويات ظهور مختلفة.</p><p className="mt-5 text-lg font-black text-amber-800">حسب الباقة المختارة</p><small className="text-xs text-slate-500">الأسعار الفعلية للباقات موضحة أدناه وفق الباقات المنشورة.</small></article>
          <article className="rounded-3xl border border-blue-300/70 bg-gradient-to-br from-[#0b1f38] via-[#123d70] to-[#075985] p-6 text-white shadow-xl shadow-blue-950/10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/25 text-amber-300 ring-1 ring-white/15"><Building2/></span><h3 className="mt-4 text-lg font-black text-white">اشتراكات الشركات</h3><p className="mt-2 text-sm leading-7 text-blue-50">خطط اشتراك شهرية وسنوية تتيح للشركات الوصول إلى أدوات وخصائص المنصة وفق مستوى الباقة.</p><p className="mt-5 text-lg font-black text-amber-300">شهري / سنوي</p><small className="text-xs leading-6 text-blue-100">تختلف القيمة والمزايا وفق الخطة المعتمدة.</small></article>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-[#dce4ee] bg-gradient-to-br from-white to-[#f1f5f9] p-6 shadow-[0_10px_28px_rgba(15,35,60,.05)]"><div className="flex items-center gap-3"><Search className="text-blue-700"/><h3 className="font-black">باقات وطلبات البحث عن السيارات</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">خدمات بحث للشركات، سواء عبر الاشتراكات المخصصة أو طلبات البحث المستقلة، وفق نطاق الخدمة والباقات المتاحة.</p></article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><div className="flex items-center gap-3"><Sparkles className="text-blue-700"/><h3 className="font-black">خدمة البحث المُدار</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">تفويض المنصة للمساعدة في البحث عن خيارات سيارات مناسبة وفق متطلبات الشركة، ضمن الخدمة والاشتراك المعتمد.</p></article>
        </div>
      </div>
    </section>

    <section id="advertising" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-sm font-black tracking-wide text-amber-700">باقات الإعلان المنشورة</span><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10243b]">الإعلان العادي والإعلان المميز</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[#526277]">تُحمّل الأسعار والخصائص من قائمة باقات الإعلان النشطة على المنصة، حتى يطّلع الشريك على تفاصيل الباقات المعروضة حاليًا.</p></div><a href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-[#b9c9dc] bg-white px-4 py-3 text-sm font-black text-[#123b65] shadow-[0_6px_18px_rgba(15,35,60,.07)] transition hover:border-amber-400 hover:bg-amber-50">استفسر عن الباقات <ArrowLeft size={16}/></a></div>
      {plansLoading?<div className="mt-8 rounded-2xl border border-blue-100 bg-white p-8 text-center font-semibold text-slate-600">جارٍ تحميل الباقات المنشورة...</div>:plansError?<div role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm leading-7 text-rose-900">تعذر تحميل باقات الإعلان حاليًا. يُرجى المحاولة لاحقًا أو التواصل معنا لمعرفة الباقات المتاحة.</div>:plans.length===0?<div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-7 text-slate-600">لا توجد باقات إعلانية نشطة منشورة حاليًا. يمكن لإدارة المنصة نشر الباقات لتظهر تفاصيلها هنا تلقائيًا.</div>:<div className="mt-8 grid gap-5 lg:grid-cols-2">
        {[{title:'باقات الإعلان العادي',items:standard,premium:false},{title:'باقات الإعلان المميز',items:premium,premium:true}].map(group=><article key={group.title} className={'rounded-3xl border p-6 shadow-lg '+(group.premium?'border-amber-300 bg-gradient-to-br from-[#081a2e] via-[#102f50] to-[#153e65] text-white shadow-amber-950/10':'border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-900 shadow-slate-900/5')}><h3 className={'text-xl font-black '+(group.premium?'text-amber-200':'text-slate-900')}>{group.title}</h3>{group.items.length===0?<p className={'mt-4 text-sm '+(group.premium?'text-blue-100':'text-slate-500')}>لا توجد باقات نشطة من هذا النوع حاليًا.</p>:<div className="mt-5 grid gap-3 sm:grid-cols-2">{group.items.map(p=><div key={p.id} className={'rounded-2xl border p-4 shadow-sm '+(group.premium?'border-white/20 bg-white/10 text-white':'border-slate-200 bg-white text-slate-900')}><strong className="block">{p.name}</strong><p className={'mt-2 text-2xl font-black '+(group.premium?'text-amber-200':'text-blue-800')}>{money(Number(p.price_egp))} ج.م</p><p className={'mt-1 text-xs font-semibold '+(group.premium?'text-blue-100':'text-slate-600')}>مدة الإعلان: {p.duration_days} يومًا</p>{p.description&&<p className={'mt-2 text-xs leading-6 '+(group.premium?'text-blue-50':'text-slate-700')}>{p.description}</p>}{Array.isArray(p.features)&&p.features.length>0&&<ul className="mt-3 space-y-1.5">{p.features.slice(0,4).map((f,i)=><li key={i} className={'flex gap-2 text-xs leading-5 '+(group.premium?'text-white':'text-slate-800')}><Check size={14} className="mt-0.5 shrink-0 text-emerald-500"/>{f}</li>)}</ul>}</div>)}</div>}</article>)}
      </div>}
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-6 text-sky-950"><Clock3 className="mt-0.5 shrink-0" size={17}/> يبدأ الإعلان بعد مراجعة الطلب والتحقق من سداد رسوم الباقة واعتمادها من إدارة المنصة.</p>
    </section>

    <section className="relative overflow-hidden border-t border-amber-300/20 bg-[radial-gradient(ellipse_at_85%_0%,rgba(37,99,235,.22),transparent_40%),linear-gradient(125deg,#061426,#0b2340_55%,#123454)] py-16 text-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-2"><div><span className="text-sm font-black text-amber-300">نموذج التشغيل</span><h2 className="mt-3 text-3xl font-black">وساطة رقمية وتسويق للخدمات</h2><p className="mt-4 text-sm leading-8 text-blue-100">تعمل My Car عربيتي كمنصة إلكترونية تسويقية وتنظيمية تربط بين الأطراف وتوفر أدوات العرض والبحث وإدارة الطلبات والتواصل. يتم الاتفاق النهائي على التأجير وشروطه وتنفيذه مباشرة بين الأطراف المعنية.</p></div><div className="rounded-3xl border border-white/15 bg-white/5 p-6"><h3 className="font-black text-amber-200">شفافية الرسوم وحدود مسؤولية المنصة</h3><ul className="mt-4 space-y-3 text-sm leading-7 text-blue-50"><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> الرسوم المدفوعة للمنصة تخص خدمات التسجيل والعرض والإعلان والاشتراك والبحث وفق الباقة المعتمدة.</li><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> لا تتقاضى المنصة قيمة إيجار السيارات نيابة عن المالك أو الشركة، ولا تعمل كحساب ضمان أو وسيط لتحصيل الإيجار.</li><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> لا تضمن المنصة إتمام التعاقد أو تشغيل المركبة أو التزامات أي طرف؛ وتظل العقود والتنفيذ والمسؤوليات بين الأطراف مباشرة.</li><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> تخضع طلبات الخدمات والإعلانات للمراجعة والتحقق وفق إجراءات المنصة.</li></ul></div></div></section>

    <footer className="border-t border-amber-300/25 bg-[linear-gradient(115deg,#040e1b,#091d33_55%,#102d4a)] px-5 py-10 text-center text-sm text-[#d8e5f4] shadow-[0_-12px_35px_rgba(3,12,25,.12)] sm:px-8"><p className="font-black text-white">My Car عربيتي</p><p className="mt-2">منصة السيارات للشركات والأساطيل في مصر</p><p className="mt-1 text-xs text-blue-200/70">نطاق العمل: الإسكندرية، مصر</p><div className="mt-4 flex flex-wrap justify-center gap-5 text-xs"><a href="/terms" className="hover:text-white">شروط الاستخدام</a><a href="/privacy" className="hover:text-white">سياسة الخصوصية</a><a href="/contact" className="hover:text-white">تواصل معنا</a><a href="/" className="hover:text-white">الصفحة الرئيسية</a></div><p className="mt-5 text-xs text-blue-200/60">جميع الحقوق محفوظة © My Car عربيتي</p></footer>
  </main>
}
