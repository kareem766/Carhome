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
  return <main dir="rtl" className="min-h-screen bg-[#f4f7fb] text-slate-900">
    <header className="border-b border-white/10 bg-[#071a31] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="My Car عربيتي - الرئيسية">
          <img src="https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png" alt="My Car عربيتي" className="h-12 w-12 rounded-xl bg-white object-contain p-1"/>
          <span><strong className="block text-lg font-black"><span dir="ltr">My Car</span> عربيتي</strong><small className="text-xs text-blue-100">منصة السيارات للشركات والأساطيل في مصر</small></span>
        </a>
        <a href="/contact" className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">تواصل معنا</a>
      </div>
      <div className="border-t border-white/10 bg-[radial-gradient(ellipse_at_80%_0%,rgba(37,99,235,.38),transparent_45%),linear-gradient(120deg,#071a31,#123c68)]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-blue-200/10 px-4 py-2 text-xs font-extrabold text-blue-100"><Sparkles size={15}/> ملف تعريفي للخدمات التجارية</span>
            <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.65] sm:text-5xl sm:leading-[1.5]">حل رقمي منظم لربط <span className="text-amber-300">الشركات</span> بملاك السيارات وموردي الأساطيل</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">تقدم My Car عربيتي بيئة رقمية متخصصة لعرض السيارات، واستقبال طلبات الشركات، وتنظيم العروض والبحث عن المركبات، مع خدمات وباقات مدفوعة واضحة لأصحاب السيارات وموردي الأساطيل والشركات.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#revenue" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-amber-950/20 hover:bg-amber-300">استعراض الخدمات المدفوعة <ArrowLeft size={17}/></a>
              <a href="#advertising" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 font-bold text-white hover:bg-white/10">باقات الإعلان</a>
            </div>
            <div className="mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><CarFront className="text-amber-300"/><strong className="mt-2 block text-sm">ملاك السيارات</strong><small className="mt-1 block text-xs text-blue-100">تسجيل وعرض المركبات</small></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Truck className="text-amber-300"/><strong className="mt-2 block text-sm">موردو الأساطيل</strong><small className="mt-1 block text-xs text-blue-100">إدارة وعرض المركبات</small></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Building2 className="text-amber-300"/><strong className="mt-2 block text-sm">الشركات</strong><small className="mt-1 block text-xs text-blue-100">بحث وطلبات منظمة</small></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Network className="text-amber-300"/><strong className="mt-2 block text-sm">الموظفون المستقلون</strong><small className="mt-1 block text-xs text-blue-100">حساب مستقل وطلبات سائقين</small></div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-blue-400/10 blur-2xl"/>
            <img src="https://i.ibb.co/LDtVLtkT/3-E4722-EB-3946-4526-80-D0-87-A0-E48133-C7.png" alt="منصة My Car عربيتي للسيارات والشركات" className="relative w-full rounded-[1.8rem] border border-white/15 object-cover shadow-2xl"/>
            <div className="relative mx-auto -mt-7 w-[88%] rounded-2xl border border-white/15 bg-[#102b47] p-4 text-white shadow-xl">
              <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-300" size={25}/><div><strong className="block text-sm">منظومة رقمية بإجراءات واضحة</strong><span className="text-xs text-blue-100">طلبات، عروض، مراجعة إدارية، وباقات خدمات</span></div></div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-3xl text-center"><span className="text-sm font-black text-blue-700">عن المنصة</span><h2 className="mt-3 text-3xl font-black">منصة تسويقية وتشغيلية متخصصة</h2><p className="mt-4 leading-8 text-slate-600">تجمع المنصة بين احتياجات الشركات الباحثة عن سيارات بعقود شهرية أو سنوية طويلة الأجل، وبين ملاك السيارات وموردي الأساطيل الراغبين في عرض مركباتهم والوصول إلى فرص مناسبة، من خلال كتالوج إلكتروني وطلبات بحث وعروض ومراسلات منظمة.</p></div>
      <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Search className="text-blue-700" size={27}/><h3 className="mt-4 font-black">كتالوج سيارات منظم</h3><p className="mt-2 text-sm leading-7 text-slate-600">عرض مواصفات المركبات المعتمدة وإتاحة استعراض الخيارات ومقارنتها وفق احتياجات الشركات.</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Network className="text-blue-700" size={27}/><h3 className="mt-4 font-black">طلبات وعروض الشركات</h3><p className="mt-2 text-sm leading-7 text-slate-600">إنشاء طلبات التأجير واستقبال عروض ملاك السيارات وموردي الأساطيل ومتابعة مراحلها.</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><FileText className="text-blue-700" size={27}/><h3 className="mt-4 font-black">إدارة ومتابعة رقمية</h3><p className="mt-2 text-sm leading-7 text-slate-600">حسابات متعددة الصلاحيات، مراجعة بيانات المركبات والطلبات والمدفوعات الخاصة بخدمات المنصة.</p></article>
        <article className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm"><Network className="text-violet-700" size={27}/><h3 className="mt-4 font-black text-slate-900">خدمات الموظفين المستقلين</h3><p className="mt-2 text-sm leading-7 text-slate-700">إتاحة التسجيل بحساب موظف مستقل، وإنشاء طلبات العمل كسائق ومتابعة الطلبات والعروض ذات الصلة من خلال المنصة.</p></article>
      </div>
    </section>

    <section id="revenue" className="bg-white py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl"><span className="text-sm font-black text-blue-700">مصادر الإيرادات</span><h2 className="mt-3 text-3xl font-black">الخدمات التي تحقق إيرادات للمنصة</h2><p className="mt-3 leading-8 text-slate-600">تعتمد إيرادات My Car على رسوم خدمات رقمية وباقات معلنة أو معتمدة، مقابل التسجيل والعرض والظهور الإعلاني والاشتراكات وخدمات البحث.</p></div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-blue-300/70 bg-gradient-to-br from-[#0b1f38] via-[#123d70] to-[#075985] p-6 text-white shadow-xl shadow-blue-950/10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/25 text-amber-300 ring-1 ring-white/15"><CarFront/></span><h3 className="mt-4 text-lg font-black text-white">تسجيل سيارات الملاك</h3><p className="mt-2 text-sm leading-7 text-blue-50">رسوم تسجيل السيارة وإدراجها ضمن قاعدة المركبات المعروضة للشركات.</p><p className="mt-5 text-2xl font-black text-amber-300">150 جنيه</p><small className="text-xs leading-6 text-blue-100">لكل سيارة عند التسجيل، مع تجديد شهري وفق سياسة المنصة.</small></article>
          <article className="rounded-3xl border border-blue-300/70 bg-gradient-to-br from-[#0b1f38] via-[#123d70] to-[#075985] p-6 text-white shadow-xl shadow-blue-950/10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/25 text-amber-300 ring-1 ring-white/15"><Truck/></span><h3 className="mt-4 text-lg font-black text-white">تسجيل مورد الأسطول</h3><p className="mt-2 text-sm leading-7 text-blue-50">إدراج مركبات مورد الأسطول وإتاحتها ضمن الكتالوج وفرص الطلبات المناسبة.</p><p className="mt-5 text-lg font-black text-amber-300">150 جنيه</p><small className="text-xs leading-6 text-blue-100">لكل مركبة يتم تسجيلها.</small></article>
          <article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-slate-950"><Megaphone/></span><h3 className="mt-4 text-lg font-black">الإعلانات العادية والمميزة</h3><p className="mt-2 text-sm leading-7 text-slate-600">باقات مدفوعة لزيادة إبراز السيارات داخل الكتالوج، مع مدد ومستويات ظهور مختلفة.</p><p className="mt-5 text-lg font-black text-amber-800">حسب الباقة المختارة</p><small className="text-xs text-slate-500">الأسعار الفعلية للباقات موضحة أدناه وفق الباقات المنشورة.</small></article>
          <article className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-700 text-white"><Building2/></span><h3 className="mt-4 text-lg font-black">اشتراكات الشركات</h3><p className="mt-2 text-sm leading-7 text-slate-600">خطط اشتراك شهرية وسنوية تتيح للشركات الوصول إلى أدوات وخصائص المنصة وفق مستوى الباقة.</p><p className="mt-5 text-lg font-black text-blue-800">شهري / سنوي</p><small className="text-xs text-slate-500">تختلف القيمة والمزايا وفق الخطة المعتمدة.</small></article>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><div className="flex items-center gap-3"><Search className="text-blue-700"/><h3 className="font-black">باقات وطلبات البحث عن السيارات</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">خدمات بحث للشركات، سواء عبر الاشتراكات المخصصة أو طلبات البحث المستقلة، وفق نطاق الخدمة والباقات المتاحة.</p></article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><div className="flex items-center gap-3"><Sparkles className="text-blue-700"/><h3 className="font-black">خدمة البحث المُدار</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">تفويض المنصة للمساعدة في البحث عن خيارات سيارات مناسبة وفق متطلبات الشركة، ضمن الخدمة والاشتراك المعتمد.</p></article>
        </div>
      </div>
    </section>

    <section id="advertising" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-sm font-black text-blue-700">باقات الإعلان المنشورة</span><h2 className="mt-3 text-3xl font-black">الإعلان العادي والإعلان المميز</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">تُحمّل الأسعار والخصائص من قائمة باقات الإعلان النشطة على المنصة، حتى يطّلع الشريك على تفاصيل الباقات المعروضة حاليًا.</p></div><a href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-extrabold text-blue-800 shadow-sm transition hover:border-blue-400 hover:bg-blue-50">استفسر عن الباقات <ArrowLeft size={16}/></a></div>
      {plansLoading?<div className="mt-8 rounded-2xl border border-blue-100 bg-white p-8 text-center font-semibold text-slate-600">جارٍ تحميل الباقات المنشورة...</div>:plansError?<div role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm leading-7 text-rose-900">تعذر تحميل باقات الإعلان حاليًا. يُرجى المحاولة لاحقًا أو التواصل معنا لمعرفة الباقات المتاحة.</div>:plans.length===0?<div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-7 text-slate-600">لا توجد باقات إعلانية نشطة منشورة حاليًا. يمكن لإدارة المنصة نشر الباقات لتظهر تفاصيلها هنا تلقائيًا.</div>:<div className="mt-8 grid gap-5 lg:grid-cols-2">
        {[{title:'باقات الإعلان العادي',items:standard,premium:false},{title:'باقات الإعلان المميز',items:premium,premium:true}].map(group=><article key={group.title} className={'rounded-3xl border p-6 shadow-lg '+(group.premium?'border-amber-300 bg-gradient-to-br from-[#081a2e] via-[#102f50] to-[#153e65] text-white shadow-amber-950/10':'border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-900 shadow-slate-900/5')}><h3 className={'text-xl font-black '+(group.premium?'text-amber-200':'text-slate-900')}>{group.title}</h3>{group.items.length===0?<p className={'mt-4 text-sm '+(group.premium?'text-blue-100':'text-slate-500')}>لا توجد باقات نشطة من هذا النوع حاليًا.</p>:<div className="mt-5 grid gap-3 sm:grid-cols-2">{group.items.map(p=><div key={p.id} className={'rounded-2xl border p-4 shadow-sm '+(group.premium?'border-white/20 bg-white/10 text-white':'border-slate-200 bg-white text-slate-900')}><strong className="block">{p.name}</strong><p className={'mt-2 text-2xl font-black '+(group.premium?'text-amber-200':'text-blue-800')}>{money(Number(p.price_egp))} ج.م</p><p className={'mt-1 text-xs font-semibold '+(group.premium?'text-blue-100':'text-slate-600')}>مدة الإعلان: {p.duration_days} يومًا</p>{p.description&&<p className={'mt-2 text-xs leading-6 '+(group.premium?'text-blue-50':'text-slate-700')}>{p.description}</p>}{Array.isArray(p.features)&&p.features.length>0&&<ul className="mt-3 space-y-1.5">{p.features.slice(0,4).map((f,i)=><li key={i} className={'flex gap-2 text-xs leading-5 '+(group.premium?'text-white':'text-slate-800')}><Check size={14} className="mt-0.5 shrink-0 text-emerald-500"/>{f}</li>)}</ul>}</div>)}</div>}</article>)}
      </div>}
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-6 text-sky-950"><Clock3 className="mt-0.5 shrink-0" size={17}/> يبدأ الإعلان بعد مراجعة الطلب والتحقق من سداد رسوم الباقة واعتمادها من إدارة المنصة.</p>
    </section>

    <section className="bg-[#0b2038] py-14 text-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-2"><div><span className="text-sm font-black text-amber-300">نموذج التشغيل</span><h2 className="mt-3 text-3xl font-black">وساطة رقمية وتسويق للخدمات</h2><p className="mt-4 text-sm leading-8 text-blue-100">تعمل My Car عربيتي كمنصة إلكترونية تسويقية وتنظيمية تربط بين الأطراف وتوفر أدوات العرض والبحث وإدارة الطلبات والتواصل. يتم الاتفاق النهائي على التأجير وشروطه وتنفيذه مباشرة بين الأطراف المعنية.</p></div><div className="rounded-3xl border border-white/15 bg-white/5 p-6"><h3 className="font-black text-amber-200">شفافية الرسوم وحدود مسؤولية المنصة</h3><ul className="mt-4 space-y-3 text-sm leading-7 text-blue-50"><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> الرسوم المدفوعة للمنصة تخص خدمات التسجيل والعرض والإعلان والاشتراك والبحث وفق الباقة المعتمدة.</li><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> لا تتقاضى المنصة قيمة إيجار السيارات نيابة عن المالك أو الشركة، ولا تعمل كحساب ضمان أو وسيط لتحصيل الإيجار.</li><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> لا تضمن المنصة إتمام التعاقد أو تشغيل المركبة أو التزامات أي طرف؛ وتظل العقود والتنفيذ والمسؤوليات بين الأطراف مباشرة.</li><li className="flex gap-2"><Check className="mt-1 shrink-0 text-emerald-300"/> تخضع طلبات الخدمات والإعلانات للمراجعة والتحقق وفق إجراءات المنصة.</li></ul></div></div></section>

    <footer className="bg-[#061426] px-5 py-8 text-center text-sm text-blue-100 sm:px-8"><p className="font-black text-white">My Car عربيتي</p><p className="mt-2">منصة السيارات للشركات والأساطيل في مصر</p><p className="mt-1 text-xs text-blue-200/70">نطاق العمل: الإسكندرية، مصر</p><div className="mt-4 flex flex-wrap justify-center gap-5 text-xs"><a href="/terms" className="hover:text-white">شروط الاستخدام</a><a href="/privacy" className="hover:text-white">سياسة الخصوصية</a><a href="/contact" className="hover:text-white">تواصل معنا</a><a href="/" className="hover:text-white">الصفحة الرئيسية</a></div><p className="mt-5 text-xs text-blue-200/60">جميع الحقوق محفوظة © My Car عربيتي</p></footer>
  </main>
}
