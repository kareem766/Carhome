import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, ImagePlus, Megaphone, Plus, Save, Trash2 } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

type Banner = { id: string; title: string; body: string; image_url: string | null; button_label: string | null; button_url: string | null; enabled: boolean; duration_seconds: number; starts_at: string | null; ends_at: string | null; display_order: number }
type Draft = Omit<Banner, 'id'> & { id?: string }
const emptyDraft: Draft = { title: '', body: '', image_url: '', button_label: '', button_url: '', enabled: false, duration_seconds: 5, starts_at: null, ends_at: null, display_order: 0 }
const inputClass = 'mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function localDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function PlatformBannersAdminPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    if (!supabase) { setError('إعدادات الاتصال بقاعدة البيانات غير مكتملة.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { window.location.replace('/?login=1'); return }
    const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
    if (adminError || !admin) { setAuthorized(false); setError(adminError?.message || 'هذه الصفحة مخصصة لصاحب المنصة فقط.'); setLoading(false); return }
    setAuthorized(true)
    const result = await supabase.from('platform_banners').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: false })
    if (result.error) setError('تعذر تحميل الإعلانات: ' + result.error.message)
    else setBanners((result.data || []) as Banner[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !draft) return
    if (!draft.title.trim() && !draft.image_url?.trim() && !draft.body.trim()) { setError('أضف عنوانًا أو صورة أو نصًا للإعلان.'); return }
    if (draft.starts_at && draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) { setError('وقت انتهاء الإعلان يجب أن يكون بعد وقت بدايته.'); return }
    setSaving(true); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const payload = {
      title: draft.title.trim(), body: draft.body.trim(), image_url: draft.image_url?.trim() || null,
      button_label: draft.button_label?.trim() || null, button_url: draft.button_url?.trim() || null,
      enabled: draft.enabled, duration_seconds: Math.max(1, Math.min(30, Number(draft.duration_seconds) || 5)),
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      display_order: Number(draft.display_order) || 0, updated_at: new Date().toISOString(), updated_by: auth.user?.id || null
    }
    const result = draft.id
      ? await supabase.from('platform_banners').update(payload).eq('id', draft.id)
      : await supabase.from('platform_banners').insert({ ...payload, created_by: auth.user?.id || null })
    if (result.error) setError('تعذر حفظ الإعلان: ' + result.error.message)
    else { setNotice('تم حفظ الإعلان. سيظهر للعملاء عند دخولهم التالي وفق حالة التفعيل والجدولة.'); setDraft(null); await load() }
    setSaving(false)
  }

  async function remove(banner: Banner) {
    if (!supabase || !window.confirm('هل تريد حذف هذا الإعلان نهائيًا؟')) return
    const result = await supabase.from('platform_banners').delete().eq('id', banner.id)
    if (result.error) setError('تعذر حذف الإعلان: ' + result.error.message)
    else { setNotice('تم حذف الإعلان.'); await load() }
  }

  function edit(banner?: Banner) {
    setError(''); setNotice('')
    setDraft(banner ? { ...banner, starts_at: localDateTime(banner.starts_at), ends_at: localDateTime(banner.ends_at) } : { ...emptyDraft })
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><PlatformBrand/><a href="/workspace/admin/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 px-3 text-sm font-bold text-blue-800"><ArrowLeft size={16}/> لوحة التحكم</a></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-l from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold"><Megaphone size={15}/> إدارة محتوى الظهور</span><h1 className="mt-4 text-3xl font-black">بانرات وإعلانات بداية الدخول</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">تحكم في صورة الإعلان ونصه والرابط ومدة ظهوره وتفعيله وجدولته. المدة الافتراضية 5 ثوانٍ.</p></div><button type="button" onClick={() => edit()} className="mc-neon-button mc-neon-primary"><Plus size={18}/> إنشاء إعلان جديد</button></div></section>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</p>}
      {draft && <form onSubmit={save} className="mt-6 rounded-3xl border border-blue-200 bg-white p-5 shadow-xl sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-black">{draft.id ? 'تعديل الإعلان' : 'إنشاء إعلان جديد'}</h2><button type="button" onClick={() => setDraft(null)} className="rounded-xl border px-3 py-2 text-sm font-bold">إلغاء</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">عنوان الإعلان<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className={inputClass} placeholder="مثال: عرض خاص للشركات"/></label>
          <label className="text-sm font-bold">رابط صورة الإعلان<input value={draft.image_url || ''} onChange={e=>setDraft({...draft,image_url:e.target.value})} className={inputClass} placeholder="https://..." dir="ltr"/></label>
          <label className="text-sm font-bold md:col-span-2">النص الترويجي<textarea rows={3} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} className={inputClass} placeholder="اكتب رسالة الإعلان للعملاء"/></label>
          <label className="text-sm font-bold">نص زر الإجراء<input value={draft.button_label || ''} onChange={e=>setDraft({...draft,button_label:e.target.value})} className={inputClass} placeholder="اكتشف العرض"/></label>
          <label className="text-sm font-bold">رابط زر الإجراء<input value={draft.button_url || ''} onChange={e=>setDraft({...draft,button_url:e.target.value})} className={inputClass} placeholder="/workspace/catalog أو https://..." dir="ltr"/></label>
          <label className="text-sm font-bold">مدة الظهور بالثواني (1–30)<input type="number" min={1} max={30} value={draft.duration_seconds} onChange={e=>setDraft({...draft,duration_seconds:Number(e.target.value)})} className={inputClass}/></label>
          <label className="text-sm font-bold">ترتيب الإعلان<input type="number" value={draft.display_order} onChange={e=>setDraft({...draft,display_order:Number(e.target.value)})} className={inputClass}/></label>
          <label className="text-sm font-bold">بداية العرض<input type="datetime-local" value={draft.starts_at || ''} onChange={e=>setDraft({...draft,starts_at:e.target.value || null})} className={inputClass}/><span className="mt-1 block text-xs font-normal text-slate-500">اتركه فارغًا ليبدأ فور التفعيل.</span></label>
          <label className="text-sm font-bold">نهاية العرض<input type="datetime-local" value={draft.ends_at || ''} onChange={e=>setDraft({...draft,ends_at:e.target.value || null})} className={inputClass}/><span className="mt-1 block text-xs font-normal text-slate-500">اتركه فارغًا ليظل الإعلان فعالًا حتى إيقافه.</span></label>
          <label className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-extrabold md:col-span-2"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})} className="h-4 w-4 accent-blue-700"/> تفعيل الإعلان وإظهاره للعملاء</label>
        </div>
        {draft.image_url && <div className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-slate-50 p-2"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500"><ImagePlus size={15}/> معاينة الصورة</div><img src={draft.image_url} alt="معاينة الإعلان" className="max-h-64 w-full rounded-xl object-cover" onError={e=>{e.currentTarget.style.display='none'}}/></div>}
        <button disabled={saving} className="mc-neon-button mc-neon-primary mt-6 w-full justify-center sm:w-auto"><Save size={17}/>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعلان'}</button>
      </form>}
      <div className="mt-6 flex items-center justify-between gap-3"><h2 className="text-xl font-black">الإعلانات المسجلة</h2><span className="text-sm font-bold text-slate-500">{banners.length} إعلان</span></div>
      {loading ? <p className="mt-4 rounded-2xl bg-white p-6 text-sm text-slate-500">جارٍ تحميل الإعلانات...</p> : !authorized ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">لا تتوفر صلاحية الوصول.</p> : banners.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-white p-8 text-center"><Megaphone className="mx-auto text-blue-600" size={32}/><p className="mt-3 font-extrabold">لا توجد إعلانات بعد</p><p className="mt-1 text-sm text-slate-500">أنشئ أول بانر ترويجي من الزر بالأعلى.</p></div> : <div className="mt-4 grid gap-4 lg:grid-cols-2">{banners.map(banner=><article key={banner.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{banner.image_url && <img src={banner.image_url} alt="" className="h-44 w-full object-cover" onError={e=>{e.currentTarget.style.display='none'}}/>}<div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{banner.title || 'إعلان بصورة فقط'}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{banner.body}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${banner.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{banner.enabled ? 'مفعّل' : 'متوقف'}</span></div><p className="mt-3 text-xs font-bold text-slate-500">المدة: {banner.duration_seconds} ث · الترتيب: {banner.display_order}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>edit(banner)} className="mc-neon-button"><Save size={15}/> تعديل</button><button type="button" onClick={async()=>{if(!supabase)return;const result=await supabase.from('platform_banners').update({enabled:!banner.enabled,updated_at:new Date().toISOString()}).eq('id',banner.id);if(result.error)setError(result.error.message);else await load()}} className="mc-neon-button">{banner.enabled ? <EyeOff size={15}/> : <Eye size={15}/>} {banner.enabled ? 'إيقاف' : 'تفعيل'}</button><button type="button" onClick={()=>void remove(banner)} className="mc-neon-button border-rose-200 text-rose-700"><Trash2 size={15}/> حذف</button></div></div></article>)}</div>}
    </div>
  </main>
}
