import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type Submission = {
  id: string
  provider_name: string
  category: string
  governorate: string
  address: string
  contact_name: string
  phone: string
  email: string | null
  website_url: string | null
  official_source_url: string | null
  description: string | null
  submitted_by: string | null
  status: 'pending_review' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
}

const categoryLabels: Record<string, string> = {
  maintenance: 'الصيانة ومراكز الخدمة',
  insurance: 'التأمين',
  spare_parts: 'قطع الغيار',
  fleet_services: 'خدمات الأساطيل',
  roadside: 'المساعدة على الطريق',
  inspection: 'الفحص الفني',
  other: 'خدمات أخرى',
}

const statusLabels: Record<Submission['status'], string> = {
  pending_review: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
}

export default function AdminServiceProviderReviewsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Submission[]>([])
  const [filter, setFilter] = useState<'all' | Submission['status']>('pending_review')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    if (!supabase) { window.location.replace('/?login=1'); return }
    setLoading(true)
    setError('')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { window.location.replace('/?login=1'); return }
    const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (adminError || !admin) {
      setAuthorized(false)
      setError(adminError?.message || 'هذا الحساب غير مصرح له بمراجعة مقدمي الخدمات.')
      setLoading(false)
      return
    }
    setAuthorized(true)
    const { data, error: listError } = await supabase.from('service_provider_submissions').select('id,provider_name,category,governorate,address,contact_name,phone,email,website_url,official_source_url,description,submitted_by,status,admin_notes,created_at').order('created_at', { ascending: false })
    if (listError) setError('تعذر تحميل طلبات مقدمي الخدمات: ' + listError.message)
    else {
      const items = (data || []) as Submission[]
      setRows(items)
      setNotes(Object.fromEntries(items.map(item => [item.id, item.admin_notes || ''])))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const visibleRows = useMemo(() => filter === 'all' ? rows : rows.filter(row => row.status === filter), [rows, filter])
  const pendingCount = rows.filter(row => row.status === 'pending_review').length

  async function review(row: Submission, status: 'approved' | 'rejected') {
    if (!supabase || busyId) return
    const action = status === 'approved' ? 'اعتماد' : 'رفض'
    if (!window.confirm('تأكيد ' + action + ' طلب ' + row.provider_name + '؟')) return
    setBusyId(row.id)
    setError('')
    setNotice('')
    const { data: { user } } = await supabase.auth.getUser()
    const adminNotes = (notes[row.id] || '').trim() || null
    const { data: updatedRow, error: updateError } = await supabase.from('service_provider_submissions').update({
      status,
      admin_notes: adminNotes,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', row.id).eq('status', 'pending_review').select('id').maybeSingle()
    if (updateError || !updatedRow) {
      setError(updateError ? 'تعذر تحديث حالة الطلب: ' + updateError.message : 'تمت مراجعة الطلب بالفعل من مسؤول آخر. حدّث القائمة.')
      setBusyId('')
      return
    }
    let notificationWarning = ''
    if (row.submitted_by) {
      const { error: notificationError } = await supabase.from('platform_notifications').insert({
        user_id: row.submitted_by,
        title: status === 'approved' ? 'تم اعتماد طلب مقدم الخدمة' : 'تم تحديث طلب مقدم الخدمة',
        body: status === 'approved'
          ? 'تم اعتماد طلب ' + row.provider_name + '. ستتم مراجعة بيانات النشر قبل إتاحته في دليل الخدمات.'
          : 'لم تتم الموافقة على طلب ' + row.provider_name + '. يمكنك مراجعة ملاحظات الإدارة أو التواصل مع الدعم.',
        notification_type: 'system',
        action_url: '/services',
        created_by: user?.id || null,
      })
      if (notificationError) notificationWarning = ' تعذر إرسال إشعار لصاحب الطلب: ' + notificationError.message
    }
    setNotice('تم ' + action + ' الطلب بنجاح.' + notificationWarning)
    setBusyId('')
    await load()
  }

  return <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <AdminPageNavigation />
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <div><PlatformBrand /><p className="mt-2 text-sm font-bold text-slate-500">مراجعة طلبات مقدمي الخدمات</p></div>
        <div className="flex items-center gap-2"><AccountNotifications /><button onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold"><RefreshCw size={16}/> تحديث</button></div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-7 lg:px-6">
      <section className="rounded-3xl bg-gradient-to-l from-[#102b47] to-blue-800 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-cyan-200"><ShieldCheck size={18}/> مركز اعتماد مقدمي الخدمات</div><h1 className="mt-2 text-2xl font-black">طلبات تسجيل مقدمي الخدمات</h1><p className="mt-2 text-sm leading-7 text-blue-100">راجع بيانات الجهة ومصدرها الرسمي قبل اعتماد الطلب. الاعتماد هنا لا ينشر جهة تلقائيًا في الدليل العام.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center"><strong className="block text-3xl">{pendingCount.toLocaleString('ar-EG')}</strong><span className="text-xs text-blue-100">طلبات تنتظر المراجعة</span></div></div>
      </section>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}
      <section className="flex flex-wrap gap-2">
        {([{id:'pending_review',label:'قيد المراجعة'},{id:'approved',label:'معتمد'},{id:'rejected',label:'مرفوض'},{id:'all',label:'كل الطلبات'}] as const).map(item => <button key={item.id} onClick={() => setFilter(item.id)} className={'rounded-xl px-4 py-2.5 text-sm font-extrabold ' + (filter === item.id ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{item.label} ({item.id === 'all' ? rows.length : rows.filter(row => row.status === item.id).length})</button>)}
      </section>
      {!authorized && !loading ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-900">تعذر التحقق من صلاحية الإدارة.</div> : loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل الطلبات...</div> : visibleRows.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={32}/><h2 className="mt-3 font-black">لا توجد طلبات في هذا التصنيف</h2><p className="mt-1 text-sm text-slate-500">ستظهر هنا طلبات تسجيل مقدمي الخدمات الجديدة.</p></div> : <div className="grid gap-4">{visibleRows.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{row.provider_name}</h2><span className={'rounded-full px-3 py-1 text-xs font-extrabold ' + (row.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : row.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')}>{statusLabels[row.status]}</span></div><p className="mt-1 text-sm text-slate-500">{categoryLabels[row.category] || row.category} · {row.governorate} · {new Date(row.created_at).toLocaleString('ar-EG')}</p></div><span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">طلب خدمة</span></div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><span className="text-slate-500">مسؤول التواصل</span><p className="font-bold">{row.contact_name}</p></div><div><span className="text-slate-500">الهاتف</span><p dir="ltr" className="text-right font-bold">{row.phone}</p></div><div><span className="text-slate-500">البريد</span><p className="font-bold">{row.email || 'غير محدد'}</p></div><div><span className="text-slate-500">العنوان</span><p className="font-bold">{row.address}</p></div><div><span className="text-slate-500">الموقع الإلكتروني</span>{row.website_url ? <a href={row.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-blue-700">فتح الموقع <ExternalLink size={13}/></a> : <p>غير محدد</p>}</div><div><span className="text-slate-500">المصدر الرسمي</span>{row.official_source_url ? <a href={row.official_source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-blue-700">التحقق من المصدر <ExternalLink size={13}/></a> : <p className="font-bold text-amber-700">لم يتم تقديم مصدر رسمي</p>}</div></div>
        {row.description && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700">{row.description}</p>}
        <label className="mt-4 block text-sm font-extrabold">ملاحظات الإدارة<textarea value={notes[row.id] || ''} onChange={event => setNotes(current => ({...current,[row.id]:event.target.value}))} rows={2} maxLength={1000} disabled={row.status !== 'pending_review'} placeholder="أضف ملاحظات لصاحب الطلب (اختياري)" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"/></label>
        {row.status === 'pending_review' && <div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(busyId)} onClick={() => void review(row,'approved')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-extrabold text-white disabled:opacity-50"><CheckCircle2 size={17}/>{busyId === row.id ? 'جارٍ الحفظ...' : 'اعتماد الطلب'}</button><button disabled={Boolean(busyId)} onClick={() => void review(row,'rejected')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 font-extrabold text-red-700 disabled:opacity-50"><XCircle size={17}/>رفض الطلب</button></div>}
      </article>)}</div>}
    </main>
  </div>
}
