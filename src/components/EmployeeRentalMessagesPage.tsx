import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Offer = { id: string; request_id: string; status: string; monthly_price_egp: number; created_by: string | null }
type Message = { id: string; offer_id: string; sender_user_id: string; body: string; created_at: string }

export default function EmployeeRentalMessagesPage() {
  const offerId = new URLSearchParams(window.location.search).get('offer') || ''
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<'employee' | 'provider' | ''>('')
  const [offer, setOffer] = useState<Offer | null>(null)
  const [requestTitle, setRequestTitle] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [inboxOffers, setInboxOffers] = useState<Offer[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    if (!supabase) { window.location.replace('/?login=1'); return }
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { window.location.replace('/?login=1'); return }
    setUserId(user.id)
    const { data: account } = await supabase.from('employee_accounts').select('account_status').eq('user_id', user.id).maybeSingle()
    const isEmployee = account?.account_status === 'active'
    if (!offerId) {
      setRole(isEmployee ? 'employee' : 'provider')
      if (isEmployee) {
        const { data: requests } = await supabase.from('employee_rental_requests').select('id').eq('employee_user_id', user.id)
        const requestIds = (requests || []).map((request: { id: string }) => request.id)
        if (requestIds.length) {
          const { data: rows, error: inboxError } = await supabase.from('employee_rental_offers').select('id,request_id,status,monthly_price_egp,created_by').in('request_id', requestIds).order('created_at', { ascending: false })
          if (inboxError) setError('تعذر تحميل المحادثات: ' + inboxError.message)
          setInboxOffers((rows || []) as Offer[])
        }
      } else {
        const { data: rows, error: inboxError } = await supabase.from('employee_rental_offers').select('id,request_id,status,monthly_price_egp,created_by').eq('created_by', user.id).order('created_at', { ascending: false })
        if (inboxError) setError('تعذر تحميل المحادثات: ' + inboxError.message)
        setInboxOffers((rows || []) as Offer[])
      }
      setLoading(false)
      return
    }
    const { data: selectedOffer, error: offerError } = await supabase
      .from('employee_rental_offers')
      .select('id,request_id,status,monthly_price_egp,created_by')
      .eq('id', offerId)
      .maybeSingle()
    if (offerError || !selectedOffer) {
      setError('لا يمكن الوصول إلى هذا العرض. تأكد من تسجيل الدخول بالحساب الذي أرسل العرض أو طلب السيارة.')
      setLoading(false)
      return
    }
    const isProvider = selectedOffer.created_by === user.id
    if (!isEmployee && !isProvider) {
      setError('هذه المحادثة متاحة فقط للموظف صاحب الطلب ومقدم العرض.')
      setLoading(false)
      return
    }
    setRole(isEmployee ? 'employee' : 'provider')
    setOffer(selectedOffer as Offer)
    if (isEmployee) {
      const { data: request } = await supabase.from('employee_rental_requests').select('title').eq('id', selectedOffer.request_id).maybeSingle()
      setRequestTitle(request?.title || 'طلب سيارة شهرية بسائق')
    } else {
      setRequestTitle('محادثة بخصوص عرض سيارة شهرية بسائق')
    }
    const { data: rows, error: messagesError } = await supabase
      .from('employee_rental_offer_messages')
      .select('id,offer_id,sender_user_id,body,created_at')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: true })
    if (messagesError) setError('تعذر تحميل الرسائل: ' + messagesError.message)
    else setMessages((rows || []) as Message[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [offerId])

  async function refresh() {
    setRefreshing(true)
    setError('')
    await load()
    setRefreshing(false)
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId || !offer || !body.trim() || sending) return
    if (!['submitted', 'accepted'].includes(offer.status)) {
      setError('انتهى التواصل على هذا العرض بعد إغلاقه أو سحبه.')
      return
    }
    setSending(true)
    setError('')
    setNotice('')
    const { error: sendError } = await supabase.from('employee_rental_offer_messages').insert({
      offer_id: offer.id,
      sender_user_id: userId,
      body: body.trim()
    })
    setSending(false)
    if (sendError) { setError('تعذر إرسال الرسالة: ' + sendError.message); return }
    setBody('')
    await load()
    setNotice('تم إرسال رسالتك بنجاح.')
  }

  const workspace = role === 'employee' ? '/workspace/employee' : '/workspace/provider-employee-requests'
  const canSend = Boolean(offer && ['submitted', 'accepted'].includes(offer.status))

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <a href={workspace} className="font-black"><PlatformBrand/></a>
        <a href={workspace} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold"><ArrowRight size={16}/> العودة لمساحة العمل</a>
      </div>
    </header>
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-7">
      <section className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#176b9a] p-6 text-white sm:p-8">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10"><MessageCircle size={25}/></span><div><p className="text-sm font-bold text-cyan-200">MY CAR · مراسلات العرض</p><h1 className="mt-1 text-2xl font-black">محادثة خاصة وآمنة</h1></div></div>
        <p className="mt-3 text-sm leading-7 text-blue-100">تواصل مع الطرف الآخر بخصوص العرض نفسه، دون إظهار أرقام الهواتف أو بيانات الاتصال الخاصة.</p>
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">جارٍ تحميل المحادثة...</div> : !offerId ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-lg font-black">محادثاتي</h2><p className="mt-1 text-sm text-slate-500">اختر عرضًا لفتح المحادثة المرتبطة به.</p></div>{inboxOffers.length === 0 ? <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">لا توجد محادثات مرتبطة بعروض حتى الآن.</p> : <div className="space-y-3">{inboxOffers.map(item => <a key={item.id} href={(role === 'employee' ? '/workspace/employee/messages?offer=' : '/workspace/provider/employee-messages?offer=') + item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/50"><div><p className="font-bold">محادثة بخصوص عرض سيارة شهرية بسائق</p><p className="mt-1 text-xs text-slate-500">{Number(item.monthly_price_egp).toLocaleString('ar-EG')} جنيه شهريًا · رقم العرض: {item.id.slice(0, 8)}</p></div><span className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">فتح المحادثة</span></a>)}</div>}</section> : offer && <>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div><p className="text-xs text-slate-500">موضوع المحادثة</p><h2 className="mt-1 font-black">{requestTitle}</h2><p className="mt-1 text-sm text-slate-600">قيمة العرض: {Number(offer.monthly_price_egp).toLocaleString('ar-EG')} جنيه شهريًا</p></div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><ShieldCheck size={16}/> {role === 'employee' ? 'حساب الموظف' : 'مقدم العرض'}</div>
        </section>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4"><div className="flex items-center gap-2 font-extrabold"><UserRound size={18} className="text-blue-700"/> رسائل الطرفين</div><button type="button" onClick={()=>void refresh()} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold disabled:opacity-50"><RefreshCw size={15} className={refreshing?'animate-spin':''}/> تحديث</button></div>
          <div className="min-h-[340px] max-h-[58vh] space-y-3 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
            {messages.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">لا توجد رسائل بعد. ابدأ المحادثة برسالة واضحة عن تفاصيل العرض.</p> : messages.map(message=><article key={message.id} className={'max-w-[88%] rounded-2xl p-3 shadow-sm '+(message.sender_user_id===userId?'ms-auto bg-blue-700 text-white':'me-auto border border-slate-200 bg-white text-slate-800')}><p className="mb-1 text-[11px] font-bold opacity-75">{message.sender_user_id===userId?'أنت':role==='employee'?'مقدم العرض':'الموظف'}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.body}</p><time className={'mt-2 block text-left text-[10px] '+(message.sender_user_id===userId?'text-blue-100':'text-slate-400')}>{new Date(message.created_at).toLocaleString('ar-EG')}</time></article>)}
          </div>
          {canSend ? <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3 sm:p-4"><textarea required rows={2} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} placeholder="اكتب رسالتك هنا..." className="min-h-12 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/><button disabled={sending||!body.trim()} className="inline-flex min-h-12 items-center gap-2 self-end rounded-xl bg-blue-700 px-4 font-bold text-white disabled:opacity-50"><Send size={17}/>{sending?'جارٍ الإرسال':'إرسال'}</button></form> : <p className="border-t bg-slate-50 p-4 text-center text-sm text-slate-500">المحادثة للقراءة فقط لأن العرض لم يعد متاحًا للرد.</p>}
        </section>
      </>}
    </div>
  </main>
}
