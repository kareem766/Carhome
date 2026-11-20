import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, Clock3, CheckCircle2, LoaderCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import PlatformLoading from './PlatformLoading'
import type { EmailOtpType, User } from '@supabase/supabase-js'

type AccountRole = 'individual_owner' | 'fleet_supplier' | 'company' | 'employee'

async function finishAccount(user: User) {
  if (!supabase) throw new Error('خدمة الحسابات غير متاحة حاليًا.')
  // Refresh the authenticated session before writing protected profile/organization rows.
  const refreshed = await supabase.auth.refreshSession()
  if (refreshed.error) throw new Error('تم إنشاء الحساب، لكن تعذر تحديث جلسة الدخول. سجّل الدخول مرة أخرى لإكمال إعداد الحساب.')
  if (!refreshed.data.session?.user || refreshed.data.session.user.id !== user.id) {
    throw new Error('تم إنشاء الحساب، لكن جلسة الدخول غير متطابقة. سجّل الدخول مرة أخرى لإكمال إعداد الحساب.')
  }
  const metadata = user.user_metadata ?? {}
  const displayName = String(metadata.display_name || user.email || user.phone || 'مستخدم Carhome').trim()
  const role = (['individual_owner', 'fleet_supplier', 'company', 'employee'].includes(String(metadata.organization_type))
    ? metadata.organization_type
    : 'individual_owner') as AccountRole
  const organizationName = String(metadata.organization_name || displayName).trim()
  let logoPath: string | null = null
  const pendingLogo = localStorage.getItem('carhome_pending_company_logo')
  if ((role === 'company' || role === 'fleet_supplier') && pendingLogo) {
    try {
      const response = await fetch(pendingLogo)
      const logoBlob = await response.blob()
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(logoBlob.type) || logoBlob.size > 2 * 1024 * 1024) {
        throw new Error('صيغة اللوجو غير مدعومة أو حجم الملف أكبر من 2 ميجابايت.')
      }
      const extension = logoBlob.type === 'image/png' ? 'png' : logoBlob.type === 'image/webp' ? 'webp' : 'jpg'
      logoPath = `${user.id}/logo-${Date.now()}.${extension}`
      const uploaded = await supabase.storage.from('organization-logos').upload(logoPath, logoBlob, { contentType: logoBlob.type, upsert: false })
      if (uploaded.error) throw uploaded.error
      localStorage.removeItem('carhome_pending_company_logo')
    } catch (logoError) {
      throw new Error(`تعذر حفظ لوجو الشركة: ${logoError instanceof Error ? logoError.message : 'حاول تسجيل الدخول مرة أخرى من نفس المتصفح.'}`)
    }
  }
  const profile = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: displayName,
    locale: 'ar',
    phone: String(metadata.phone || user.phone || '').trim() || null,
    contact_email: String(metadata.email_contact || user.email || '').trim() || null,
    address: String(metadata.address || '').trim() || null
  }, { onConflict: 'id' })
  if (profile.error) {
    if (!/column|schema cache|could not find/i.test(profile.error.message)) throw profile.error
    const legacy = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName, locale: 'ar' }, { onConflict: 'id' })
    if (legacy.error) throw legacy.error
  }

  if (role === 'employee') return role

  const membership = await supabase.from('organization_memberships').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (membership.error) throw membership.error
  if (membership.data) {
    if (logoPath) {
      const updated = await supabase.from('organizations').update({ logo_path: logoPath }).eq('id', membership.data.organization_id)
      if (updated.error) throw updated.error
    }
    return role
  }

  const existing = await supabase.from('organizations').select('id').eq('created_by', user.id).limit(1).maybeSingle()
  if (existing.error) throw existing.error
  let organizationId = existing.data?.id as string | undefined
  if (!organizationId) {
    let organization = await supabase.from('organizations').insert({
      name: organizationName,
      organization_type: role,
      created_by: user.id,
      city: String(metadata.governorate || '').trim() || null,
      contact_name: displayName,
      phone: String(metadata.phone || user.phone || '').trim() || null,
      contact_email: String(metadata.email_contact || user.email || '').trim() || null,
      address: String(metadata.address || '').trim() || null,
      company_type: String(metadata.company_type || '').trim() || null,
      fleet_vehicle_count: Number.isInteger(metadata.fleet_vehicle_count) ? metadata.fleet_vehicle_count : null,
      logo_path: logoPath
    }).select('id').single()
    if (organization.error && /column|schema cache|could not find/i.test(organization.error.message)) {
      organization = await supabase.from('organizations').insert({
        name: organizationName, organization_type: role, created_by: user.id,
        city: String(metadata.governorate || '').trim() || null,
        fleet_vehicle_count: Number.isInteger(metadata.fleet_vehicle_count) ? metadata.fleet_vehicle_count : null,
        logo_path: logoPath
      }).select('id').single()
    }
    if (organization.error) {
      if (organization.error.code === '42501') throw new Error('تم إنشاء الحساب، لكن إعداد المؤسسة لم يكتمل بسبب صلاحيات قاعدة البيانات. سجّل الدخول مرة أخرى، وإذا استمرت المشكلة تواصل مع الدعم.')
      throw organization.error
    }
    organizationId = organization.data.id
  }
  if (logoPath && existing.data?.id) {
    const updated = await supabase.from('organizations').update({ logo_path: logoPath }).eq('id', organizationId)
    if (updated.error) throw updated.error
  }
  const inserted = await supabase.from('organization_memberships').insert({
    organization_id: organizationId, user_id: user.id, role: 'owner'
  })
  if (inserted.error && inserted.error.code !== '23505') throw inserted.error
  return role
}

