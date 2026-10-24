import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Conversation = { id: string; request_id: string | null; vehicle_id: string | null; company_organization_id: string; provider_organization_id: string; status: string; created_at: string; company: { name: string } | null; provider: { name: string } | null; rental_requests: { title: string } | null; vehicles: { make: string; model: string; model_year: number } | null }
type Message = { id: string; sender_id: string; sender_organization_id: string; body: string; created_at: string }

export default function MessagingPage() {
  const [userId,setUserId] = useState('')
  const [organizationId,setOrganizationId] = useState('')
  const [conversations,setConversations] = useState<Conversation[]>([])
  const [messages,setMessages] = useState<Message[]>([])
  const [activeId,setActiveId] = useState(new URLSearchParams(window.location.search).get('conversation') || '')
  const [body,setBody] = useState('')
  const [loading,setLoading] = useState(true)
  const [sending,setSending] = useState(false)
  const [refreshing,setRefreshing] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')

  async function loadConversations() {
    if (!supabase) { window.location.replace('/'); return }
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
  }
  async function loadMessages(conversationId: string) {
    if (!supabase || !conversationId) { setMessages([]); return }
    const { data, error: messageError } = await supabase.from('messages').select('id,sender_id,sender_organization_id,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true})
    if (messageError) setError(messageError.message); else setMessages((data || []) as Message[])
  }
  useEffect(() => { void loadConversations() }, [])
  useEffect(() => { if (activeId) void loadMessages(activeId); else setMessages([]) }, [activeId])

  async function refreshMessages() {
    setRefreshing(true)
    setError('')
    await loadConversations()
    if (activeId) await loadMessages(activeId)
    setRefreshing(false)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId || !organizationId || !activeId || !body.trim()) return
    setSending(true); setError(''); setNotice('')
    const { error: sendError } = await supabase.from('messages').insert({ conversation_id:activeId, sender_organization_id:organizationId, sender_id:userId, body:body.trim() })
    setSending(false)
    if (sendError) { setError(sendError.message); return }
    setBody('')
    await loadMessages(activeId)
    setNotice('تم إرسال الرسالة.')
  }
  const active = conversations.find(c=>c.id===activeId)
  const otherName = active ? (active.company_organization_id===organizationId ? active.provider?.name : active.company?.name) : ''
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div><PlatformBrand compact /><h1 className="mt-1 text-2xl font-extrabold">المراسلات الداخلية</h1><p className="mt-2 text-sm text-slate-500">تواصل مع الطرف الآخر داخل المنصة دون عرض أرقام الهواتف.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void refreshMessages()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/> تحديث الرسائل</button><a href="/" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><ArrowLeft size={16}/> الرئيسية</a></div></header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="py-12 text-center text-slate-500">جارٍ تحميل المحادثات...</p> : <div className="mt-6 grid min-h-[65vh] gap-4 md:grid-cols-[0.8fr_1.2fr]">
      <aside className="space-y-2">{conversations.map(c=><button key={c.id} onClick={()=>setActiveId(c.id)} className={'w-full rounded-2xl border p-4 text-right '+(activeId===c.id?'border-blue-300 bg-blue-50':'border-slate-100 bg-white')}><span className="flex items-center gap-2 font-extrabold"><MessageCircle size={17}/>{c.vehicles ? `${c.vehicles.make} ${c.vehicles.model} · ${c.vehicles.model_year}` : c.rental_requests?.title || 'محادثة بخصوص طلب تأجير'}</span><span className="mt-2 block text-sm text-slate-600">{c.company_organization_id===organizationId ? c.provider?.name : c.company?.name}</span><span className="mt-1 block text-xs text-slate-500">{c.status==='open'?'مفتوحة':'مغلقة'}</span></button>)}{conversations.length===0 && <p className="rounded-2xl border border-dashed bg-white p-6 text-sm leading-7 text-slate-500">لا توجد محادثات بعد. ابدأ محادثة من أحد العروض التي استلمتها شركتك.</p>}</aside>
      <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border bg-white"><div className="border-b p-4"><h2 className="font-extrabold">{active ? otherName : 'اختر محادثة'}</h2><p className="mt-1 text-xs text-slate-500">{active?.vehicles ? `استفسار عن ${active.vehicles.make} ${active.vehicles.model}` : active?.rental_requests?.title || 'المراسلات محفوظة داخل حسابك'}</p></div><div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">{messages.map(m=><div key={m.id} className={'max-w-[90%] rounded-2xl p-3 text-sm leading-7 '+(m.sender_id===userId?'ms-auto bg-blue-700 text-white':'me-auto border bg-white text-slate-800')}><p className="whitespace-pre-wrap break-words">{m.body}</p><p className={'mt-1 text-[10px] '+(m.sender_id===userId?'text-blue-100':'text-slate-400')}>{new Date(m.created_at).toLocaleString('ar-EG')}</p></div>)}{active && messages.length===0 && <p className="py-8 text-center text-sm text-slate-500">ابدأ المحادثة برسالتك الأولى.</p>}</div><form onSubmit={sendMessage} className="flex gap-2 border-t p-3"><input value={body} onChange={e=>setBody(e.target.value)} disabled={!active || active.status!=='open'} maxLength={4000} className="min-h-12 min-w-0 flex-1 rounded-xl border px-4 text-sm outline-none focus:border-blue-600" placeholder={active?.status==='open'?'اكتب رسالتك داخل المنصة...':'اختر محادثة مفتوحة'} /><button disabled={sending || !active || active.status!=='open' || !body.trim()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-4 font-bold text-white disabled:opacity-50"><Send size={17}/> إرسال</button></form></section>
    </div>}
  </div></main>
}
