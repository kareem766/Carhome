export default function PlatformLoading() {
  return (
    <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,rgba(16,115,226,0.24),transparent_48%),linear-gradient(145deg,#06152f,#09285a_58%,#06152f)] px-5 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(12,92,190,0.18))]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-7" role="status" aria-label="جارٍ فتح مساحة عمل My Car">
        <div className="w-full max-w-[min(82vw,390px)] drop-shadow-[0_10px_30px_rgba(0,123,255,0.28)]">
          <img src="/my-car-loading-logo.svg" alt="My Car" className="h-auto w-full" />
        </div>
        <div className="relative grid h-24 w-24 place-items-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border-[3px] border-blue-300/15" />
          <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-cyan-300 border-r-blue-500 shadow-[0_0_24px_rgba(34,211,238,0.25)]" />
          <span aria-hidden="true" className="absolute inset-3 rounded-full bg-blue-400/10 shadow-[inset_0_0_22px_rgba(59,130,246,0.2)]" />
          <svg viewBox="0 0 64 40" className="relative h-10 w-14 text-white" fill="none" aria-hidden="true">
            <path d="M8 25 12 15c1-3 3-4 6-4h23c3 0 5 1 7 4l6 10v7H8z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"/>
            <path d="m16 20 3-6h23l5 6H16Z" fill="#60a5fa" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="18" cy="32" r="4" fill="#071a38" stroke="#67e8f9" strokeWidth="2.5"/><circle cx="47" cy="32" r="4" fill="#071a38" stroke="#67e8f9" strokeWidth="2.5"/>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-extrabold tracking-wide text-white">جارٍ فتح مساحة عملك...</p>
          <p className="text-xs font-medium text-blue-200/75">يرجى الانتظار لحظة واحدة</p>
        </div>
        <div aria-hidden="true" className="h-1 w-36 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-cyan-300 to-blue-500 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
        </div>
      </div>
    </main>
  )
}
