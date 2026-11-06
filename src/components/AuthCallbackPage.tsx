import { useEffect, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
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
          const allowedRoles = ['individual_owner', 'company', 'fleet_supplier']
          // Employees belong to an existing company; they must be provisioned/invited by that company first.
          // Never create a standalone employee workspace from a fresh Google identity.
          if (!existingMembership.data && pendingRole === 'employee') {
            throw new Error('حساب الموظف يتم إنشاؤه أو دعوته من خلال الشركة أولًا. اطلب من مسؤول الشركة إضافتك، ثم سجّل الدخول باستخدام Google بنفس البريد الإلكتروني المسجل لدى الشركة.')
          }
          if (!existingMembership.data && Number(metadata.onboarding_version || 0) < 2) {
            if (pendingRole && allowedRoles.includes(pendingRole)) {
              window.location.replace('/complete-profile?role=' + encodeURIComponent(pendingRole))
              return
            }
            throw new Error('اختر نوع الحساب من صفحة التسجيل قبل المتابعة باستخدام Google.')
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
        if (!active) return
        // Send every newly registered or authenticated user straight to their own workspace.
        const { data: adminRecord } = await supabase.from('platform_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle()
        if (!active) return
        const destination = adminRecord
          ? '/workspace/admin'
          : role === 'company' ? '/workspace/company'
          : role === 'fleet_supplier' ? '/workspace/supplier'
          : role === 'employee' ? '/workspace/employee'
          : '/workspace/owner'
        setMessage(adminRecord
          ? 'تم تأكيد الحساب بنجاح. جارٍ فتح لوحة الإدارة...'
          : 'تم تجهيز حسابك بنجاح. جارٍ فتح مساحة العمل الخاصة بك...')
        window.location.replace(destination)
      } catch (caught) {
        if (!active) return
        const detail = caught && typeof caught === 'object' && 'message' in caught
          ? String((caught as { message?: unknown }).message || '')
          : String(caught || '')
        setError(detail || 'تعذر تأكيد البريد الإلكتروني. افتح أحدث رسالة تأكيد أو اطلب رابطًا جديدًا.')
        setMessage('')
      }
    }
    void complete()
    return () => { active = false }
  }, [])

  return error ? (
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
