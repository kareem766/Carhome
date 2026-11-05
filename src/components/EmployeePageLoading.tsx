export default function EmployeePageLoading() {
  return (
    <main dir="rtl" className="grid min-h-[100svh] place-items-center bg-[#071b31] px-5 text-white" role="status" aria-live="polite" aria-label="جارٍ تجهيز الصفحة">
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-orange-300/20 border-t-[#ffad0a]" />
          <span className="text-2xl font-black tracking-tight"><span className="text-[#42a5f5]">My</span> <span className="text-[#ffad0a]">Car</span></span>
        </div>
        <p className="mt-5 text-lg font-extrabold">My Car عربيتي</p>
        <p className="mt-2 text-sm text-blue-100/75">جارٍ تجهيز الصفحة وبياناتها...</p>
        <div className="mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#ffad0a]" />
        </div>
      </div>
    </main>
  )
}
