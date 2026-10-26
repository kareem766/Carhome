import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BellRing, CheckCircle2, Send, Users } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import { supabase } from '../lib/supabase'

type Recipient = { user_id: string; label: string; role: string }
type Notification = { id: string; user_id: string; title: string; body: string; notification_type: string; action_url: string | null; read_at: string | null; created_at: string }
const roleLabels: Record<string,string> = { individual_owner:'مالك سيارة', company:'شركة', fleet_supplier:'مورد أسطول' }

export default function AccountNotificationsAdminPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [history, setHistory] = useState<Notification[]>([])
  const [target, setTarget] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('general')
  const [actionUrl, setActionUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    if (!supabase) { setError('إعدادات قاعدة البيانات غير مكتملة.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { window.location.replace('/?login=1'); return }
    const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
    if (adminError || !admin) { setAuthorized(false); setError(adminError?.message || 'هذه الصفحة مخصصة لصاحب المنصة فقط.'); setLoading(false); return }
    setAuthorized(true)
    const [membershipResult, profileResult, historyResult] = await Promise.all([
      supabase.from('organization_memberships').select('user_id,organization_id,organizations(name,organization_type)'),
      supabase.from('profiles').select('id,display_name'),
      supabase.from('platform_notifications').select('id,user_id,title,body,notification_type,action_url,read_at,created_at').order('created_at',{ascending:false}).limit(50)
    ])
    if (membershipResult.error) setError('تعذر تحميل الحسابات المستهدفة: ' + membershipResult.error.message)
    if (historyResult.error) setError('تعذر تحميل سجل الإشعارات: ' + historyResult.error.message)
    const names = new Map<string,string>((profileResult.data || []).map((profile: any) => [profile.id, profile.display_name || 'مستخدم']))
    const map = new Map<string,Recipient>()
    for (const row of membershipResult.data || []) {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
      if (!row.user_id) continue
      const role = String(org?.organization_type || '')
      map.set(row.user_id, { user_id: row.user_id, label: names.get(row.user_id) || org?.name || 'حساب مستخدم', role })
    }
    setRecipients(Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label,'ar')))
    setHistory((historyResult.data || []) as Notification[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const targetRecipients = useMemo(() => {
    if (target === 'all') return recipients
    if (target === 'individual_owner' || target === 'company' || target === 'fleet_supplier') return recipients.filter(row => row.role === target)
    return recipients.filter(row => row.user_id === target)
  }, [recipients,target])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (!title.trim()) { setError('اكتب عنوان الإشعار.'); return }
    if (!targetRecipients.length) { setError('لا توجد حسابات مطابقة للمستهدف المحدد.'); return }
    setSending(true); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const rows = targetRecipients.map(recipient => ({
      user_id: recipient.user_id, title: title.trim(), body: body.trim(),
      notification_type: type, action_url: actionUrl.trim() || null, created_by: auth.user?.id || null
    }))
    const result = await supabase.from('platform_notifications').insert(rows)
    if (result.error) setError('تعذر إرسال الإشعار: ' + result.error.message)
    else { setNotice(`تم إرسال الإشعار إلى ${targetRecipients.length} حساب.`); setTitle(''); setBody(''); setActionUrl(''); await load() }
    setSending(false)
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white/90"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><PlatformBrand/><a href="/workspace/admin/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 px-3 text-sm font-bold text-blue-800"><ArrowLeft size={16}/> لوحة التحكم</a></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-l from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-xl sm:p-8"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold"><BellRing size={15}/> تواصل مباشر داخل المنصة</span><h1 className="mt-4 text-3xl font-black">إدارة إشعارات الحسابات</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">أرسل تنبيهات داخلية لجميع الحسابات أو حسب نوع الحساب أو إلى حساب محدد. تظهر الإشعارات في جرس الحساب ويمكن فتح الرابط المرتبط بها.</p></section>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</p>}
      {!authorized && !loading ? <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">لا تتوفر صلاحية الوصول لهذه الصفحة.</p> : <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={send} className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Send size={21}/></span><div><h2 className="text-xl font-black">إنشاء إشعار</h2><p className="mt-1 text-xs text-slate-500">عدد الحسابات المستهدفة: {targetRecipients.length}</p></div></div>
          <label className="mt-5 block text-sm font-bold">إرسال إلى
            <select value={target} onChange={e=>setTarget(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3">
              <option value="all">جميع الحسابات ({recipients.length})</option>
              <option value="individual_owner">ملاك السيارات ({recipients.filter(r=>r.role==='individual_owner').length})</option>
              <option value="company">الشركات ({recipients.filter(r=>r.role==='company').length})</option>
              <option value="fleet_supplier">موردو الأساطيل ({recipients.filter(r=>r.role==='fleet_supplier').length})</option>
              <optgroup label="حساب محدد">{recipients.map(r=><option key={r.user_id} value={r.user_id}>{r.label} — {roleLabels[r.role] || 'حساب'}</option>)}</optgroup>
            </select>
          </label>
          <label className="mt-4 block text-sm font-bold">عنوان الإشعار<input required value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="مثال: تم اعتماد سيارتك"/></label>
          <label className="mt-4 block text-sm font-bold">تفاصيل الإشعار<textarea rows={4} value={body} onChange={e=>setBody(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3" placeholder="اكتب تفاصيل واضحة ومختصرة"/></label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">نوع الإشعار<select value={type} onChange={e=>setType(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3">{[['general','عام'],['account','الحساب'],['vehicle','السيارات'],['payment','المدفوعات والتحويلات'],['request','طلبات التأجير'],['message','الرسائل'],['subscription','الاشتراكات'],['promotion','الإعلانات'],['system','النظام']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="block text-sm font-bold">رابط اختياري<input value={actionUrl} onChange={e=>setActionUrl(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="/workspace/catalog" dir="ltr"/></label></div>
          <button disabled={sending || loading || !authorized} className="mc-neon-button mc-neon-primary mt-6 w-full justify-center"><Send size={17}/>{sending ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}</button>
        </form>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">سجل الإشعارات الأخيرة</h2><p className="mt-1 text-sm text-slate-500">آخر 50 إشعارًا مسجلًا.</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Users size={20}/></span></div>
          {loading ? <p className="mt-5 text-sm text-slate-500">جارٍ التحميل...</p> : history.length===0 ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">لا توجد إشعارات مرسلة حتى الآن.</p> : <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto">{history.map(item=><article key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.read_at?'bg-slate-100 text-slate-500':'bg-blue-50 text-blue-700'}`}>{item.read_at?'مقروء':'جديد'}</span></div><p className="mt-2 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString('ar-EG')}</p></article>)}</div>}
        </section>
      </div>}
    </div>
  </main>
}
