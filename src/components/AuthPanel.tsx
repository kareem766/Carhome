import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, LoaderCircle, LogOut, ShieldCheck, X, CircleUserRound } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type AccountType = 'individual_owner' | 'fleet_supplier' | 'company'
type Props = { onClose: () => void; initialMode?: 'signin' | 'signup' }

function normalizeEgyptianPhone(value: string) {
  const compact = value.trim().replace(/[\\s().-]/g, '')
  if (compact.startsWith('+')) return compact
  const digits = compact.replace(/\\D/g, '')
  if (digits.startsWith('0020')) return `+${digits.slice(2)}`
  if (digits.startsWith('20')) return `+${digits}`
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`
  if (digits.startsWith('1') && digits.length === 10) return `+20${digits}`
  return compact
}

const accountTypes: { value: AccountType; label: string; detail: string }[] = [
  { value: 'individual_owner', label: 'مالك سيارة', detail: 'إدارة سياراتك واستقبال طلبات الشركات' },
  { value: 'fleet_supplier', label: 'مورد أسطول', detail: 'عرض سيارات الأسطول والتعامل مع الطلبات' },
  { value: 'company', label: 'شركة طالبة', detail: 'طلب سيارات للتأجير الشهري أو السنوي' }
]

async function prepareAccount(user: NonNullable<Session['user']>, fallbackName: string) {
  if (!supabase) throw new Error('خدمة الحسابات غير متاحة حاليًا.')
  const metadata = user.user_metadata ?? {}
  const displayName = String(metadata.display_name || fallbackName || user.email || '').trim()
  const orgName = String(metadata.organization_name || displayName).trim()
  const orgType = accountTypes.some((item) => item.value === metadata.organization_type)
    ? metadata.organization_type as AccountType
    : 'individual_owner'

  const profileResult = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: displayName,
    locale: 'ar',
    phone: String(metadata.phone || user.phone || '').trim() || null,
    contact_email: String(metadata.email_contact || user.email || '').trim() || null,
    address: String(metadata.address || '').trim() || null
  }, { onConflict: 'id' })
  if (profileResult.error) {
    const missingNewColumns = /column|schema cache|could not find/i.test(profileResult.error.message)
    if (!missingNewColumns) throw profileResult.error
    const legacyProfile = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName, locale: 'ar' }, { onConflict: 'id' })
    if (legacyProfile.error) throw legacyProfile.error
  }

  const membershipResult = await supabase.from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (membershipResult.error) throw membershipResult.error
  if (membershipResult.data) return

  const existingOrg = await supabase.from('organizations')
    .select('id')
    .eq('created_by', user.id)
    .limit(1)
    .maybeSingle()
  if (existingOrg.error) throw existingOrg.error

  let organizationId = existingOrg.data?.id
  if (!organizationId) {
    const organizationResult = await supabase.from('organizations').insert({
      name: orgName,
      organization_type: orgType,
      created_by: user.id,
      city: String(metadata.governorate || '').trim() || null,
      contact_name: displayName,
      phone: String(metadata.phone || user.phone || '').trim() || null,
      contact_email: String(metadata.email_contact || user.email || '').trim() || null,
      address: String(metadata.address || '').trim() || null,
      company_type: String(metadata.company_type || '').trim() || null
    }).select('id').single()
    if (organizationResult.error && /column|schema cache|could not find/i.test(organizationResult.error.message)) {
      const legacyOrganization = await supabase.from('organizations').insert({ name: orgName, organization_type: orgType, created_by: user.id, city: String(metadata.governorate || '').trim() || null }).select('id').single()
      if (legacyOrganization.error) throw legacyOrganization.error
      organizationId = legacyOrganization.data.id
    } else {
      if (organizationResult.error) throw organizationResult.error
      organizationId = organizationResult.data.id
    }
  }

  const membershipInsert = await supabase.from('organization_memberships').insert({
    organization_id: organizationId,
    user_id: user.id,
    role: 'owner'
  })
  if (membershipInsert.error && membershipInsert.error.code !== '23505') throw membershipInsert.error
}

export default function AuthPanel({ onClose, initialMode = 'signin' }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [forgotPassword, setForgotPassword] = useState(() => window.location.search.includes('reset-password=1'))
  const [settingNewPassword, setSettingNewPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>('individual_owner')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') { setSettingNewPassword(true); setForgotPassword(false); setNotice('أدخل كلمة المرور الجديدة لحسابك.'); setError('') }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!supabase) { setError('خدمة الحسابات غير متاحة حاليًا.'); return }
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.includes('@')) { setError('اكتب البريد الإلكتروني الصحيح لاستعادة كلمة المرور.'); return }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/auth/callback?flow=password-reset` })
      if (resetError) throw resetError
      setNotice('إذا كان البريد مسجلًا، ستصلك رسالة تحتوي على رابط آمن لإعادة تعيين كلمة المرور.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إرسال رابط استعادة كلمة المرور.')
    } finally { setLoading(false) }
  }

  async function handleSetNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setNotice('')
    if (!supabase) { setError('خدمة الحسابات غير متاحة حاليًا.'); return }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSettingNewPassword(false); setForgotPassword(false); setPassword('')
      setNotice('تم تغيير كلمة المرور بنجاح. جارٍ توجيهك إلى مساحة عملك...')
      // Keep the recovery session alive and reuse the shared account setup/router.
      // This sends the user to the correct role workspace (or admin console) without another login.
      window.location.replace('/auth/callback?flow=password-reset')
      return
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تغيير كلمة المرور. اطلب رابط استعادة جديدًا.')
    } finally { setLoading(false) }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!supabase) {
      setError('الاتصال بخدمة الحسابات غير مضبوط بعد. راجع إعدادات Supabase في Vercel.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signup') {
        if (!acceptedLegal) throw new Error('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية قبل إنشاء الحساب.')
        const name = fullName.trim()
        const orgName = organizationName.trim()
        if (!name || !orgName) throw new Error('اكتب الاسم واسم المؤسسة لإكمال التسجيل.')
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            // Explicitly return confirmation links to the deployed app's callback, not Supabase's default URL.
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              display_name: name,
              organization_name: orgName,
              organization_type: accountType,
              legal_acceptance: { terms_version: '2026-10-25', privacy_version: '2026-10-25', accepted_at: new Date().toISOString() }
            }
          }
        })
        if (signUpError) {
          const msg = signUpError.message.toLowerCase()
          if (/already registered|user already exists|already been registered|email exists|duplicate/i.test(msg)) {
            setMode('signin')
            throw new Error('هذا البريد الإلكتروني لديه حساب بالفعل في قاعدة بيانات My Car. برجاء تسجيل الدخول أو استخدام «نسيت كلمة السر».')
          }
          throw signUpError
        }
        // Supabase may return a user without an error for an existing address when confirmations are enabled.
        if (data.user && !data.session && data.user.identities?.length === 0) {
          setMode('signin')
          throw new Error('هذا البريد الإلكتروني لديه حساب بالفعل في قاعدة بيانات My Car. برجاء تسجيل الدخول أو استخدام «نسيت كلمة السر».')
        }
        if (data.session && data.user) {
          await prepareAccount(data.user, name)
          // Complete account setup through the shared callback, then open the role workspace.
          window.location.replace('/auth/callback')
          return
        } else {
          setNotice('تم إرسال طلب التسجيل. افتح رسالة تأكيد البريد الإلكتروني، ثم ارجع وسجّل الدخول لإكمال إعداد الحساب.')
          setMode('signin')
        }
      } else {
        const identifier = email.trim()
        const isEmail = identifier.includes('@')
        const phone = normalizeEgyptianPhone(identifier)
        if (!isEmail && !/^\\+20\\d{10}$/.test(phone)) {
          throw new Error('اكتب بريدًا إلكترونيًا صحيحًا أو رقم موبايل مصريًا مكوّنًا من 11 رقمًا.')
        }
        const { data, error: signInError } = await supabase.auth.signInWithPassword(
          isEmail ? { email: identifier.toLowerCase(), password } : { phone, password }
        )
        if (signInError) throw signInError
        if (!data.user || !data.session) throw new Error('تم تسجيل الدخول لكن لم يتم إنشاء جلسة صالحة. حاول مرة أخرى.')
        // Admin-provisioned accounts must change their temporary password before any onboarding or workspace route.
        if (data.user.app_metadata?.must_change_password === true) {
          window.location.replace('/first-login-password')
          return
        }
        // Use the shared callback to recover incomplete accounts and route every role consistently.
        window.location.replace('/auth/callback')
        return
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع. حاول مرة أخرى.'
      setError(message.includes('Invalid login credentials') ? 'البريد الإلكتروني أو رقم الموبايل أو كلمة المرور غير صحيحة.' : message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { error: signOutError } = await supabase.auth.signOut()
    setLoading(false)
    if (signOutError) setError(signOutError.message)
    else {
      setSession(null)
      setNotice('تم تسجيل الخروج بأمان.')
    }
  }

  return (
    <div className="mc-auth-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="auth-title" dir="rtl">
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-7">
          <div>
            <div className="mb-2"><PlatformBrand /></div>
            <h2 id="auth-title" className="mt-1 text-2xl font-extrabold text-navy">
              {settingNewPassword ? 'تعيين كلمة مرور جديدة' : forgotPassword ? 'استعادة كلمة المرور' : session ? 'حسابك' : mode === 'signup' ? 'أنشئ حسابك' : 'أهلًا بعودتك'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {settingNewPassword ? 'اختر كلمة مرور جديدة وآمنة لحسابك.' : forgotPassword ? 'استعد الوصول إلى حسابك بسهولة.' : session ? 'تم تسجيل الدخول. سنضيف وظائف لوحة التحكم في الخطوات التالية.' : 'حساب واحد لتبدأ رحلتك في تأجير السيارات للشركات.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="p-5 sm:p-7">
          {!supabase && <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">إعدادات Supabase غير متاحة. لن يتم حفظ أي بيانات حتى يتم ضبط متغيرات الاتصال.</div>}
          {sessionLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500"><LoaderCircle className="animate-spin" size={20} /> جارٍ التحقق من الجلسة...</div>
          ) : settingNewPassword ? (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">أنشئ كلمة مرور جديدة لا تقل عن 6 أحرف.</p>
              <label className="block text-sm font-bold text-slate-700">كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder="6 أحرف على الأقل" dir="ltr" /></label>
              <button type="submit" disabled={loading || !supabase} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}حفظ كلمة المرور الجديدة</button>
            </form>
          ) : forgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">اكتب بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور إذا كان الحساب مسجلًا.</p>
              <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder="البريد الإلكتروني" dir="ltr" /></label>
              <button type="submit" disabled={loading || !supabase} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}إرسال رابط الاستعادة</button>
              <button type="button" onClick={() => { setForgotPassword(false); setError(''); setNotice('') }} className="w-full py-2 text-sm font-bold text-blue-700">العودة لتسجيل الدخول</button>
            </form>
          ) : session ? (
            <div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="flex items-center gap-2 font-bold text-navy"><CheckCircle2 className="text-cargreen" size={20} /> أنت مسجل الدخول</div>
                <p className="mt-2 break-all text-sm text-slate-600">{session.user.email}</p>
                <p className="mt-2 text-sm text-slate-600">{String(session.user.user_metadata?.display_name || 'مستخدم My Car')}</p>
              </div>
              <button onClick={() => { window.location.href = '/auth/callback' }} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white hover:bg-blue-700"><CircleUserRound size={19}/> مساحة عملك</button>
              <button onClick={handleSignOut} disabled={loading} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-bold text-navy hover:bg-slate-50 disabled:opacity-60">
                {loading ? <LoaderCircle className="animate-spin" size={18} /> : <LogOut size={18} />} تسجيل الخروج
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice('') }} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-white text-navy shadow-sm' : 'text-slate-500'}`}>تسجيل الدخول</button>
                <button type="button" onClick={() => { window.location.href = '/register' }} className="rounded-lg px-3 py-2.5 text-sm font-bold text-slate-500 transition">حساب جديد</button>
              </div>
              {settingNewPassword ? (
                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <p className="text-sm leading-6 text-slate-600">أنشئ كلمة مرور جديدة لا تقل عن 6 أحرف.</p>
                  <label className="block text-sm font-bold text-slate-700">كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder="6 أحرف على الأقل" dir="ltr" /></label>
                  <button type="submit" disabled={loading || !supabase} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}حفظ كلمة المرور الجديدة</button>
                </form>
              ) : forgotPassword ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm leading-6 text-slate-600">اكتب بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور إذا كان الحساب مسجلًا.</p>
                  <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني
                    <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder="البريد الإلكتروني" dir="ltr" />
                  </label>
                  <button type="submit" disabled={loading || !supabase} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}إرسال رابط الاستعادة</button>
                  <button type="button" onClick={() => { setForgotPassword(false); setError(''); setNotice('') }} className="w-full py-2 text-sm font-bold text-blue-700">العودة لتسجيل الدخول</button>
                </form>
              ) : <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <label className="block text-sm font-bold text-slate-700">الاسم الكامل
                      <input autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="اكتب اسمك" />
                    </label>
                    <fieldset>
                      <legend className="mb-2 text-sm font-bold text-slate-700">نوع الحساب</legend>
                      <div className="grid gap-2">
                        {accountTypes.map((type) => (
                          <label key={type.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition duration-200 ${accountType === type.value ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}>
                            <input type="radio" name="accountType" value={type.value} checked={accountType === type.value} onChange={() => setAccountType(type.value)} className="mt-1 accent-blue-600" />
                            <span><span className="block text-sm font-bold text-navy">{type.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{type.detail}</span></span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="block text-sm font-bold text-slate-700">اسم المؤسسة أو النشاط
                      <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder={accountType === 'company' ? 'اسم الشركة' : accountType === 'fleet_supplier' ? 'اسم المورد أو الشركة' : 'اسمك أو اسم النشاط (يمكن أن يكون اسمك)'} />
                    </label>
                  </>
                )}
                <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني
                  <input type="text" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder="البريد الإلكتروني أو رقم الهاتف" dir="ltr" />
                </label>
                <label className="block text-sm font-bold text-slate-700">كلمة المرور
                  <span className="relative mt-2 block">
                    <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pl-12 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="٦ أحرف على الأقل" dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute left-3 top-3 rounded-md p-1 text-slate-400">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                  </span>
                </label>
                {mode === 'signin' && <div className="text-left"><button type="button" onClick={() => { setForgotPassword(true); setError(''); setNotice('') }} className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-extrabold text-blue-800 hover:bg-blue-100">نسيت كلمة المرور؟</button></div>}
                {mode === 'signup' && <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-slate-700"><input type="checkbox" required checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-blue-700"/><span>أوافق على <a href="/terms" target="_blank" rel="noreferrer" className="font-extrabold text-blue-700 underline">شروط الاستخدام</a> و<a href="/privacy" target="_blank" rel="noreferrer" className="font-extrabold text-blue-700 underline">سياسة الخصوصية</a>.</span></label>}
                <button type="submit" disabled={loading || !supabase || (mode === 'signup' && !acceptedLegal)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}
                  {loading ? 'جارٍ المعالجة...' : mode === 'signup' ? 'إنشاء الحساب' : 'تسجيل الدخول'}
                </button>
              </form>}
              {!forgotPassword && <p className="mt-4 text-center text-xs leading-6 text-slate-500">بإنشاء الحساب، أنت مسؤول عن صحة بياناتك. لا تتم أي مدفوعات بين أطراف التأجير عبر My Car. <a href="/privacy" className="font-bold text-blue-700 underline">الخصوصية</a> · <a href="/terms" className="font-bold text-blue-700 underline">الشروط</a></p>}
            </>
          )}
          {notice && <div role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</div>}
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>}
        </div>
      </div>
    </div>
  )
}
