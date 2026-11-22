import React from 'react'

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
        <main dir="rtl" className="mc-error-recovery min-h-screen grid place-items-center px-4 py-10">
          <section role="alert" className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="h-1.5 bg-gradient-to-l from-blue-700 via-cyan-500 to-amber-400" />
            <div className="p-7 text-center sm:p-10">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-800">
                <span aria-hidden="true" className="text-3xl font-black">!</span>
              </span>
              <p className="mt-5 text-xs font-black tracking-wide text-blue-700">MY CAR · عربيتي</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">واجهتنا واجهت مشكلة غير متوقعة</h1>
              <p className="mt-3 text-sm leading-8 text-slate-600">
                لم يتم تحميل هذه الصفحة بالشكل الصحيح. يمكنك إعادة المحاولة، أو العودة إلى الصفحة الرئيسية ومتابعة استخدام المنصة.
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-400">
                إذا كنت تكتب بيانات في نموذج، فقد تحتاج إلى مراجعتها قبل إعادة الإرسال.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={this.recover} className="min-h-12 flex-1 rounded-xl bg-blue-800 px-5 font-extrabold text-white transition hover:bg-blue-700">
                  إعادة تحميل الصفحة
                </button>
                <a href="/" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 px-5 font-extrabold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">
                  العودة للرئيسية
                </a>
              </div>
              <a href="/support" className="mt-5 inline-flex text-sm font-bold text-blue-700 underline-offset-4 hover:underline">التواصل مع دعم My Car</a>
            </div>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
