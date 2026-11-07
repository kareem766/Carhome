import { useEffect, useState } from 'react'
import { Bell, BellRing, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export default function NotificationOnboardingPrompt() {
  const [userId, setUserId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user.id ?? null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId || typeof Notification === 'undefined' || Notification.permission !== 'default') {
      setVisible(false)
      return
    }
    const dismissed = window.localStorage.getItem('mycar-push-onboarding-dismissed:' + userId)
    setVisible(!dismissed)
  }, [userId])

  function dismiss() {
    if (userId) window.localStorage.setItem('mycar-push-onboarding-dismissed:' + userId, '1')
    setVisible(false)
  }

  async function saveDeviceSubscription(registration: ServiceWorkerRegistration, user: { id: string }) {
    if (!supabase || !publicVapidKey) throw new Error('إعداد إشعارات الهاتف غير مكتمل حاليًا.')
    if (!registration.pushManager || typeof registration.pushManager.subscribe !== 'function') {
      throw new Error('المتصفح لا يدعم إشعارات Push في وضع التشغيل الحالي.')
    }
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      })
    }
    const payload = subscription.toJSON()
    if (!payload.keys?.p256dh || !payload.keys?.auth) {
      throw new Error('تعذر قراءة بيانات اشتراك الإشعارات من الجهاز.')
    }
    const { error: subscriptionError } = await supabase.from('platform_push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: payload.keys.p256dh,
      auth_key: payload.keys.auth,
      user_agent: navigator.userAgent
    }, { onConflict: 'user_id,endpoint' })
    if (subscriptionError) throw subscriptionError

    const { data: preferences, error: preferencesError } = await supabase
      .from('platform_notification_preferences')
      .select('email_enabled,marketing_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
    if (preferencesError) throw preferencesError
    const { error: saveError } = await supabase.from('platform_notification_preferences').upsert({
      user_id: user.id,
      push_enabled: true,
      email_enabled: preferences?.email_enabled ?? true,
      marketing_enabled: preferences?.marketing_enabled ?? true
    }, { onConflict: 'user_id' })
    if (saveError) throw saveError
  }

  async function enableNotifications() {
    if (!supabase || !userId || busy) return
    setBusy(true)
    setError('')
    try {
      if (!('serviceWorker' in navigator) || typeof Notification === 'undefined') {
        throw new Error('الإشعارات غير مدعومة في المتصفح الحالي. جرّب متصفحًا يدعم إشعارات الويب.')
      }
      if (isIosDevice() && !isStandalonePwa()) {
        throw new Error('على iPhone أو iPad، أضف My Car إلى الشاشة الرئيسية أولًا، ثم افتح المنصة من الأيقونة وجرّب التفعيل مرة أخرى.')
      }
      if (!publicVapidKey) throw new Error('إعداد مفتاح إشعارات الهاتف غير مكتمل حاليًا.')

      // The browser permission request must be invoked directly from this button click.
      const permissionRequest = Notification.permission === 'granted'
        ? Promise.resolve('granted' as NotificationPermission)
        : Notification.requestPermission()
      const permission = await permissionRequest
      if (permission !== 'granted') {
        dismiss()
        return
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/push/' })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.')
      await saveDeviceSubscription(registration, user)
      dismiss()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تفعيل إشعارات الهاتف.')
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null

  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="push-onboarding-title">
    <section className="relative w-full max-w-md rounded-3xl border border-blue-100 bg-white p-6 text-right shadow-2xl sm:p-8">
      <button type="button" onClick={dismiss} aria-label="إغلاق" className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18}/></button>
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-700"><BellRing size={32}/></div>
      <p className="text-center text-sm font-bold text-blue-700">My Car عربيتي</p>
      <h2 id="push-onboarding-title" className="mt-2 text-center text-xl font-black text-slate-900">فعّل إشعارات المنصة</h2>
      <p className="mt-3 text-center text-sm leading-7 text-slate-600">خليك على اطلاع بطلباتك والعروض والرسائل المهمة. اضغط تفعيل، وبعدها اختار «سماح» في رسالة المتصفح.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void enableNotifications()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-black text-white hover:bg-blue-800 disabled:opacity-60"><Bell size={18}/>{busy ? 'جارٍ تفعيل الإشعارات...' : 'تفعيل إشعارات الهاتف'}</button>
      <button type="button" onClick={dismiss} className="mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-50">لاحقًا</button>
      <p className="mt-3 text-center text-xs leading-5 text-slate-400">تقدر تغيّر اختيارك في أي وقت من إعدادات الإشعارات أو إعدادات الجهاز.</p>
    </section>
  </div>
}
