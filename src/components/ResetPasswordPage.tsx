import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const client = supabase
    if (!client) { setError('خدمة الحسابات غير متاحة حاليًا.'); setReady(true); return }
    let active = true
    const verifySession = async () => {
      const { data, error: sessionError } = await client.auth.getSession()
      if (!active) return
      if (sessionError || !data.session?.user) {
        setError('رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.')
      }
      setReady(true)
    }
    void verifySession()
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        setError('')
        setReady(true)
      }
      if (event === 'SIGNED_OUT') {
        setError('انتهت جلسة استعادة كلمة المرور. اطلب رابطًا جديدًا للمتابعة.')
        setReady(true)
      }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const client = supabase
    if (!client) { setError('خدمة الحسابات غير متاحة حاليًا.'); return }
    if (password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.'); return }
    if (password !== confirmPassword) { setError('تأكيد كلمة المرور غير مطابق.'); return }
    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession()
      if (sessionError || !sessionData.session?.user) throw new Error('جلسة الاستعادة غير موجودة أو انتهت صلاحيتها. اطلب رابطًا جديدًا.')
      const user = sessionData.session.user
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError

      // Admin-created accounts must also complete the one-time password guard.
      if (user.app_metadata?.must_change_password === true) {
        const { data: completion, error: completionError } = await client.functions.invoke('admin-managed-accounts', {
          body: { action: 'complete', password }
        })
        if (completionError) throw completionError
        if (completion?.error) throw new Error(String(completion.error))
      }

      const { data: refreshed, error: refreshError } = await client.auth.refreshSession()
      if (refreshError || !refreshed.session?.user) {
        throw new Error('تم تغيير كلمة المرور، لكن تعذر تحديث الجلسة. سجّل الدخول مرة أخرى.')
      }
      const currentUser = refreshed.session.user
      const { data: adminRecord, error: adminLookupError } = await client.from('platform_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle()
      if (adminLookupError) throw adminLookupError
      const role = currentUser.user_metadata?.organization_type
      const destination = adminRecord ? '/workspace/admin' : role === 'company' ? '/workspace/company' : role === 'fleet_supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'
      setSuccess(true)
      window.setTimeout(() => window.location.replace(destination), 900)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر حفظ كلمة المرور الجديدة. اطلب رابط استعادة جديدًا.')
    } finally { setSaving(false) }
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_48%),#f8fafc] px-4 py-8">
    <section className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-xl sm:p-9">
      <div className="mb-6 flex justify-center"><PlatformBrand /></div>
      {success ? <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={28}/></span><h1 className="mt-5 text-2xl font-extrabold text-slate-950">تم تغيير كلمة المرور بنجاح</h1><p className="mt-3 text-sm leading-7 text-slate-600">جارٍ توجيهك إلى حسابك...</p></div> : <>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck size={28}/></span>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-slate-950">إعادة تعيين كلمة المرور</h1>
        <p className="mt-3 text-center text-sm leading-7 text-slate-600">أدخل كلمة المرور الجديدة لحسابك، ثم أكدها لإتمام التغيير بأمان.</p>
        {!ready ? <div className="flex justify-center py-8 text-slate-500"><LoaderCircle className="animate-spin"/></div> : error ? <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700"><div className="mb-1 flex items-center gap-2 font-bold"><AlertCircle size={18}/> تعذر متابعة الاستعادة</div>{error}<a href="/?login=1" className="mt-3 block font-extrabold text-blue-700 underline">العودة لتسجيل الدخول وطلب رابط جديد</a></div> : <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-slate-700">كلمة المرور الجديدة<div className="relative mt-2"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 px-4 pl-12 font-normal outline-none focus:border-blue-500" placeholder="8 أحرف على الأقل" dir="ltr"/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>
          <label className="block text-sm font-bold text-slate-700">تأكيد كلمة المرور<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-blue-500" placeholder="أعد كتابة كلمة المرور" dir="ltr"/></label>
          <button type="submit" disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={19}/> : <ShieldCheck size={19}/>}حفظ كلمة المرور الجديدة</button>
        </form>}
      </>}
    </section>
  </main>
}
