import { CarFront } from 'lucide-react'

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
      style={{ background: 'linear-gradient(145deg, #f8fbff 0%, #eaf2fb 48%, #f5f8fc 100%)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(rgba(51,95,145,.10) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'linear-gradient(to bottom, transparent, black 24%, black 76%, transparent)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 39%, rgba(34,211,238,.16), transparent 30%), radial-gradient(ellipse at 50% 54%, rgba(249,115,22,.08), transparent 42%)' }} />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-12" role="status" aria-live="polite" aria-label={`جارٍ فتح ${currentPage}`}>
        <div className="flex w-full flex-col items-center">
          <div className="relative mb-5 grid h-24 w-24 place-items-center">
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-cyan-300/20 blur-2xl" />
            <span aria-hidden="true" className="absolute inset-3 rounded-full bg-orange-300/15 blur-xl" />
            <CarFront aria-hidden="true" size={62} strokeWidth={1.65} className="relative animate-[logo-float_2.8s_ease-in-out_infinite] text-[#123252] drop-shadow-[0_8px_12px_rgba(8,174,202,.18)] motion-reduce:animate-none" />
            <span aria-hidden="true" className="absolute bottom-1 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#08aeca] via-[#f9a23b] to-[#08aeca] opacity-80 blur-[1px]" />
          </div>

          <div className="flex items-baseline justify-center gap-3" dir="ltr">
            <span className="text-[3.2rem] font-black leading-none tracking-[-0.075em]">
              <span className="text-[#123252]">My</span><span className="text-[#08aeca]">Car</span>
            </span>
            <span className="text-[2.15rem] font-black leading-none tracking-tight text-[#08aeca]" dir="rtl">عربيتي</span>
          </div>
          <p className="mt-3 text-[11px] font-extrabold tracking-[.28em] text-slate-500">منصة السيارات للشركات والأساطيل</p>

          <div aria-hidden="true" className="mt-7 flex h-1.5 w-32 items-center justify-center gap-1.5">
            <span className="h-1 w-7 rounded-full bg-[#08aeca]/70" />
            <span className="h-1.5 w-12 rounded-full bg-gradient-to-l from-orange-400 to-orange-300 shadow-[0_0_12px_rgba(249,115,22,.35)]" />
            <span className="h-1 w-7 rounded-full bg-[#08aeca]/70" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-[.22em] text-slate-500">MY CAR · عربيتي</p>
            <p className="text-xl font-extrabold leading-relaxed text-slate-800 sm:text-2xl">
              جارٍ فتح <span className="text-[#079fbd]">{currentPage}</span>
            </p>
            <p className="text-sm text-slate-500">لحظات ونكون معك</p>
          </div>
          <div aria-hidden="true" className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-300/60">
            <span className="block h-full w-2/5 animate-[loading-slide_1.45s_ease-in-out_infinite] rounded-full bg-gradient-to-l from-orange-300 via-orange-400 to-orange-500 shadow-[0_0_14px_rgba(249,115,22,.55)] motion-reduce:animate-none" />
          </div>
        </div>
      </div>
      <style>{`@keyframes loading-slide { 0% { transform: translateX(260%); } 100% { transform: translateX(-260%); } } @keyframes logo-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }`}</style>
    </main>
  )
}
