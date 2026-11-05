export default function PlatformLoading() {
  return (
    <main
      dir="rtl"
      className="relative grid min-h-screen place-items-center overflow-hidden px-5 text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 44%, #173b69 0%, #0b2343 43%, #06152b 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(249,115,22,.10), transparent 34%)' }} />
      <div className="relative flex flex-col items-center gap-9" role="status" aria-label="جارٍ فتح مساحة عمل My Car عربيتي">
        <div className="relative grid h-56 w-56 place-items-center sm:h-64 sm:w-64">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border border-orange-300/25" style={{ boxShadow: '0 0 55px rgba(249,115,22,.16), inset 0 0 28px rgba(249,115,22,.06)' }} />
          <span aria-hidden="true" className="absolute inset-2 animate-[spin_4s_linear_infinite] rounded-full border-[4px] border-transparent border-t-orange-400 border-r-orange-500" style={{ filter: 'drop-shadow(0 0 7px rgba(249,115,22,.8))' }} />
          <span aria-hidden="true" className="absolute inset-5 animate-[spin_6s_linear_infinite_reverse] rounded-full border-2 border-transparent border-b-orange-300/90 border-l-orange-400/80" />
          <span aria-hidden="true" className="absolute inset-8 rounded-full border border-white/10" />
          <div
            className="relative flex items-center gap-2 rounded-full px-7 py-6"
            dir="ltr"
            style={{ background: 'linear-gradient(145deg, #12345b, #071a32)', boxShadow: 'inset 0 2px 18px rgba(255,255,255,.08), 0 10px 35px rgba(0,0,0,.28)' }}
          >
            <span className="flex flex-col items-center gap-2">
              <span className="text-[38px] font-black leading-none tracking-[-0.055em] text-white sm:text-5xl">My <span className="text-cyan-300">Car</span></span>
              <span dir="rtl" className="text-2xl font-black leading-none tracking-normal text-cyan-300 sm:text-3xl">عربيتي</span>
            </span>
          </div>
          <span aria-hidden="true" className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-orange-300" style={{ boxShadow: '0 0 8px 3px rgba(251,146,60,.75), 0 0 24px 8px rgba(249,115,22,.35)' }} />
        </div>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-bold tracking-normal text-white drop-shadow-sm">جارٍ فتح مساحة عملك...</p>
          <span aria-hidden="true" className="h-1.5 w-36 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-orange-300 to-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.7)]" />
          </span>
        </div>
      </div>
    </main>
  )
}
