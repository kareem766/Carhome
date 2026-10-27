import React from 'react'

type State = { hasError: boolean }

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep diagnostics available to the browser console without exposing internals to visitors.
    console.error('[My Car] Application rendering error', error, info.componentStack)
  }

  private retry = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main dir="rtl" lang="ar" className="grid min-h-screen min-h-[100dvh] place-items-center bg-slate-50 px-5 py-10">
        <section role="alert" className="w-full max-w-lg rounded-3xl border border-orange-200 bg-white p-7 text-center shadow-xl shadow-orange-950/5 sm:p-10">
          <img src="/mycar-logo.svg" alt="My Car" className="mx-auto mb-6 h-24 w-24 rounded-2xl object-contain" />
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-2xl font-black text-orange-700" aria-hidden="true">!</span>
          <h1 className="mt-4 text-2xl font-black text-slate-900">حصل خطأ غير متوقع</h1>
          <p className="mt-3 leading-7 text-slate-600">واجهت المنصة مشكلة أثناء عرض الصفحة. يمكنك إعادة المحاولة، ولن نعرض تفاصيل تقنية قد تؤثر على خصوصية بياناتك.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={this.retry} className="min-h-12 rounded-xl border border-orange-300 bg-orange-500 px-6 font-extrabold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
              إعادة تحميل المنصة
            </button>
            <a href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 font-bold text-slate-700 transition hover:bg-slate-50">
              العودة للرئيسية
            </a>
          </div>
        </section>
      </main>
    )
  }
}
