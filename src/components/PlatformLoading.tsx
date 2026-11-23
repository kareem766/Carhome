type PlatformLoadingProps = {
  pageName?: string
  fadeOut?: boolean
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

export default function PlatformLoading({ pageName, fadeOut = false }: PlatformLoadingProps) {
  const currentPage = pageName || (typeof window !== 'undefined' ? resolvePageName(window.location.pathname) : 'مساحة العمل')

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white/72 px-5 backdrop-blur-[5px] ${fadeOut ? "animate-[mc-platform-loader-fade_520ms_ease-out_forwards]" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`جارٍ فتح ${currentPage}`}
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <div className="relative flex h-24 w-52 items-center justify-center">
          <span aria-hidden="true" className="absolute inset-5 rounded-full bg-cyan-300/20 blur-2xl" />
          <img
            src="https://bxmfykzckjoecvpoqlag.supabase.co/storage/v1/object/public/platform-assets/branding/logo-1792916619080.png"
            alt="My Car عربيتي"
            className="relative z-10 max-h-20 w-44 object-contain animate-[brand-breathe_2.4s_ease-in-out_infinite]"
          />
        </div>
        <p className="mt-3 text-base font-extrabold leading-7 text-slate-800">
          جارٍ فتح <span className="text-[#079fbd]">{currentPage}</span>
        </p>
        <p className="mt-1 text-sm font-medium text-slate-500">لحظات ونكون معك</p>
        <div aria-hidden="true" className="mt-5 h-1 w-24 overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full w-1/2 rounded-full bg-gradient-to-l from-[#08aeca] to-orange-400 animate-[loading-glide_1.35s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes brand-breathe {
          0%, 100% { opacity: 1; transform: translateY(0) scale(.995); }
          50% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mc-platform-loader-fade { from { opacity: 1; visibility: visible; } to { opacity: 0; visibility: hidden; } }
        @keyframes loading-glide {
          0% { transform: translateX(150%); }
          100% { transform: translateX(-150%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\[brand-breathe_1\.9s_ease-in-out_infinite\],
          .animate-\[loading-glide_1\.35s_ease-in-out_infinite\] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
