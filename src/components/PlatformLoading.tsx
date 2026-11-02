export default function PlatformLoading() {
  return (
    <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(30,91,170,0.24),transparent_42%),linear-gradient(145deg,#06152f,#0a2450_55%,#06152f)] px-5 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.07),transparent_30%)]" />
      <div className="relative flex flex-col items-center gap-8" role="status" aria-label="جارٍ فتح مساحة عمل My Car">
        <div className="relative grid h-52 w-52 place-items-center sm:h-60 sm:w-60">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border border-orange-300/20 shadow-[0_0_45px_rgba(249,115,22,0.12),inset_0_0_35px_rgba(249,115,22,0.06)]" />
          <span aria-hidden="true" className="absolute inset-1 animate-[spin_3.8s_linear_infinite] rounded-full border-[3px] border-transparent border-t-orange-400 border-r-orange-500 shadow-[0_0_22px_rgba(249,115,22,0.55)]" />
          <span aria-hidden="true" className="absolute inset-3 animate-[spin_5.5s_linear_infinite_reverse] rounded-full border-2 border-transparent border-b-orange-300/90 border-l-orange-500/60" />
          <span aria-hidden="true" className="absolute inset-6 rounded-full border border-orange-300/20 bg-[radial-gradient(circle,rgba(249,115,22,0.12),rgba(7,25,55,0.4)_70%)] shadow-[inset_0_0_32px_rgba(249,115,22,0.12)]" />
          <div className="relative flex items-center gap-1.5 drop-shadow-[0_0_16px_rgba(249,115,22,0.28)]" dir="ltr">
            <span className="text-4xl font-black italic tracking-[-0.09em] text-white sm:text-5xl">My</span>
            <span className="text-4xl font-black italic tracking-[-0.09em] text-orange-400 sm:text-5xl">Car</span>
          </div>
          <span aria-hidden="true" className="absolute -right-1 top-1/2 h-2.5 w-2.5 rounded-full bg-orange-300 shadow-[0_0_16px_5px_rgba(251,146,60,0.7)]" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-base font-extrabold tracking-wide text-white">جارٍ فتح مساحة عملك...</p>
          <span aria-hidden="true" className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-orange-300 to-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.7)]" />
          </span>
        </div>
      </div>
    </main>
  )
}
