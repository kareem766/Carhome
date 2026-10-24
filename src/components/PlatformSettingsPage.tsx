import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowRight, ImagePlus, LoaderCircle, Save, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type PlatformSettings = {
  id: boolean
  platform_name: string
  tagline: string
  description: string
  logo_url: string | null
  favicon_url: string | null
  support_email: string | null
  support_phone: string | null
  website_url: string | null
  address: string | null
  footer_text: string
  announcement_text: string | null
  primary_color: string
  secondary_color: string
  registration_enabled: boolean
  owner_registration_enabled: boolean
  company_registration_enabled: boolean
  supplier_registration_enabled: boolean
  maintenance_mode: boolean
}
const defaults: PlatformSettings = {
  id: true, platform_name: 'Carhome', tagline: 'تأجير السيارات للشركات',
  description: 'منصة تجمع الشركات وملاك السيارات وموردي الأساطيل لتسهيل التأجير طويل الأجل.',
  logo_url: null, favicon_url: null, support_email: '', support_phone: '', website_url: '', address: '',
  footer_text: 'جميع الحقوق محفوظة.', announcement_text: '', primary_color: '#1d4ed8',
  secondary_color: '#0f172a', registration_enabled: true, owner_registration_enabled: true,
  company_registration_enabled: true, supplier_registration_enabled: true, maintenance_mode: false
}
const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
const labelClass = 'block text-sm font-bold text-slate-700'

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(defaults)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo_url' | 'favicon_url' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { if (active) { setError('إعدادات الاتصال بقاعدة البيانات غير مكتملة.'); setLoading(false) } return }
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) { window.location.replace('/?login=1'); return }
      const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
      if (!active) return
      if (adminError || !admin) { setError(adminError?.message || 'هذه الصفحة متاحة لصاحب المنصة فقط.'); setLoading(false); return }
      setAuthorized(true)
      const { data, error: settingsError } = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle()
      if (!active) return
      if (settingsError) setError('تعذر تحميل إعدادات المنصة. تأكد من تطبيق Migration إعدادات المنصة. ' + settingsError.message)
      else if (data) setSettings({ ...defaults, ...data } as PlatformSettings)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'favicon_url') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supabase) return
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']
    if (!allowed.includes(file.type)) { setError('صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP أو SVG أو ICO.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('حجم الصورة يجب ألا يتجاوز 2 ميجابايت.'); return }
    setUploading(field); setError(''); setNotice('')
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = field === 'logo_url' ? `branding/logo-${Date.now()}.${extension}` : `branding/favicon-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('platform-assets').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) { setError('تعذر رفع الصورة: ' + uploadError.message); setUploading(null); return }
    const { data } = supabase.storage.from('platform-assets').getPublicUrl(path)
    setSettings(current => ({ ...current, [field]: data.publicUrl }))
    setUploading(null)
    setNotice(field === 'logo_url' ? 'تم رفع الشعار. اضغط حفظ التعديلات لتفعيله.' : 'تم رفع الأيقونة. اضغط حفظ التعديلات لتفعيلها.')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !authorized) return
    if (!settings.platform_name.trim() || !settings.tagline.trim()) { setError('اسم المنصة والوصف المختصر مطلوبان.'); return }
    setSaving(true); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const payload = {
      platform_name: settings.platform_name.trim(), tagline: settings.tagline.trim(),
      description: settings.description.trim(), logo_url: settings.logo_url || null,
      favicon_url: settings.favicon_url || null, support_email: settings.support_email?.trim() || null,
      support_phone: settings.support_phone?.trim() || null, website_url: settings.website_url?.trim() || null,
      address: settings.address?.trim() || null, footer_text: settings.footer_text.trim(),
      announcement_text: settings.announcement_text?.trim() || null,
      primary_color: settings.primary_color, secondary_color: settings.secondary_color,
      registration_enabled: settings.registration_enabled,
      owner_registration_enabled: settings.owner_registration_enabled,
      company_registration_enabled: settings.company_registration_enabled,
      supplier_registration_enabled: settings.supplier_registration_enabled,
      maintenance_mode: settings.maintenance_mode, updated_at: new Date().toISOString(),
      updated_by: auth.user?.id || null
    }
    const { error: saveError } = await supabase.from('platform_settings').update(payload).eq('id', true)
    setSaving(false)
    if (saveError) { setError('تعذر حفظ الإعدادات: ' + saveError.message); return }
    setNotice('تم حفظ إعدادات المنصة بنجاح. ستظهر التعديلات العامة بعد تحديث الصفحة.')
  }

  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings(current => ({ ...current, [key]: value }))
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5">
        <div><p className="text-sm font-bold text-blue-700">Carhome · لوحة صاحب المنصة</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">هوية المنصة وإعداداتها العامة</h1><p className="mt-2 text-sm leading-6 text-slate-500">تعديل الاسم والشعار ومعلومات التواصل ومظهر المنصة وخيارات التسجيل من مكان واحد.</p></div>
        <a href="/workspace/admin" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><ArrowRight size={17}/> العودة للوحة الإدارة</a>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
      {loading ? <div className="flex justify-center py-16 text-slate-500"><LoaderCircle className="animate-spin"/> جارٍ تحميل الإعدادات...</div> : authorized && <form onSubmit={save} className="mt-6 space-y-5">
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">اسم المنصة وهويتها</h2>
          <p className="mt-1 text-sm text-slate-500">يتم عرض هذه البيانات في الواجهة العامة وعنوان المنصة وبيانات التذييل.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>اسم المنصة *<input required maxLength={100} value={settings.platform_name} onChange={e=>update('platform_name',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass}>الوصف المختصر *<input required maxLength={180} value={settings.tagline} onChange={e=>update('tagline',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass+' sm:col-span-2'}>وصف المنصة<textarea maxLength={1200} rows={3} value={settings.description} onChange={e=>update('description',e.target.value)} className={fieldClass}/></label>
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-3">{settings.logo_url ? <img src={settings.logo_url} alt="شعار المنصة" className="h-16 w-16 rounded-xl border object-contain"/> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-blue-50 text-blue-700"><ImagePlus/></span>}<div><p className="font-bold">شعار المنصة</p><p className="mt-1 text-xs text-slate-500">PNG / JPG / WebP / SVG · حتى 2MB</p></div></div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><ImagePlus size={16}/>{uploading === 'logo_url' ? 'جارٍ الرفع...' : 'رفع شعار'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={Boolean(uploading)} onChange={e=>void uploadAsset(e,'logo_url')} className="sr-only"/></label>
              {settings.logo_url && <button type="button" onClick={()=>update('logo_url',null)} className="mr-2 rounded-lg border px-3 py-2 text-sm font-bold text-red-700">إزالة الشعار</button>}
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-3">{settings.favicon_url ? <img src={settings.favicon_url} alt="أيقونة المتصفح" className="h-12 w-12 rounded-xl border object-contain"/> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100"><ImagePlus/></span>}<div><p className="font-bold">أيقونة المتصفح</p><p className="mt-1 text-xs text-slate-500">اختياري · حتى 2MB</p></div></div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><ImagePlus size={16}/>{uploading === 'favicon_url' ? 'جارٍ الرفع...' : 'رفع أيقونة'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" disabled={Boolean(uploading)} onChange={e=>void uploadAsset(e,'favicon_url')} className="sr-only"/></label>
              {settings.favicon_url && <button type="button" onClick={()=>update('favicon_url',null)} className="mr-2 rounded-lg border px-3 py-2 text-sm font-bold text-red-700">إزالة الأيقونة</button>}
            </div>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">معلومات التواصل الرسمية</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>بريد الدعم<input type="email" maxLength={254} value={settings.support_email || ''} onChange={e=>update('support_email',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass}>هاتف الدعم<input maxLength={40} value={settings.support_phone || ''} onChange={e=>update('support_phone',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass}>الموقع الإلكتروني<input type="url" maxLength={500} placeholder="https://example.com" value={settings.website_url || ''} onChange={e=>update('website_url',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass}>العنوان<input maxLength={300} value={settings.address || ''} onChange={e=>update('address',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass+' sm:col-span-2'}>نص التذييل وحقوق النشر<input maxLength={300} value={settings.footer_text} onChange={e=>update('footer_text',e.target.value)} className={fieldClass}/></label>
            <label className={labelClass+' sm:col-span-2'}>إعلان عام أعلى الموقع (اختياري)<textarea maxLength={500} rows={2} value={settings.announcement_text || ''} onChange={e=>update('announcement_text',e.target.value)} className={fieldClass}/></label>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">المظهر وإتاحة التسجيل</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>اللون الأساسي<div className="mt-2 flex items-center gap-3"><input type="color" value={settings.primary_color} onChange={e=>update('primary_color',e.target.value)} className="h-12 w-16 cursor-pointer rounded-lg border p-1"/><code>{settings.primary_color}</code></div></label>
            <label className={labelClass}>اللون الثانوي<div className="mt-2 flex items-center gap-3"><input type="color" value={settings.secondary_color} onChange={e=>update('secondary_color',e.target.value)} className="h-12 w-16 cursor-pointer rounded-lg border p-1"/><code>{settings.secondary_color}</code></div></label>
            {([
              ['registration_enabled','السماح بإنشاء حسابات جديدة'],
              ['owner_registration_enabled','تسجيل ملاك السيارات'],
              ['company_registration_enabled','تسجيل الشركات'],
              ['supplier_registration_enabled','تسجيل موردي الأساطيل'],
              ['maintenance_mode','وضع الصيانة (إيقاف الواجهة العامة)']
            ] as const).map(([key,label])=><label key={key} className="flex items-center gap-3 rounded-xl border p-4 text-sm font-bold"><input type="checkbox" checked={settings[key]} onChange={e=>update(key,e.target.checked)} className="h-4 w-4"/>{label}</label>)}
            <p className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"><ShieldCheck className="ml-1 inline" size={15}/> تؤثر هذه الخيارات على مسارات التسجيل والواجهة العامة فقط؛ وتظل لوحة صاحب المنصة متاحة لإعادة تشغيل الخدمة، ولا تُحذف الحسابات القائمة.</p>
          </div>
        </section>
        <div className="sticky bottom-3 flex justify-end rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><button disabled={saving || Boolean(uploading)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-50"><Save size={18}/>{saving ? 'جارٍ الحفظ...' : 'حفظ كل التعديلات'}</button></div>
      </form>}
    </div>
  </main>
}
