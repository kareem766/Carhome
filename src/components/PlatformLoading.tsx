export default function PlatformLoading() {
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_48%),#f8fafc] px-5 text-slate-700">
      <div className="flex flex-col items-center gap-4" role="status" aria-label="جارٍ فتح مساحة عمل My Car">
        <div className="relative grid h-28 w-28 place-items-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border-[4px] border-orange-100 shadow-[0_0_35px_rgba(249,115,22,0.16)]" />
          <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[4px] border-transparent border-t-orange-500 border-l-amber-400" />
          <span aria-hidden="true" className="absolute inset-2 animate-pulse rounded-full bg-orange-500/10" />
          <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-orange-400 bg-white text-2xl font-black shadow-[0_0_22px_rgba(249,115,22,0.25)]">
            <span className="text-blue-700">My</span><span className="-mt-2 text-orange-500">Car</span>
          </span>
        </div>
        <span aria-hidden="true" className="h-1 w-28 overflow-hidden rounded-full bg-orange-100"><span className="block h-full w-1/2 animate-pulse rounded-full bg-orange-500" /></span>
        <span className="text-sm font-bold text-slate-600">جارٍ فتح مساحة عملك...</span>
      </div>
    </main>
  )
}
