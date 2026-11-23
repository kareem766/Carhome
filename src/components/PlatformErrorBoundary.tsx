import React from 'react'
import { AlertTriangle, ArrowLeft, Headset, Home, RefreshCw, ShieldCheck } from 'lucide-react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export default class PlatformErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep diagnostics useful without logging form values, credentials, or user records.
    console.error('My Car interface rendering error', {
      message: error.message,
      componentStack: info.componentStack
    })
  }

  private recover = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          dir="rtl"
          className="mc-error-recovery relative grid min-h-screen place-items-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12"
          style={{
            background: 'radial-gradient(ellipse at 12% 8%, rgba(59,130,246,.22), transparent 38%), radial-gradient(ellipse at 90% 92%, rgba(14,165,233,.16), transparent 34%), linear-gradient(145deg, #071a32 0%, #102b4a 52%, #0b1e37 100%)'
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-12 h-64 w-64 rounded-full border border-white/[0.07]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full border border-white/[0.06]" />

          <section role="alert" className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/[0.97] shadow-[0_28px_90px_rgba(0,0,0,.34)]">
            <div className="h-1.5 bg-gradient-to-l from-amber-400 via-cyan-400 to-blue-700" />
            <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
              <div className="mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.4rem] bg-gradient-to-br from-blue-50 to-sky-100 text-blue-700 shadow-inner ring-1 ring-blue-100">
                <AlertTriangle size={34} strokeWidth={2.2} />
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-[11px] font-black tracking-wide text-blue-800">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                MY CAR <span className="text-blue-300">·</span> عربيتي
              </div>

              <h1 className="mt-5 text-[1.8rem] font-black leading-[1.35] tracking-tight text-slate-950 sm:text-4xl">
                تعذّر عرض الصفحة
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-8 text-slate-600 sm:text-base">
                حدث خطأ أثناء تحميل الصفحة المطلوبة، لذلك لم نتمكن من عرض محتواها الآن. يمكنك إعادة المحاولة أو الرجوع إلى الصفحة الرئيسية.
              </p>

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3.5 text-right">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-700" />
                <p className="text-xs font-medium leading-6 text-slate-600 sm:text-sm">
                  لو كنت بتدخل بيانات في نموذج، راجعها قبل إعادة الإرسال للتأكد من عدم تكرار الطلب.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={this.recover}
                  className="group inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-blue-700 to-blue-600 px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(29,78,216,.25)] transition duration-200 hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  <RefreshCw size={19} className="transition-transform duration-500 group-hover:rotate-[-35deg]" />
                  إعادة المحاولة
                </button>
                <a
                  href="/"
                  className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  <Home size={18} />
                  العودة للرئيسية
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
                <Headset size={17} className="text-blue-700" />
                <span className="text-slate-500">ما زالت المشكلة موجودة؟</span>
                <a href="/contact" className="inline-flex items-center gap-1 font-black text-blue-700 underline-offset-4 transition hover:text-blue-900 hover:underline">
                  تواصل مع فريق الدعم
                  <ArrowLeft size={15} />
                </a>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-l from-transparent via-blue-100 to-transparent" />
          </section>

          <p className="relative mt-5 text-center text-[11px] font-medium text-white/55">
            My Car عربيتي <span className="mx-1.5 text-white/30">•</span> نساعدك ترجع لتجربتك بسهولة
          </p>
        </main>
      )
    }

    return this.props.children
  }
}
