import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  actions?: ReactNode
  compact?: boolean
}

export default function CompanyPageTitleCard({ eyebrow, title, description, icon: Icon, actions, compact = false }: Props) {
  const shell = "mc-company-page-title-card mc-company-dark-card relative isolate overflow-hidden rounded-[26px] border border-blue-900/10 bg-gradient-to-l from-[#08294f] via-[#10518a] to-[#1479ad] text-white shadow-[0_20px_50px_-28px_rgba(8,42,82,.65)] sm:rounded-[30px]"
  return <section className={shell + (compact ? " mc-company-page-title-card--compact px-5 py-5 sm:px-7 sm:py-6" : " p-5 sm:p-7")}>
    <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 -z-10 h-56 w-56 rounded-full border-[26px] border-white/[0.07]" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-1/3 -z-10 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
    {compact ? <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center">
      <div className="flex w-full items-center justify-between gap-3">
        <span className="inline-flex min-w-0 max-w-[calc(100%-3.75rem)] items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold leading-5 tracking-wide text-cyan-100">{eyebrow}</span>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-cyan-100 shadow-inner sm:h-12 sm:w-12"><Icon size={23} /></span>
      </div>
      <h1 className="m-0 w-full text-center text-[1.55rem] font-black leading-[1.35] tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="m-0 w-full max-w-4xl text-center text-sm leading-7 text-blue-100 sm:text-base sm:leading-8">{description}</p>
      {actions && <div className="flex w-full flex-wrap items-center justify-center gap-2 pt-1 [&_button]:min-h-10 [&_a]:min-h-10">{actions}</div>}
    </div> : <div className="relative flex w-full min-w-0 flex-col justify-between gap-5 lg:flex-row lg:items-center">
      <div className="flex w-full min-w-0 items-start gap-3 sm:gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-cyan-100 shadow-inner sm:h-14 sm:w-14"><Icon size={24} /></span>
        <div className="min-w-0 w-full">
          <span className="inline-flex max-w-full rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-wide text-cyan-100">{eyebrow}</span>
          <h1 className="mt-2 text-xl font-black leading-tight tracking-tight text-white sm:text-2xl lg:text-[1.75rem]">{title}</h1>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-blue-100 sm:text-sm sm:leading-7">{description}</p>
        </div>
      </div>
      {actions && <div className="relative flex shrink-0 flex-wrap items-center gap-2 [&_button]:min-h-10 [&_a]:min-h-10">{actions}</div>}
    </div>}
  </section>
}
