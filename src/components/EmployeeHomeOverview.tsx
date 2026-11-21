import { ArrowLeft, BellRing, Bot, CalendarClock, CarFront, CheckCircle2, ClipboardList, MessageCircle, Plus, Sparkles, TrendingUp } from 'lucide-react'

type RequestSummary = { id: string; status: string }
type OfferSummary = { id: string; request_id: string; status: string }

export default function EmployeeHomeOverview({ accountType, companyName, requests, offers }: {
  accountType: 'independent' | 'company_member' | null
  companyName: string
  requests: RequestSummary[]
  offers: OfferSummary[]
}) {
  const pending = requests.filter((item) => item.status === 'pending_review').length
  const published = requests.filter((item) => item.status === 'open').length
  const waitingOffers = offers.filter((item) => item.status === 'submitted').length
  const accountLabel = accountType === 'independent' ? 'موظف مستقل' : accountType === 'company_member' ? 'موظف تابع لـ ' + (companyName || 'شركة') : 'مساحة الموظف'
  const stats = [
    { label: 'إجمالي طلباتي', value: requests.length, hint: 'كل طلبات السيارات المسجلة', icon: ClipboardList, tone: 'blue' },
    { label: 'بانتظار المراجعة', value: pending, hint: 'طلبات لدى إدارة المنصة', icon: CalendarClock, tone: 'amber' },
    { label: 'طلبات منشورة', value: published, hint: 'تستقبل عروض مقدمي السيارات', icon: TrendingUp, tone: 'green' },
    { label: 'عروض جديدة', value: waitingOffers, hint: 'عروض تنتظر مراجعتك', icon: BellRing, tone: 'violet' },
  ] as const
  const tones = { blue: 'bg-blue-50 text-blue-700 ring-blue-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100', green: 'bg-emerald-50 text-emerald-700 ring-emerald-100', violet: 'bg-violet-50 text-violet-700 ring-violet-100' }
  return <section dir="rtl" className="space-y-5">
    <div className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-l from-[#0b2038] via-[#123b60] to-[#176b91] p-5 text-white shadow-[0_22px_55px_rgba(12,43,72,.18)] sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-orange-400/10 blur-2xl" />
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-cyan-100"><Sparkles size={14} /> لوحة تحكم الموظف</span>
          <h1 className="mt-4 text-2xl font-black leading-tight sm:text-4xl">أهلاً بك في مساحة عملك</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">اطلب سيارتك الشهرية بسائق، تابع مراجعة طلباتك، وقارن العروض الواردة من ملاك السيارات وموردي الأساطيل من مكان واحد.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#06182b]/25 px-3 py-2 text-xs font-bold text-white/90"><CheckCircle2 size={15} className="text-emerald-300" />{accountLabel}</div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <a href="#new-request" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ffad0a] px-5 text-sm font-black text-[#132b43] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-amber-300"><Plus size={18} /> إنشاء طلب سيارة جديد</a>
          <a href="/workspace/employee/requests" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-extrabold text-white transition hover:bg-white/15">متابعة طلباتي <ArrowLeft size={17} /></a>
        </div>
      </div>
      <div className="relative mt-7 grid grid-cols-2 gap-2 border-t border-white/15 pt-5 text-center sm:grid-cols-3">
        <div className="rounded-xl bg-white/[0.07] px-3 py-3"><p className="text-xl font-black text-white">{requests.length}</p><p className="mt-1 text-[11px] font-bold text-blue-100">طلباتي المسجلة</p></div>
        <div className="rounded-xl bg-white/[0.07] px-3 py-3"><p className="text-xl font-black text-white">{waitingOffers}</p><p className="mt-1 text-[11px] font-bold text-blue-100">عروض جديدة</p></div>
        <div className="col-span-2 rounded-xl bg-white/[0.07] px-3 py-3 sm:col-span-1"><p className="text-xl font-black text-white">{published}</p><p className="mt-1 text-[11px] font-bold text-blue-100">طلبات منشورة</p></div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, hint, icon: Icon, tone }) => <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,35,65,.045)] sm:p-5">
        <div className="flex items-center justify-between gap-2"><span className={'grid h-10 w-10 place-items-center rounded-xl ring-1 ' + tones[tone]}><Icon size={19} /></span><span className="text-2xl font-black tabular-nums text-slate-900">{value}</span></div>
        <h2 className="mt-3 text-sm font-black text-slate-800">{label}</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p>
      </article>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <a href="#new-request" className="group flex items-center gap-3 rounded-2xl border border-orange-200/80 bg-gradient-to-l from-orange-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><CarFront size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-900">اطلب سيارة</strong><span className="mt-1 block text-xs text-slate-500">ابدأ طلبًا شهريًا جديدًا</span></span><ArrowLeft size={17} className="text-orange-700 transition group-hover:-translate-x-1" /></a>
      <a href="/workspace/employee/messages" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><MessageCircle size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-900">المراسلات</strong><span className="mt-1 block text-xs text-slate-500">تابع التواصل مع مقدمي العروض</span></span><ArrowLeft size={17} className="text-slate-400 transition group-hover:-translate-x-1 group-hover:text-blue-700" /></a>
      <a href="/assistant" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Bot size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-900">مساعد My Car</strong><span className="mt-1 block text-xs text-slate-500">مساعدة وإجابات لخطواتك</span></span><ArrowLeft size={17} className="text-slate-400 transition group-hover:-translate-x-1 group-hover:text-blue-700" /></a>
    </div>
  </section>
}
