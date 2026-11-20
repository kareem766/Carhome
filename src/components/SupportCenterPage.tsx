import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Headset, MessageSquare, Plus, RefreshCw, Send, ShieldCheck, Ticket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import AdminPageNavigation from './AdminPageNavigation'

type TicketRow = {
  id: string
  ticket_number: number
  user_id: string
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  updated_at: string
}
type TicketMessage = { id: string; ticket_id: string; sender_user_id: string; body: string; created_at: string }
type PublicSupportRequest = { id: string; contact_name: string; contact_email: string; account_email: string; phone: string | null; subject: string; message: string; status: string; created_at: string }
type Props = { admin?: boolean }

const categories = [
  { value: 'general', label: 'استفسار عام' }, { value: 'account', label: 'الحساب والتسجيل' },
  { value: 'payment', label: 'المدفوعات والاشتراكات' }, { value: 'vehicle', label: 'السيارات والإعلانات' },
  { value: 'requests', label: 'الطلبات والعروض' }, { value: 'technical', label: 'مشكلة تقنية' },
  { value: 'suggestion', label: 'اقتراح أو تحسين' }, { value: 'other', label: 'أخرى' }
]
const statuses = [
  { value: 'open', label: 'مفتوحة' }, { value: 'in_progress', label: 'قيد المعالجة' },
  { value: 'waiting_user', label: 'بانتظار رد المستخدم' }, { value: 'resolved', label: 'تم الحل' },
  { value: 'closed', label: 'مغلقة' }
]
const statusLabel = (value: string) => statuses.find(x => x.value === value)?.label || value
const categoryLabel = (value: string) => categories.find(x => x.value === value)?.label || value
const dateLabel = (value: string) => new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })

