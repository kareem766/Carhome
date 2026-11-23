import { ArrowLeft, Headset, Phone, ShieldCheck, UserRoundPlus, LogIn, MessageCircle } from 'lucide-react'
import PlatformBrand from './PlatformBrand'

type Props = { supportPhone?: string | null; supportEmail?: string | null }

export default function VisitorContactPage({ supportPhone = null }: Props) {
  const phone = supportPhone?.trim() || ''
  const phoneHref = phone ? 'tel:' + phone.replace(/[^\d+]/g, '') : ''
  return <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f3f7fc] text-slate-900">
    <div className="relative isolate overflow-hidden bg-gradient-to-bl from-[#06172d] via-[#103b68] to-[#087fa8] px-4 pb-16 pt-7 text-white sm:px-7 sm:pb-20 sm:pt-10">
      <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full border-[38px] border-white/[.045]"/>
      <div className="pointer-events-none absolute -bottom-40 right-[22%] h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl"/>
      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4">
        <PlatformBrand/>
        <a href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15"><ArrowLeft size={16}/> الرئيسية</a>
      </header>
      <section className="relative mx-auto mt-12 max-w-4xl text-center sm:mt-16">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-cyan-200 shadow-lg shadow-black/10"><Headset size={31}/></span>
        <p className="mt-6 text-xs font-black tracking-[.18em] text-cyan-200">MY CAR · WE'RE HERE TO HELP</p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">تواصل معنا، فريق عربيتي معك</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-blue-100 sm:text-base">يسعدنا استقبال استفساراتك ومساعدتك في التعرف على خدمات My Car عربيتي. اختر الطريقة الأنسب للتواصل معنا، وسنكون سعداء بمساعدتك.</p>
      </section>
    </div>
    <div className="mx-auto -mt-7 max-w-5xl px-4 pb-12 sm:px-7">
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(16,43,71,.09)] sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Phone size={23}/></span>
          <h2 className="mt-4 text-xl font-black text-[#102b47]">اتصل بفريقنا</h2>
          <p className="mt-2 min-h-14 text-sm leading-7 text-slate-600">للاستفسارات العامة، يمكنك التواصل هاتفيًا مع فريق عربيتي عبر رقم الدعم المتاح.</p>
          {phone ? <a href={phoneHref} dir="ltr" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800"><Phone size={17}/>{phone}</a> : <p className="mt-5 rounded-xl bg-slate-50 p-3 text-center text-sm font-bold text-slate-500">رقم التواصل غير متاح حاليًا.</p>}
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(16,43,71,.09)] sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><MessageCircle size={23}/></span>
          <h2 className="mt-4 text-xl font-black text-[#102b47]">افتح طلب دعم من حسابك</h2>
          <p className="mt-2 min-h-14 text-sm leading-7 text-slate-600">للمشكلات المتعلقة بالحساب أو السيارات أو الطلبات أو المدفوعات، سجّل الدخول وافتح تذكرة خاصة تتيح لك متابعة الردود بأمان.</p>
          <a href="/?login=1" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102b47] px-4 py-3 text-sm font-black text-white transition hover:bg-[#174a7b]"><LogIn size={17}/> تسجيل الدخول لمركز الدعم</a>
        </article>
      </section>
      <section className="mt-5 overflow-hidden rounded-3xl border border-blue-200/30 bg-gradient-to-l from-[#071a33] via-[#123e70] to-[#087fa8] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-cyan-100"><ShieldCheck size={25}/></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black sm:text-2xl">دعم يحافظ على خصوصيتك</h2>
            <p className="mt-2 max-w-3xl text-sm leading-8 text-blue-100">نحرص على التعامل مع كل استفسار باهتمام. عند تسجيل الدخول، يمكنك إرسال طلبك ومتابعة حالته والردود من داخل حسابك، وتظل تفاصيل تذاكرك متاحة لك ولفريق الدعم المختص فقط.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/register" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ffad0a] px-5 py-2.5 text-sm font-black text-[#142b43] transition hover:bg-[#ffc044]"><UserRoundPlus size={17}/> إنشاء حساب</a>
              <a href="/support" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"><Headset size={17}/> لدي حساب بالفعل</a>
            </div>
          </div>
        </div>
      </section>
      <p className="mt-6 text-center text-xs leading-6 text-slate-500">My Car عربيتي — منصة تجمع خدمات السيارات واحتياجات الشركات والأساطيل في مكان واحد.</p>
    </div>
  </main>
}
