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
      className="relative grid min-h-[100svh] place-items-center overflow-hidden px-5 text-slate-900"
      style={{ background: 'linear-gradient(145deg, #f8fbff 0%, #edf4fb 52%, #f8fafc 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(rgba(51,95,145,.09) 1px, transparent 1px)', backgroundSize: '34px 34px', maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,.13), transparent 36%), radial-gradient(ellipse at 50% 58%, rgba(249,115,22,.07), transparent 44%)' }} />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-12" role="status" aria-live="polite" aria-label={`جارٍ فتح ${currentPage}`}>
        <div className="flex w-full flex-col items-center">
          <div className="relative flex h-32 w-64 items-center justify-center">
            <span aria-hidden="true" className="absolute inset-x-10 inset-y-5 rounded-full bg-cyan-300/20 blur-2xl" />
            <img
              src="https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png"
              alt="My Car عربيتي"
              className="relative z-10 max-h-28 w-56 object-contain"
              onError={(event) => { event.currentTarget.style.display = 'none' }}
            />
          </div>
          <p className="mt-2 text-center text-sm font-semibold leading-7 text-slate-500">منصة السيارات للشركات والأساطيل في مصر</p>
          <div aria-hidden="true" className="mt-6 flex h-1.5 w-28 items-center justify-center gap-1.5">
            <span className="h-1 w-5 rounded-full bg-[#08aeca]/65" />
            <span className="h-1.5 w-10 rounded-full bg-gradient-to-l from-orange-400 to-orange-300 shadow-[0_0_10px_rgba(249,115,22,.3)]" />
            <span className="h-1 w-5 rounded-full bg-[#08aeca]/65" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-5 text-center">
          <div className="space-y-3">
            <p className="text-xs font-bold tracking-[.12em] text-slate-500">MY CAR · عربيتي</p>
            <p className="text-xl font-extrabold leading-relaxed text-slate-800 sm:text-2xl">
              جارٍ فتح <span className="whitespace-nowrap text-[#079fbd]">{currentPage}</span>
            </p>
            <p className="text-sm font-medium leading-7 text-slate-500">لحظات ونكون معك</p>
          </div>
          <div aria-hidden="true" className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-300/60">
            <span className="block h-full w-2/5 animate-[loading-slide_1.45s_ease-in-out_infinite] rounded-full bg-gradient-to-l from-orange-300 via-orange-400 to-orange-500 shadow-[0_0_12px_rgba(249,115,22,.45)] motion-reduce:animate-none" />
          </div>
        </div>
      </div>
      <style>{`@keyframes loading-slide { 0% { transform: translateX(260%); } 100% { transform: translateX(-260%); } }`}</style>
    </main>
  )
}
