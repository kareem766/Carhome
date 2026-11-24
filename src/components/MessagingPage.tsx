import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, MessageCircle, RefreshCw, Send, Search, ShieldCheck, MessagesSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Conversation = { id: string; request_id: string | null; vehicle_id: string | null; company_organization_id: string; provider_organization_id: string; status: string; created_at: string; company: { name: string } | null; provider: { name: string } | null; rental_requests: { title: string } | null; vehicles: { make: string; model: string; model_year: number } | null }
type Message = { id: string; sender_id: string; sender_organization_id: string; body: string; created_at: string }

export default function MessagingPage() {
  const [userId,setUserId] = useState('')
  const [organizationId,setOrganizationId] = useState('')
  const [conversations,setConversations] = useState<Conversation[]>([])
  const [messages,setMessages] = useState<Message[]>([])
  const [activeId,setActiveId] = useState(new URLSearchParams(window.location.search).get('conversation') || '')
  const [mobileChatOpen,setMobileChatOpen] = useState(Boolean(new URLSearchParams(window.location.search).get('conversation')))
  const [body,setBody] = useState('')
  const [loading,setLoading] = useState(true)
  const [sending,setSending] = useState(false)
  const [refreshing,setRefreshing] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [searchTerm,setSearchTerm] = useState('')

  async function loadConversations() {
    try {
    if (!supabase) { window.location.replace('/?login=1'); return }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { window.location.replace('/?login=1'); return }
    setUserId(auth.user.id)
    const { data: memberships, error: membershipError } = await supabase.from('organization_memberships').select('organization_id').eq('user_id',auth.user.id).limit(1)
    if (membershipError) { setError(membershipError.message); setLoading(false); return }
    const orgId = memberships?.[0]?.organization_id
    if (!orgId) { setError('حسابك غير مرتبط بمؤسسة. أكمل إعداد الحساب أولًا.'); setLoading(false); return }
    setOrganizationId(orgId)
    const { data, error: listError } = await supabase.from('conversations').select('id,request_id,vehicle_id,company_organization_id,provider_organization_id,status,created_at,company:organizations!conversations_company_organization_id_fkey(name),provider:organizations!conversations_provider_organization_id_fkey(name),rental_requests(title),vehicles(make,model,model_year)').order('updated_at',{ascending:false})
    if (listError) setError(listError.message); else {
      const rows = (data || []) as unknown as Conversation[]
      setConversations(rows)
      setActiveId(current => rows.some(row => row.id === current) ? current : (rows[0]?.id || ''))
      if (rows.length === 0) setMessages([])
    }
    setLoading(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل المحادثات. تحقق من اتصالك ثم حاول مرة أخرى.')
      setLoading(false)
    }
  }
  async function loadMessages(conversationId: string) {
    try {
    if (!supabase || !conversationId) { setMessages([]); return }
    const { data, error: messageError } = await supabase.from('messages').select('id,sender_id,sender_organization_id,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true})
    if (messageError) setError('تعذر تحميل رسائل المحادثة. حاول تحديث الصفحة.'); else setMessages((data || []) as Message[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل رسائل المحادثة.')
    }
  }
  useEffect(() => { void loadConversations() }, [])
  useEffect(() => { if (activeId) void loadMessages(activeId); else setMessages([]) }, [activeId])

  // Keep the active company/provider/owner conversation live without broad table subscriptions.
  useEffect(() => {
    if (!supabase || !activeId) return
    const client = supabase
    const channel = client
      .channel(`conversation-messages-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeId}`
      }, (payload) => {
        const incoming = payload.new as Message
        setMessages(current => current.some(message => message.id === incoming.id)
          ? current
          : [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at)))
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [activeId])

  async function refreshMessages() {
    if (refreshing) return
    setRefreshing(true)
    setError('')
    try {
      await loadConversations()
      if (activeId) await loadMessages(activeId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحديث المحادثات الآن.')
    } finally {
      setRefreshing(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId || !organizationId || !activeId || !body.trim() || sending) return
    const conversationId = activeId
    const messageBody = body.trim()
    setSending(true); setError(''); setNotice('')
    try {
      const { error: sendError } = await supabase.from('messages').insert({
        conversation_id:conversationId,
        sender_organization_id:organizationId,
        sender_id:userId,
        body:messageBody
      })
      if (sendError) throw new Error('تعذر إرسال الرسالة. تحقق من اتصالك وحالة المحادثة ثم حاول مرة أخرى.')
      setBody('')
      await loadMessages(conversationId)
      setNotice('تم إرسال الرسالة.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إرسال الرسالة الآن. حاول مرة أخرى.')
    } finally {
      setSending(false)
    }
  }
  const active = conversations.find(c=>c.id===activeId)
  const filteredConversations = conversations.filter(c => `${c.vehicles ? `${c.vehicles.make} ${c.vehicles.model}` : c.rental_requests?.title || ''} ${c.company?.name || ''} ${c.provider?.name || ''}`.toLocaleLowerCase('ar').includes(searchTerm.trim().toLocaleLowerCase('ar')))
  const otherName = active ? (active.vehicle_id ? 'الطرف الآخر داخل المنصة' : (active.company_organization_id===organizationId ? active.provider?.name : active.company?.name)) : ''
  return <main dir="rtl" aria-busy={loading} className={`mc-messaging-main min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/70 px-4 py-6 sm:px-6 sm:py-8 ${mobileChatOpen ? "mc-mobile-chat-open" : ""}`}><div className="mx-auto max-w-6xl">
    <section className="mc-messaging-hero relative mt-5 overflow-hidden rounded-[28px] bg-gradient-to-l from-[#082d59] via-[#0756a5] to-[#1685d4] p-5 text-white shadow-xl shadow-blue-900/15 sm:p-7">
      <div className="pointer-events-none absolute -left-12 -top-20 h-56 w-56 rounded-full border-[26px] border-white/10"/>
      <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-cyan-300/10 blur-2xl"/>
      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15 shadow-inner backdrop-blur"><MessagesSquare size={27}/></div>
          <div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold tracking-wide text-blue-100">MY CAR · COMMUNICATION HUB</span><span className="rounded-full border border-emerald-200/30 bg-emerald-300/15 px-2.5 py-1 text-[11px] font-bold text-emerald-100"><ShieldCheck size={12} className="mr-1 inline"/> تواصل آمن</span></div><h1 className="mt-2 text-xl font-black sm:text-2xl">المراسلات الداخلية</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">تابع محادثاتك مع الشركات وموردي السيارات، وناقش التفاصيل واتفقوا مباشرة داخل My Car مع الحفاظ على خصوصية بيانات التواصل.</p></div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2"><div className="mc-messaging-stat-card flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><MessageCircle size={20}/></div><div><p className="text-2xl font-black tabular-nums">{conversations.length}</p><p className="text-xs text-blue-100">إجمالي المحادثات</p></div></div><button type="button" onClick={() => void refreshMessages()} disabled={refreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-sm font-extrabold text-white shadow-sm backdrop-blur transition hover:bg-white/25 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""}/> تحديث الرسائل</button></div>
      </div>
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading ? <div role="status" aria-label="جارٍ تحميل المحادثات" className="mc-messaging-loading mt-6 grid gap-5 md:grid-cols-[0.82fr_1.18fr]"><div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-4"><div className="mc-skeleton h-12 rounded-2xl"/><div className="mc-skeleton h-11 rounded-2xl"/>{Array.from({length:4},(_,index)=><div key={index} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><div className="mc-skeleton h-11 w-11 shrink-0 rounded-2xl"/><div className="flex-1 space-y-2"><div className="mc-skeleton h-3 w-3/5 rounded-full"/><div className="mc-skeleton h-3 w-4/5 rounded-full"/></div></div>)}</div><div className="hidden min-h-[60vh] flex-col justify-end gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 md:flex"><div className="mc-skeleton h-14 w-2/5 rounded-2xl"/><div className="mc-skeleton ms-auto h-16 w-3/5 rounded-2xl"/><div className="mc-skeleton h-14 w-1/2 rounded-2xl"/><div className="mc-skeleton mt-5 h-12 w-full rounded-xl"/></div></div> : <div className="mt-6 grid min-h-[65vh] gap-5 md:grid-cols-[0.82fr_1.18fr]">
      <aside className="mc-messaging-conversation-list space-y-3"><div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div><h2 className="font-extrabold text-slate-900">محادثاتك</h2><p className="mt-1 text-xs text-slate-500">تواصل خاص داخل المنصة</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-extrabold text-blue-800">{conversations.length}</span></div><label className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50"><Search size={17}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="ابحث في المحادثات..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"/></label>{filteredConversations.map(c=><button key={c.id} onClick={()=>{setActiveId(c.id);setMobileChatOpen(true)}} className={'w-full rounded-2xl border p-4 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md '+(activeId===c.id?'border-blue-300 bg-blue-50 ring-1 ring-blue-100':'border-slate-200/80 bg-white hover:border-blue-200')}><span className="flex items-center gap-2 font-extrabold"><MessageCircle size={17}/>{c.vehicles ? `${c.vehicles.make} ${c.vehicles.model} · ${c.vehicles.model_year}` : c.rental_requests?.title || 'محادثة بخصوص طلب تأجير'}</span><span className="mt-2 block text-sm text-slate-600">{c.vehicle_id ? 'تواصل داخلي بخصوص السيارة' : (c.company_organization_id===organizationId ? c.provider?.name : c.company?.name)}</span><span className="mt-1 block text-xs text-slate-500">{c.status==='open'?'مفتوحة':'مغلقة'}</span></button>)}{filteredConversations.length===0 && <p className="rounded-2xl border border-dashed bg-white p-6 text-sm leading-7 text-slate-500">{searchTerm ? 'لا توجد محادثات تطابق بحثك.' : 'لا توجد محادثات بعد. ابدأ محادثة من أحد العروض أو السيارات المتاحة.'}</p>}</aside>
      <section className="mc-messaging-chat-panel flex min-h-[60vh] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/40"><div className="mc-messaging-chat-heading flex items-center gap-3 border-b border-slate-100 bg-white p-5"><button type="button" onClick={()=>setMobileChatOpen(false)} aria-label="العودة إلى قائمة المحادثات" className="mc-messaging-back-to-list inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50"><ArrowRight size={19}/></button><div className="min-w-0"><h2 className="truncate font-extrabold">{active ? otherName : 'اختر محادثة'}</h2><p className="mt-1 truncate text-xs text-slate-500">{active?.vehicles ? `استفسار عن ${active.vehicles.make} ${active.vehicles.model}` : active?.rental_requests?.title || 'المراسلات محفوظة داخل حسابك'}</p></div></div><div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5">{messages.map(m=><div key={m.id} className={'max-w-[90%] rounded-2xl p-3 text-sm leading-7 '+(m.sender_id===userId?'ms-auto bg-blue-700 text-white':'me-auto border bg-white text-slate-800')}><p className="whitespace-pre-wrap break-words">{m.body}</p><p className={'mt-1 text-[10px] '+(m.sender_id===userId?'text-blue-100':'text-slate-400')}>{new Date(m.created_at).toLocaleString('ar-EG')}</p></div>)}{active && messages.length===0 && <p className="py-8 text-center text-sm text-slate-500">ابدأ المحادثة برسالتك الأولى.</p>}</div><form onSubmit={sendMessage} className="flex gap-2 border-t p-3"><input value={body} onChange={e=>setBody(e.target.value)} disabled={!active || active.status!=='open'} maxLength={4000} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={active?.status==='open'?'اكتب رسالتك داخل المنصة...':'اختر محادثة مفتوحة'} /><button disabled={sending || !active || active.status!=='open' || !body.trim()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-4 font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Send size={17}/> إرسال</button></form></section>
    </div>}
  </div></main>
}
