type PlatformLoadingProps = {
  pageName?: string
}

const loadingRoutes: Array<[string, string]> = [
  ['/workspace/admin/promotional-slides', 'إدارة العروض الترويجية'],
  ['/workspace/admin/automation-review', 'مركز المراجعة الذكية'],
  ['/workspace/admin/employee-requests', 'مراجعة طلبات الموظفين'],
  ['/workspace/admin', 'لوحة تحكم الإدارة'],
  ['/workspace/company/requests/new', 'طلب سيارة جديد'],
  ['/workspace/company/requests', 'طلبات التأجير'],
  ['/workspace/company/subscriptions', 'الاشتراكات والباقات'],
  ['/workspace/company/managed-sourcing', 'تفويض البحث عن السيارات'],
  ['/workspace/company/insights', 'تقارير الشركة'],
  ['/workspace/company/team', 'فريق العمل'],
  ['/workspace/company/alerts', 'التنبيهات الذكية'],
  ['/workspace/company', 'مساحة الشركة'],
  ['/workspace/owner/vehicles', 'سياراتي'],
  ['/workspace/owner/offers', 'عروضي'],
  ['/workspace/owner/requests', 'طلبات الشركات'],
  ['/workspace/employee/requests', 'طلبات السيارات والعروض'],
  ['/workspace/employee/messages', 'رسائل الموظف'],
  ['/workspace/employee/account', 'حسابي وبياناتي'],
  ['/workspace/employee', 'مساحة الموظف'],
  ['/workspace/supplier/vehicles', 'سيارات الأسطول'],
  ['/workspace/provider-employee-requests', 'طلبات الموظفين'],
  ['/workspace/catalog', 'كتالوج السيارات'],
  ['/workspace/advertising-plans', 'باقات الإعلانات'],
  ['/workspace/notifications', 'الإشعارات'],
  ['/workspace', 'مساحة العمل'],
  ['/assistant', 'مساعد My Car'],
  ['/services', 'خدمات السيارات'],
  ['/automotive-services', 'خدمات السيارات'],
  ['/messages', 'المراسلات'],
  ['/support', 'مركز الدعم'],
  ['/complete-profile', 'استكمال بيانات الحساب'],
  ['/first-login-password', 'تحديث كلمة المرور'],
  ['/reset-password', 'إعادة تعيين كلمة المرور'],
  ['/auth/callback', 'تأكيد تسجيل الدخول'],
  ['/register', 'إنشاء حساب جديد'],
  ['/privacy', 'سياسة الخصوصية'],
  ['/terms', 'الشروط والأحكام'],
]

function resolvePageName(pathname: string) {
  const match = loadingRoutes.find(([route]) => pathname === route || pathname.startsWith(route + '/'))
  if (match) return match[1]
  if (pathname === '/' || pathname === '') return 'الصفحة الرئيسية'
  return 'مساحة العمل'
}

export default function PlatformLoading({ pageName }: PlatformLoadingProps) {
  const currentPage = pageName || (typeof window !== 'undefined' ? resolvePageName(window.location.pathname) : 'مساحة العمل')

  return (
    <main
      dir="rtl"
      className="relative grid min-h-[100svh] place-items-center overflow-hidden px-5 text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 42%, #183b62 0%, #0b2340 48%, #06152a 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(rgba(148,193,224,.18) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 44%, rgba(34,211,238,.11), transparent 28%), radial-gradient(circle at 50% 57%, rgba(249,115,22,.12), transparent 38%)' }} />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-10" role="status" aria-live="polite" aria-label={`جارٍ فتح ${currentPage}`}>
        <div className="relative grid h-64 w-64 place-items-center sm:h-72 sm:w-72">
          <span aria-hidden="true" className="absolute inset-1 rounded-full border border-white/10" style={{ boxShadow: '0 0 70px rgba(34,211,238,.08), inset 0 0 45px rgba(255,255,255,.025)' }} />
          <span aria-hidden="true" className="absolute inset-3 animate-[spin_8s_linear_infinite] rounded-full border-[3px] border-transparent border-t-orange-400 border-r-orange-300/70 motion-reduce:animate-none" style={{ filter: 'drop-shadow(0 0 8px rgba(249,115,22,.75))' }} />
          <span aria-hidden="true" className="absolute inset-7 animate-[spin_11s_linear_infinite_reverse] rounded-full border-2 border-transparent border-b-cyan-300/80 border-l-white/25 motion-reduce:animate-none" />
          <span aria-hidden="true" className="absolute inset-12 rounded-full border border-white/10" />
          <span aria-hidden="true" className="absolute right-[13px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-orange-300 shadow-[0_0_10px_4px_rgba(251,146,60,.65)]" />
          <span aria-hidden="true" className="absolute bottom-8 left-10 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(103,232,249,.55)]" />

          <div
            className="relative flex min-h-40 min-w-52 flex-col items-center justify-center rounded-[2.25rem] border border-white/15 px-8 py-7"
            style={{ background: 'linear-gradient(145deg, rgba(22,57,91,.98), rgba(5,22,43,.98))', boxShadow: '0 22px 65px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.18), 0 0 38px rgba(34,211,238,.10)' }}
          >
            <span className="mb-3 text-[2.65rem] font-black leading-none tracking-[-0.065em]" dir="ltr">
              <span className="text-white">My</span><span className="text-cyan-300">Car</span>
            </span>
            <span className="text-[2rem] font-black leading-none tracking-tight text-cyan-300">عربيتي</span>
            <span aria-hidden="true" className="mt-4 h-1 w-14 rounded-full bg-gradient-to-l from-orange-300 to-orange-500 shadow-[0_0_12px_rgba(249,115,22,.65)]" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-[.22em] text-cyan-200/75">MY CAR · عربيتي</p>
            <p className="text-xl font-extrabold leading-relaxed text-white drop-shadow-sm sm:text-2xl">
              جارٍ فتح <span className="text-cyan-200">{currentPage}</span>
            </p>
            <p className="text-sm text-blue-100/65">لحظات ونكون معك</p>
          </div>
          <div aria-hidden="true" className="h-1.5 w-44 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full w-2/5 animate-[loading-slide_1.35s_ease-in-out_infinite] rounded-full bg-gradient-to-l from-orange-300 via-orange-400 to-orange-500 shadow-[0_0_14px_rgba(249,115,22,.8)] motion-reduce:animate-none" />
          </div>
        </div>
      </div>
      <style>{`@keyframes loading-slide { 0% { transform: translateX(260%); } 100% { transform: translateX(-260%); } }`}</style>
    </main>
  )
}