export default function SupportCenterPage({ admin = false }: Props) {
  const [userId, setUserId] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [messageDraft, setMessageDraft] = useState('')
  const supportParams = new URLSearchParams(window.location.search)
  const suspensionTicketRequested = supportParams.get('new_ticket') === '1'
  const [newTicketOpen, setNewTicketOpen] = useState(suspensionTicketRequested)
  const [subject, setSubject] = useState(suspensionTicketRequested ? (supportParams.get('subject') || 'طلب مراجعة إيقاف الحساب') : '')
  const [category, setCategory] = useState(suspensionTicketRequested ? 'account' : 'general')
  const [priority, setPriority] = useState('normal')
  const [companyAccount, setCompanyAccount] = useState(false)
  const [prioritySupport, setPrioritySupport] = useState(false)
  const [firstMessage, setFirstMessage] = useState(suspensionTicketRequested ? 'أرغب في مراجعة حالة إيقاف حسابي ومعرفة سبب الإيقاف والخطوات المطلوبة لإعادة تفعيله.' : '')
  const [search, setSearch] = useState('')
  const [publicIntake, setPublicIntake] = useState(false)
  const [publicName, setPublicName] = useState('')
  const [publicContactEmail, setPublicContactEmail] = useState('')
  const [publicAccountEmail, setPublicAccountEmail] = useState(new URLSearchParams(window.location.search).get('account_email') || '')
  const [publicPhone, setPublicPhone] = useState('')
  const [publicMessage, setPublicMessage] = useState('أرغب في مراجعة حالة إيقاف حسابي ومعرفة سبب الإيقاف والخطوات المطلوبة لإعادة تفعيله.')
  const [publicReference, setPublicReference] = useState('')
  const [publicRequests, setPublicRequests] = useState<PublicSupportRequest[]>([])
  const [websiteField, setWebsiteField] = useState('')

  const selectedTicket = tickets.find(ticket => ticket.id === selectedId) || null
  const visibleTickets = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return tickets
    return tickets.filter(t => String(t.ticket_number).includes(term) || t.subject.toLocaleLowerCase().includes(term))
  }, [tickets, search])

  const loadTickets = useCallback(async (uid: string) => {
    if (!supabase) return
    const query = supabase.from('support_tickets').select('id,ticket_number,user_id,subject,category,priority,status,created_at,updated_at').order('updated_at', { ascending: false })
    const result = admin ? await query : await query.eq('user_id', uid)
    if (result.error) throw result.error
    const rows = (result.data || []) as TicketRow[]
    setTickets(rows)
    const requestedTicket = new URLSearchParams(window.location.search).get('ticket')
    setSelectedId(current => requestedTicket && rows.some(t => t.id === requestedTicket) ? requestedTicket : rows.some(t => t.id === current) ? current : rows[0]?.id || '')
  }, [admin])

  const loadMessages = useCallback(async (ticketId: string) => {
    if (!supabase || !ticketId) { setMessages([]); return }
    const { data, error: queryError } = await supabase.from('support_ticket_messages')
      .select('id,ticket_id,sender_user_id,body,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: true })
    if (queryError) throw queryError
    setMessages((data || []) as TicketMessage[])
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase) { setError('تعذر الاتصال بقاعدة البيانات.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      if (suspensionTicketRequested && !admin) { setPublicIntake(true); setLoading(false); return }
      window.location.replace('/?login=1'); return
    }
    setUserId(user.id)
    if (!admin) {
      const { data: companyMembership } = await supabase.from('organization_memberships').select('organization_id,organizations!inner(organization_type)').eq('user_id', user.id).eq('organizations.organization_type', 'company').limit(1).maybeSingle()
      if (companyMembership?.organization_id) {
        setCompanyAccount(true)
        const { data: priorityEnabled } = await supabase.rpc('company_has_plan_feature', { p_organization_id: companyMembership.organization_id, p_feature: 'priority_support' })
        setPrioritySupport(priorityEnabled === true)
      } else {
        setCompanyAccount(false); setPrioritySupport(false)
      }
    }
    if (admin) {
      const { data: adminRecord, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
      if (adminError || !adminRecord) { setAuthorized(false); setError('هذه الصفحة متاحة لمديري المنصة فقط.'); setLoading(false); return }
    }
    setAuthorized(true)
    try {
      await loadTickets(user.id)
      if (admin) {
        const { data: publicRows, error: publicError } = await supabase.from('public_support_requests').select('id,contact_name,contact_email,account_email,phone,subject,message,status,created_at').order('created_at', { ascending: false }).limit(100)
        if (publicError) throw publicError
        setPublicRequests((publicRows || []) as PublicSupportRequest[])
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل التذاكر.') }
    finally { setLoading(false) }
  }, [admin, loadTickets])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    void loadMessages(selectedId).catch(e => setError(e instanceof Error ? e.message : 'تعذر تحميل المحادثة.'))
  }, [selectedId, loadMessages])

  async function submitPublicRequest(event: FormEvent) {
    event.preventDefault()
    if (!supabase || saving) return
    setSaving(true); setError('')
    const { data, error: submitError } = await supabase.functions.invoke('public-suspended-account-support', { body: {
      contactName: publicName.trim(), contactEmail: publicContactEmail.trim(), accountEmail: publicAccountEmail.trim(),
      phone: publicPhone.trim(), subject: 'طلب مراجعة إيقاف الحساب', message: publicMessage.trim(), website: websiteField
    } })
    if (submitError || !data?.success) {
      setError(data?.error || submitError?.message || 'تعذر إرسال الطلب. حاول مرة أخرى بعد قليل.')
    } else {
      setPublicReference(String(data.reference || ''))
    }
    setSaving(false)
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !userId || saving) return
    setSaving(true); setError('')
    const { data: ticket, error: ticketError } = await supabase.from('support_tickets').insert({
      user_id: userId, subject: subject.trim(), category, priority
    }).select('id,ticket_number,user_id,subject,category,priority,status,created_at,updated_at').single()
    if (ticketError || !ticket) { setError(ticketError?.message || 'تعذر إنشاء التذكرة.'); setSaving(false); return }
    const { error: messageError } = await supabase.from('support_ticket_messages').insert({
      ticket_id: ticket.id, sender_user_id: userId, body: firstMessage.trim()
    })
    if (messageError) { setError('تم إنشاء التذكرة، لكن تعذر إرسال الرسالة الأولى: ' + messageError.message); setSaving(false); await refresh(); return }
    setSubject(''); setFirstMessage(''); setCategory('general'); setPriority('normal'); setNewTicketOpen(false)
    await refresh(); setSelectedId(ticket.id); await loadMessages(ticket.id); setSaving(false)
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !selectedTicket || !messageDraft.trim() || saving) return
    setSaving(true); setError('')
    const { error: insertError } = await supabase.from('support_ticket_messages').insert({
      ticket_id: selectedTicket.id, sender_user_id: userId, body: messageDraft.trim()
    })
    if (insertError) setError(insertError.message)
    else { setMessageDraft(''); await loadMessages(selectedTicket.id); await loadTickets(userId) }
    setSaving(false)
  }

  async function updateStatus(status: string) {
    if (!supabase || !selectedTicket || !admin) return
    setSaving(true); setError('')
    const { error: updateError } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', selectedTicket.id)
    if (updateError) setError(updateError.message)
    else await loadTickets(userId)
    setSaving(false)
  }

  if (loading) return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f3f7fc] text-slate-600"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-blue-700" size={30}/><p className="mt-3 text-sm font-bold">جارٍ تحميل مركز الدعم...</p></div></main>
  if (publicIntake) return <main dir="rtl" className="min-h-screen bg-[#f3f7fc] px-4 py-8 text-slate-900"><section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"><div className="bg-gradient-to-l from-[#102b47] to-[#1768a6] p-6 text-white"><PlatformBrand/><p className="mt-5 text-xs font-black tracking-wide text-cyan-200">MY CAR · ACCOUNT REVIEW</p><h1 className="mt-2 text-2xl font-black">طلب مراجعة إيقاف الحساب</h1><p className="mt-2 text-sm leading-7 text-blue-100">يمكنك إرسال طلبك دون تسجيل الدخول. سيصل الطلب مباشرة إلى فريق الدعم لمراجعته.</p></div><div className="p-5 sm:p-7">{publicReference ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={38}/><h2 className="mt-3 text-xl font-black text-emerald-900">تم استلام طلبك بنجاح</h2><p className="mt-2 text-sm leading-7 text-emerald-800">رقم مرجعي لطلبك: <strong dir="ltr">{publicReference}</strong>. سيتواصل معك فريق الدعم عبر البريد أو الهاتف الذي أدخلته.</p></div> : <form onSubmit={submitPublicRequest} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">الاسم<input required maxLength={100} value={publicName} onChange={e=>setPublicName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"/></label><label className="text-sm font-bold">بريد للتواصل<input required type="email" maxLength={254} value={publicContactEmail} onChange={e=>setPublicContactEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"/></label><label className="text-sm font-bold">البريد المرتبط بالحساب الموقوف<input required type="email" maxLength={254} value={publicAccountEmail} onChange={e=>setPublicAccountEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"/></label><label className="text-sm font-bold">رقم الهاتف (اختياري)<input type="tel" maxLength={30} value={publicPhone} onChange={e=>setPublicPhone(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"/></label></div><label className="block text-sm font-bold">تفاصيل طلب المراجعة<textarea required minLength={10} maxLength={3000} rows={5} value={publicMessage} onChange={e=>setPublicMessage(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 leading-7"/></label><div aria-hidden="true" className="hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={websiteField} onChange={e=>setWebsiteField(e.target.value)}/></label></div>{error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}<button disabled={saving} className="w-full rounded-xl bg-[#123b63] px-5 py-3.5 font-black text-white disabled:opacity-60">{saving?'جارٍ إرسال الطلب...':'إرسال طلب المراجعة'}</button><p className="text-center text-xs leading-6 text-slate-500">لا تحتاج إلى تسجيل الدخول. تأكد من صحة بريد التواصل حتى يتمكن فريق الدعم من الرد عليك.</p></form>}</div></section></main>
  if (!authorized) return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f3f7fc] p-5"><section className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-amber-500" size={38}/><h1 className="mt-3 text-xl font-black text-slate-900">تعذر فتح مركز الدعم</h1><p className="mt-2 text-sm leading-7 text-slate-600">{error || 'تحقق من تسجيل الدخول وصلاحيات الحساب.'}</p><a href={admin ? "/workspace/admin" : "/workspace"} className="mt-5 inline-flex rounded-xl bg-[#102b47] px-5 py-3 font-bold text-white">{admin ? "العودة للوحة الإدارة" : "العودة لمساحة العمل"}</a></section></main>

  return <>{admin && <AdminPageNavigation/>}<main dir="rtl" className="min-h-screen bg-[#f3f7fc] px-3 py-4 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1440px]">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3"><PlatformBrand/><span className="hidden rounded-full bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-800 sm:inline-flex"><Headset size={15} className="ml-2"/> {admin ? 'إدارة الدعم الفني' : 'مركز الدعم الفني'}</span></div>
        <div className="flex items-center gap-2"><a href={admin ? '/workspace/admin' : '/workspace'} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowRight size={16}/> العودة</a><AccountNotifications/></div>
      </header>
      <section className="mt-5 rounded-3xl bg-gradient-to-l from-[#0b2340] via-[#123a61] to-[#1768a6] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-extrabold text-cyan-200">MY CAR · SUPPORT CENTER</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{admin ? 'إدارة تذاكر الدعم' : 'كيف نقدر نساعدك؟'}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">{admin ? 'تابع استفسارات المستخدمين، ورد على الرسائل، وحدّث حالة كل تذكرة.' : 'أرسل استفسارك أو بلّغ عن مشكلة، وتابع الردود وحالة طلب الدعم من مكان واحد.'}</p></div><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><Ticket size={25} className="text-cyan-200"/><p className="mt-2 text-2xl font-black tabular-nums">{tickets.length.toLocaleString('ar-EG')}</p><p className="text-xs text-blue-100">{admin ? 'إجمالي التذاكر' : 'تذاكرك'}</p></div></div>
      </section>
      {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</div>}
      {admin && publicRequests.length > 0 && <section className="mt-5 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-black text-[#102b47]">طلبات مراجعة الحسابات دون تسجيل دخول</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{publicRequests.length}</span></div><div className="space-y-3">{publicRequests.map(request=><article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{request.subject}</h3><p className="mt-1 text-xs text-slate-500">{dateLabel(request.created_at)} · {request.contact_name}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{request.status==='open'?'مفتوح':request.status}</span></div><div className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2"><p>بريد التواصل: <a className="font-bold text-blue-700" href={`mailto:${request.contact_email}`}>{request.contact_email}</a></p><p>بريد الحساب: <b dir="ltr">{request.account_email}</b></p>{request.phone&&<p>الهاتف: <b dir="ltr">{request.phone}</b></p>}</div><p className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-7 text-slate-700">{request.message}</p></article>)}</div></section>}
      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(280px,.8fr)_minmax(0,1.5fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2"><h2 className="font-black text-[#102b47]">{admin ? 'كل التذاكر' : 'تذاكر الدعم'}</h2>{!admin && <button onClick={()=>setNewTicketOpen(v=>!v)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#ffad0a] px-3 text-xs font-black text-[#102b47]"><Plus size={15}/> تذكرة جديدة</button>}</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث برقم التذكرة أو الموضوع" className="mt-3 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"/>
          {newTicketOpen && <form onSubmit={createTicket} className="mt-3 space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <label className="block text-xs font-bold text-slate-700">عنوان التذكرة<input required minLength={5} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"/></label>
            <label className="block text-xs font-bold text-slate-700">نوع الاستفسار<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-700">الأولوية<select value={priority} onChange={e=>setPriority(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="low">منخفضة</option><option value="normal">عادية</option>{(!companyAccount||prioritySupport)&&<option value="high">{companyAccount?'عاجلة · أولوية الباقة':'عاجلة'}</option>}</select></label>
            {companyAccount&&!prioritySupport&&<p className="text-[11px] leading-5 text-slate-500">أولوية الدعم العاجلة متاحة ضمن باقة المؤسسات. تذاكرك الحالية ستصل إلى فريق الدعم بالأولوية العادية.</p>}
            <label className="block text-xs font-bold text-slate-700">اشرح المشكلة أو الاستفسار<textarea required minLength={1} maxLength={4000} rows={4} value={firstMessage} onChange={e=>setFirstMessage(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"/></label>
            <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving?'جارٍ الإرسال...':'إرسال التذكرة'}</button><button type="button" onClick={()=>setNewTicketOpen(false)} className="rounded-lg border border-slate-200 px-3 text-sm font-bold">إلغاء</button></div>
          </form>}
          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
            {visibleTickets.length===0 ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm leading-6 text-slate-500">{admin?'لا توجد تذاكر دعم حتى الآن.':'لا توجد تذاكر حتى الآن. أنشئ تذكرة جديدة وسيتابع فريق الدعم طلبك.'}</div> : visibleTickets.map(t=><button key={t.id} onClick={()=>setSelectedId(t.id)} className={`block w-full rounded-xl border p-3 text-right transition ${selectedId===t.id?'border-blue-300 bg-blue-50 shadow-sm':'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-blue-800"># {t.ticket_number}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusLabel(t.status)}</span></div><p className="mt-2 line-clamp-2 text-sm font-extrabold text-slate-800">{t.subject}</p><div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span>{categoryLabel(t.category)}</span><span>{dateLabel(t.updated_at)}</span></div></button>)}
          </div>
        </aside>
        <section className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {!selectedTicket ? <div className="m-auto max-w-sm text-center text-slate-500"><MessageSquare className="mx-auto text-slate-300" size={42}/><p className="mt-3 font-bold">اختر تذكرة لعرض تفاصيلها</p></div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-xs font-black text-blue-700">تذكرة رقم #{selectedTicket.ticket_number}</p><h2 className="mt-1 text-lg font-black text-[#102b47]">{selectedTicket.subject}</h2><p className="mt-1 text-xs text-slate-500">{categoryLabel(selectedTicket.category)} · {dateLabel(selectedTicket.created_at)}</p></div>{admin ? <label className="text-xs font-bold text-slate-600">حالة التذكرة<select value={selectedTicket.status} onChange={e=>void updateStatus(e.target.value)} disabled={saving} className="mt-1 block min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm">{statuses.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></label> : <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-800">{statusLabel(selectedTicket.status)}</span>}</div>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {messages.length===0 ? <p className="py-8 text-center text-sm text-slate-500">لا توجد رسائل في هذه التذكرة.</p> : messages.map(m=>{const own=m.sender_user_id===userId;return <div key={m.id} className={`flex ${own?'justify-start':'justify-end'}`}><article className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm ${own?'border-blue-200 bg-blue-50 text-slate-900':'border-slate-700 bg-slate-800 text-white'}`} style={{ backgroundColor: own ? '#eff6ff' : '#102b47', color: own ? '#0f172a' : '#ffffff' }}><p className="mb-1 text-[10px] font-black opacity-70">{own?'أنت':admin?'صاحب التذكرة':'فريق دعم My Car'} · {dateLabel(m.created_at)}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{m.body}</p></article></div>})}
            </div>
            {selectedTicket.status!=='closed' ? <form onSubmit={sendReply} className="flex items-end gap-2 border-t border-slate-100 pt-3"><textarea value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} required maxLength={4000} rows={2} placeholder="اكتب ردك هنا..." className="min-h-12 flex-1 resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-400"/><button disabled={saving||!messageDraft.trim()} aria-label="إرسال الرد" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-700 text-white disabled:opacity-50"><Send size={18}/></button></form> : <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={17}/> هذه التذكرة {selectedTicket.status==='closed'?'مغلقة':'تم حلها'} ولا تقبل ردودًا جديدة.</div>}
          </>}
        </section>
      </section>
      <p className="mt-4 text-center text-[11px] text-slate-400">يتم حفظ التذاكر والردود داخل حسابك، ولا يمكن للمستخدمين الآخرين الاطلاع عليها.</p>
    </div>
  </main></>
}
