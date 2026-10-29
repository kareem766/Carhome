import { useEffect, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import type { EmailOtpType, User } from '@supabase/supabase-js'

type AccountRole = 'individual_owner' | 'fleet_supplier' | 'company'

function workspaceFor(role: unknown) {
  // Send each newly verified user directly to the correct role-specific starting point.
  // Companies start at their request dashboard; owners and fleet suppliers start at vehicle management.
  if (role === 'company') return '/workspace/company'
  if (role === 'fleet_supplier') return '/workspace/supplier/vehicles'
  return '/workspace/owner/vehicles'
}

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
  const role = (['individual_owner', 'fleet_supplier', 'company'].includes(String(metadata.organization_type))
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadLogo() {
      if (!supabase) return
      const { data } = await supabase.from('platform_settings').select('logo_url').eq('id', true).maybeSingle()
      if (active && data?.logo_url) setLogoUrl(data.logo_url)
    }
    void loadLogo()
    return () => { active = false }
  }, [])

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
        // A recovery link must always land on the dedicated password form.
        // Never route a recovery session directly into the user's workspace.
        if (params.get('flow') === 'password-reset') {
          window.location.replace('/reset-password')
          return
        }
        await finishAccount(data.session.user)
        if (!active) return
        // Platform-owner accounts must land in the admin console instead of a regular workspace.
        const { data: adminRecord } = await supabase.from('platform_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle()
        if (!active) return
        if (!adminRecord) localStorage.setItem('mycar_welcome_banner', '1')
        setMessage(adminRecord
          ? 'تم تأكيد الحساب بنجاح. جارٍ فتح لوحة الإدارة...'
          : 'تم تأكيد بريدك بنجاح! أهلًا بك في My Car، يمكنك الآن استكشاف المنصة والانتقال إلى مساحة عملك وقتما تريد.')
        // Keep the first post-confirmation visit simple: return regular users to the homepage.
        // The homepage remains available, and the authenticated navigation offers their workspace.
        window.setTimeout(() => { if (active) window.location.replace(adminRecord ? '/workspace/admin' : '/') }, adminRecord ? 900 : 1800)
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

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_48%),#f8fafc] px-5 text-slate-600">
    {error ? <section className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-sm sm:p-10"><div className="mb-6 flex justify-center"><PlatformBrand /></div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert size={28}/></span><h1 className="mt-5 text-2xl font-extrabold text-slate-950">تعذر تأكيد البريد</h1><p role="alert" className="mt-4 break-words text-sm leading-7 text-red-700">{error}</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><a href="/register" className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">العودة للتسجيل</a><a href="/?login=1" className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700">تسجيل الدخول</a></div></section> : <div className="flex flex-col items-center gap-4" role="status" aria-label="جارٍ تحميل المنصة">
      <div className="relative grid h-28 w-28 place-items-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full border-[4px] border-orange-100 shadow-[0_0_35px_rgba(249,115,22,0.16)]" />
        <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[4px] border-transparent border-t-orange-500 border-l-amber-400" />
        <span aria-hidden="true" className="absolute inset-2 animate-pulse rounded-full bg-orange-500/10" />
        <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center overflow-hidden rounded-full border-2 border-orange-400 bg-white shadow-[0_0_22px_rgba(249,115,22,0.25)]">
          {logoUrl ? <img src={logoUrl} alt="" className="h-14 w-14 object-contain" /> : <span aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />}
        </span>
      </div>
      <span aria-hidden="true" className="h-1 w-28 overflow-hidden rounded-full bg-orange-100"><span className="block h-full w-1/2 animate-pulse rounded-full bg-orange-500" /></span>
    </div>}
  </main>
}
