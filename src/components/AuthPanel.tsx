import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, LoaderCircle, LogOut, ShieldCheck, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AccountType = 'individual_owner' | 'fleet_supplier' | 'company'
type Props = { onClose: () => void; initialMode?: 'signin' | 'signup' }

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

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
        const name = fullName.trim()
        const orgName = organizationName.trim()
        if (!name || !orgName) throw new Error('اكتب الاسم واسم المؤسسة لإكمال التسجيل.')
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              display_name: name,
              organization_name: orgName,
              organization_type: accountType
            }
          }
        })
        if (signUpError) throw signUpError
        if (data.session && data.user) {
          await prepareAccount(data.user, name)
          setSession(data.session)
          setNotice('تم إنشاء الحساب وتجهيز الملف الشخصي والمؤسسة بنجاح.')
        } else {
          setNotice('تم إرسال طلب التسجيل. افتح رسالة تأكيد البريد الإلكتروني، ثم ارجع وسجّل الدخول لإكمال إعداد الحساب.')
          setMode('signin')
        }
      } else {
        const identifier = email.trim()
        const { data, error: signInError } = await supabase.auth.signInWithPassword(
          identifier.includes('@') ? { email: identifier.toLowerCase(), password } : { phone: identifier, password }
        )
        if (signInError) throw signInError
        if (data.user) await prepareAccount(data.user, String(data.user.user_metadata?.display_name || ''))
        setSession(data.session)
        const role = data.user?.user_metadata?.organization_type
        if (role === 'company') window.location.href = '/workspace/company'
        else if (role === 'fleet_supplier') window.location.href = '/workspace/supplier/vehicles'
        else if (role === 'individual_owner') window.location.href = '/workspace/owner/vehicles'
        setNotice('تم تسجيل الدخول وتجهيز حسابك.')
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع. حاول مرة أخرى.'
      setError(message.includes('Invalid login credentials') ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : message)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="auth-title" dir="rtl">
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-7">
          <div>
            <p className="text-sm font-extrabold text-carblue">Carhome</p>
            <h2 id="auth-title" className="mt-1 text-2xl font-extrabold text-navy">
              {session ? 'حسابك' : mode === 'signup' ? 'أنشئ حسابك' : 'أهلًا بعودتك'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {session ? 'تم تسجيل الدخول. سنضيف وظائف لوحة التحكم في الخطوات التالية.' : 'حساب واحد لتبدأ رحلتك في تأجير السيارات للشركات.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="p-5 sm:p-7">
          {!supabase && <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">إعدادات Supabase غير متاحة. لن يتم حفظ أي بيانات حتى يتم ضبط متغيرات الاتصال.</div>}
          {sessionLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500"><LoaderCircle className="animate-spin" size={20} /> جارٍ التحقق من الجلسة...</div>
          ) : session ? (
            <div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="flex items-center gap-2 font-bold text-navy"><CheckCircle2 className="text-cargreen" size={20} /> أنت مسجل الدخول</div>
                <p className="mt-2 break-all text-sm text-slate-600">{session.user.email}</p>
                <p className="mt-2 text-sm text-slate-600">{String(session.user.user_metadata?.display_name || 'مستخدم Carhome')}</p>
              </div>
              <button onClick={handleSignOut} disabled={loading} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-bold text-navy hover:bg-slate-50 disabled:opacity-60">
                {loading ? <LoaderCircle className="animate-spin" size={18} /> : <LogOut size={18} />} تسجيل الخروج
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice('') }} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-white text-navy shadow-sm' : 'text-slate-500'}`}>تسجيل الدخول</button>
                <button type="button" onClick={() => { setMode('signup'); setError(''); setNotice('') }} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-navy shadow-sm' : 'text-slate-500'}`}>حساب جديد</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <label className="block text-sm font-bold text-slate-700">الاسم الكامل
                      <input autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none transition focus:border-carblue" placeholder="اكتب اسمك" />
                    </label>
                    <fieldset>
                      <legend className="mb-2 text-sm font-bold text-slate-700">نوع الحساب</legend>
                      <div className="grid gap-2">
                        {accountTypes.map((type) => (
                          <label key={type.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${accountType === type.value ? 'border-carblue bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="accountType" value={type.value} checked={accountType === type.value} onChange={() => setAccountType(type.value)} className="mt-1 accent-blue-600" />
                            <span><span className="block text-sm font-bold text-navy">{type.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{type.detail}</span></span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="block text-sm font-bold text-slate-700">اسم المؤسسة أو النشاط
                      <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder={accountType === 'company' ? 'اسم الشركة' : accountType === 'fleet_supplier' ? 'اسم المورد أو الشركة' : 'اسمك أو اسم النشاط (يمكن أن يكون اسمك)'} />
                    </label>
                  </>
                )}
                <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني
                  <input type="text" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-carblue" placeholder="البريد الإلكتروني أو رقم الهاتف" dir="ltr" />
                </label>
                <label className="block text-sm font-bold text-slate-700">كلمة المرور
                  <span className="relative mt-2 block">
                    <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 px-4 pl-12 font-normal outline-none focus:border-carblue" placeholder="٦ أحرف على الأقل" dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute left-3 top-3 rounded-md p-1 text-slate-400">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                  </span>
                </label>
                <button type="submit" disabled={loading || !supabase} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-carblue px-4 font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}
                  {loading ? 'جارٍ المعالجة...' : mode === 'signup' ? 'إنشاء الحساب' : 'تسجيل الدخول'}
                </button>
              </form>
              <p className="mt-4 text-center text-xs leading-6 text-slate-500">بإنشاء الحساب، أنت مسؤول عن صحة بياناتك. لا تتم أي مدفوعات بين أطراف التأجير عبر Carhome.</p>
            </>
          )}
          {notice && <div role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</div>}
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>}
        </div>
      </div>
    </div>
  )
}
