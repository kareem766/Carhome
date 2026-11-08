import { ArrowUpRight, LockKeyhole } from 'lucide-react'

export default function PlanUpgradeNotice({ title = 'الميزة غير متاحة في باقتك الحالية', message, plan }: { title?: string; message: string; plan?: string | null }) {
  return <section role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4 text-right shadow-sm">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><LockKeyhole size={19}/></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-black text-amber-950">{title}</h3>
        <p className="mt-1 text-sm leading-7 text-amber-900">{message}</p>
        {plan && <p className="mt-1 text-xs font-bold text-amber-800">باقتك الحالية: {plan}</p>}
        <a href="/workspace/company/subscriptions" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800">عرض الباقات وترقية الاشتراك <ArrowUpRight size={16}/></a>
      </div>
    </div>
  </section>
}