export default function AuthCallbackPage() {
  const started = useRef(false)
  const [, setMessage] = useState('جارٍ تأكيد البريد الإلكتروني وتجهيز حسابك...')
  const [error, setError] = useState('')
  const [accountSuspended, setAccountSuspended] = useState(false)
  const [reviewEmail, setReviewEmail] = useState(() => { try { return localStorage.getItem('mycar_pending_suspended_account_email') || '' } catch { return '' } })
  const [reviewSending, setReviewSending] = useState(false)
  const [reviewReference, setReviewReference] = useState('')
  const [reviewError, setReviewError] = useState('')

  async function submitReviewRequest() {
    const normalizedEmail = reviewEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setReviewError('اكتب البريد الإلكتروني المرتبط بالحساب الموقوف لإرسال طلب المراجعة.')
      return
    }
    if (!supabase || reviewSending) return
    setReviewSending(true)
    setReviewError('')
    try {
      const displayName = normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ').slice(0, 90) || 'مستخدم My Car'
      const { data, error: submitError } = await supabase.functions.invoke('public-suspended-account-support', { body: {
        contactName: displayName,
        contactEmail: normalizedEmail,
        accountEmail: normalizedEmail,
        phone: '',
        subject: 'طلب مراجعة إيقاف الحساب',
        message: 'أطلب مراجعة إيقاف حسابي على منصة My Car عربيتي وإعادة فحص حالة الحساب.',
        website: ''
      } })
      if (submitError || !data?.success) throw new Error(data?.error || submitError?.message || 'تعذر إرسال طلبك الآن. حاول مرة أخرى بعد قليل.')
      setReviewReference(String(data.reference || ''))
      try { localStorage.removeItem('mycar_pending_suspended_account_email') } catch { /* ignore storage restrictions */ }
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : 'تعذر إرسال طلبك الآن. حاول مرة أخرى بعد قليل.')
    } finally {
      setReviewSending(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    let active = true

    async function complete() {
      try {
        if (!supabase) throw new Error('إعدادات الاتصال بخدمة الحسابات غير مكتملة.')
        const params = new URLSearchParams(window.location.search)
        const authError = params.get('error_description') || params.get('error')
        if (authError) throw new Error(authError)
        const code = params.get('code')
        const tokenHash = params.get('token_hash')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (tokenHash) {
          const otpType = (params.get('type') || 'signup') as EmailOtpType
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
          if (verifyError) throw verifyError
        }
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!data.session?.user) {
          throw new Error('لم نتمكن من استلام جلسة التحقق. افتح أحدث رسالة تأكيد، أو اطلب رسالة جديدة ثم جرّب مرة أخرى.')
        }
        // A suspended organization must see a clear account-status screen, not an email-confirmation error.
        const { data: suspensionMembership, error: suspensionLookupError } = await supabase
          .from('organization_memberships')
          .select('organization_id,organizations!inner(approval_status)')
          .eq('user_id', data.session.user.id)
          .limit(1)
          .maybeSingle()
        if (suspensionLookupError) throw suspensionLookupError
        const linkedOrganization = suspensionMembership?.organizations as { approval_status?: string } | { approval_status?: string }[] | null
        const organizationStatus = Array.isArray(linkedOrganization) ? linkedOrganization[0]?.approval_status : linkedOrganization?.approval_status
        if (organizationStatus === 'suspended') {
          if (!active) return
          setAccountSuspended(true)
          setMessage('')
          return
        }
        // Password-recovery links must take precedence over the temporary-password gate.
        // The recovery form completes both the Auth password update and the admin-managed flag.
        if (params.get('flow') === 'password-reset') {
          window.location.replace('/reset-password')
          return
        }
        // Admin-provisioned accounts must set a permanent password before workspace access.
        if (data.session.user.app_metadata?.must_change_password === true) {
          window.location.replace('/first-login-password')
          return
        }
        // New Google identities must complete role-specific onboarding before any workspace is created.
        if (data.session.user.app_metadata?.provider === 'google') {
          const existingMembership = await supabase.from('organization_memberships').select('organization_id').eq('user_id', data.session.user.id).limit(1).maybeSingle()
          if (existingMembership.error) throw existingMembership.error
          const metadata = data.session.user.user_metadata ?? {}
          const pendingRole = sessionStorage.getItem('mycar_google_pending_role')
          const allowedRoles = ['individual_owner', 'company', 'fleet_supplier', 'employee']
          // Employee accounts are independent profiles and can be linked to a company later.
          // The employee onboarding form does not create an organization workspace.
          if (!existingMembership.data && Number(metadata.onboarding_version || 0) < 2) {
            if (pendingRole && allowedRoles.includes(pendingRole)) {
              window.location.replace('/complete-profile?role=' + encodeURIComponent(pendingRole))
              return
            }
            // A first-time Google login may start from the sign-in dialog, without a role selected.
            // Keep the Google session and send the user to the in-app role chooser instead of failing.
            sessionStorage.setItem('mycar_google_needs_role', '1')
            window.location.replace('/register?google=1')
            return
          }
        }
        const invitationId = params.get('invitation')
        if (invitationId) {
          const { error: acceptError } = await supabase.rpc('company_accept_invitation', { p_invitation_id: invitationId })
          if (acceptError) throw new Error('تم تأكيد الحساب، لكن تعذر قبول دعوة الشركة: ' + acceptError.message)
          if (!active) return
          setMessage('تم قبول الدعوة بنجاح. جارٍ فتح مساحة الشركة...')
          window.location.replace('/workspace/company')
          return
        }
        const role = await finishAccount(data.session.user)
        if (role === 'fleet_supplier' && sessionStorage.getItem('mycar_supplier_google_welcome_pending') === '1') {
          localStorage.setItem('mycar_supplier_welcome_pending_' + data.session.user.id, '1')
        }
        sessionStorage.removeItem('mycar_supplier_google_welcome_pending')
        sessionStorage.removeItem('mycar_google_pending_role')
        if (!active) return
        // Send every newly registered or authenticated user straight to their own workspace.
        const { data: adminRecord } = await supabase.from('platform_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle()
        if (!active) return
        const destination = adminRecord
          ? '/workspace/admin'
          : role === 'company' ? '/workspace/company'
          : role === 'fleet_supplier' ? '/workspace/supplier'
          : role === 'employee' ? '/workspace/employee'
          : '/workspace/owner/vehicles'
        setMessage(adminRecord
          ? 'تم تأكيد الحساب بنجاح. جارٍ فتح لوحة الإدارة...'
          : 'تم تجهيز حسابك بنجاح. جارٍ فتح مساحة العمل الخاصة بك...')
        window.location.replace(destination)
      } catch (caught) {
        if (!active) return
        const detail = caught && typeof caught === 'object' && 'message' in caught
          ? String((caught as { message?: unknown }).message || '')
          : String(caught || '')
        // Supabase rejects banned users before issuing a session, so no organization lookup is possible.
        // Treat the explicit auth ban as a temporary account suspension and show the support route.
        if (/user is banned|user banned|banned/i.test(detail)) {
          setAccountSuspended(true)
          setError('')
          setMessage('')
          return
        }
        setError(detail || 'تعذر تأكيد البريد الإلكتروني. افتح أحدث رسالة تأكيد أو اطلب رابطًا جديدًا.')
        setMessage('')
      }
    }
    void complete()
    return () => { active = false }
  }, [])

  return accountSuspended ? (
    <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f2f6fb] px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl"/>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl"/>
      <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,39,67,.12)]">
        <div className="h-2 bg-gradient-to-l from-amber-400 via-orange-400 to-[#173f68]"/>
        <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
          <div className="mb-7 flex justify-center"><PlatformBrand /></div>
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] border border-amber-200 bg-amber-50 text-amber-600 shadow-inner"><ShieldAlert size={38}/></span>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-800"><Clock3 size={15}/> حالة الحساب · إيقاف مؤقت</span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#102b47] sm:text-3xl">حسابك موقوف مؤقتًا</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-slate-600">تم إيقاف الوصول إلى مساحة العمل الخاصة بحسابك مؤقتًا. يمكنك إرسال طلب مراجعة مباشر دون الحاجة إلى تسجيل الدخول.</p>
          {!reviewReference ? <div className="mt-6 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-right">
            <div><p className="text-sm font-extrabold text-[#173b61]">مراجعة حالة الحساب</p><p className="mt-1 text-sm leading-7 text-slate-600">{reviewEmail ? 'سيتم ربط الطلب تلقائيًا بالبريد الذي استخدمته في تسجيل الدخول.' : 'أدخل البريد الإلكتروني المرتبط بالحساب الموقوف لإرسال الطلب مباشرة.'}</p></div>
            <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني للحساب الموقوف<input type="email" required autoComplete="email" dir="ltr" value={reviewEmail} onChange={event=>setReviewEmail(event.target.value)} placeholder="name@example.com" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-left font-normal outline-none focus:border-blue-400"/></label>
            {reviewError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{reviewError}</p>}
            <button type="button" onClick={()=>void submitReviewRequest()} disabled={reviewSending || !supabase} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#123b63] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#1a5689] disabled:cursor-not-allowed disabled:opacity-60">{reviewSending ? <><LoaderCircle size={18} className="animate-spin"/> جارٍ إرسال طلبك...</> : <><Send size={18}/> إرسال طلب للمراجعة</>}</button>
          </div> : <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-emerald-600 shadow-sm"><CheckCircle2 size={28}/></span><h2 className="mt-3 text-lg font-black text-emerald-900">تم إرسال طلبك للمراجعة بنجاح</h2><p className="mt-2 text-sm leading-7 text-emerald-800">هيتم مراجعة حالتك والعمل على حلها خلال 48 ساعة عمل.</p>{reviewReference && <p className="mt-3 text-xs font-bold text-emerald-900">رقم الطلب: <b dir="ltr">{reviewReference}</b></p>}</div>}
          <p className="mt-5 text-xs leading-6 text-slate-400">لن تحتاج إلى تسجيل الدخول لإرسال الطلب. سيتم إخطار فريق الإدارة به لمراجعته.</p>
        </div>
      </section>
    </main>
  ) : error ? (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <section className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-sm sm:p-10">
        <div className="mb-6 flex justify-center"><PlatformBrand /></div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert size={28}/></span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">تعذر تأكيد البريد</h1>
        <p role="alert" className="mt-4 break-words text-sm leading-7 text-red-700">{error}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="/register" className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">العودة للتسجيل</a>
          <a href="/?login=1" className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700">تسجيل الدخول</a>
        </div>
      </section>
    </main>
  ) : <PlatformLoading />
}
